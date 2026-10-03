import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { register } from "node:module";
import path from "node:path";
import { test } from "node:test";
import { boundedRequest } from "../src/lib/rate-limit.ts";

/**
 * Every route that reads a request body must stop reading at its limit — also
 * when the request is chunked and declares no Content-Length.
 *
 * `bodyTooLarge` only looks at the declared length, so before `boundedRequest`
 * a chunked body of any size went straight into `formData()` / `json()` and was
 * buffered in full. The photo upload was fixed first; these tests hold every
 * other route to the same rule, by calling the real route handlers.
 */

// Lets this file import route handlers, which use the "@/" alias.
register("./fixtures/alias-hooks.mjs", import.meta.url);

// A coach route with no key answers 404 before it reads anything; give it one
// so the test reaches the body. Nothing here ever calls the model.
process.env.DEEPSEEK_API_KEY ??= "test-key-not-used";

const OVERSIZE = 8 * 1024 * 1024; // above every route's limit, the photo upload's included
const CHUNK = 16 * 1024;

/** A chunked request (no Content-Length) whose stream reports how much was pulled. */
function chunkedRequest(
  bytes: Uint8Array | number,
  contentType: string,
  method = "POST",
  headers: Record<string, string> = {},
): { request: Request; pulled: () => number } {
  let sent = 0;
  const total = typeof bytes === "number" ? bytes : bytes.byteLength;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= total) {
        controller.close();
        return;
      }
      const size = Math.min(CHUNK, total - sent);
      const chunk = typeof bytes === "number" ? new Uint8Array(size).fill(97) : bytes.slice(sent, sent + size);
      sent += size;
      controller.enqueue(chunk);
    },
  });
  const request = new Request("http://localhost/api/test", {
    method,
    headers: { "content-type": contentType, ...headers },
    body: stream,
    duplex: "half",
  } as RequestInit);
  assert.equal(request.headers.get("content-length"), null, "the test request really is chunked");
  return { request, pulled: () => sent };
}

async function multipart(fields: Record<string, string | Blob>): Promise<{ bytes: Uint8Array; type: string }> {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  const encoded = new Response(form);
  return { bytes: new Uint8Array(await encoded.arrayBuffer()), type: encoded.headers.get("content-type")! };
}

// ── The helper ───────────────────────────────────────────────────────────

test("★ boundedRequest stops a chunked body at the limit instead of buffering it", async () => {
  const { request, pulled } = chunkedRequest(OVERSIZE, "application/json");
  assert.equal(await boundedRequest(request, 64 * 1024), null);
  assert.ok(pulled() <= 64 * 1024 + 2 * CHUNK, `stopped reading early (read ${pulled()} bytes)`);
});

test("boundedRequest passes a chunked body under the limit through intact", async () => {
  const json = new TextEncoder().encode(JSON.stringify({ hello: "world" }));
  const { request } = chunkedRequest(json, "application/json", "POST", {
    cookie: "vt_member=abc",
    "x-forwarded-for": "203.0.113.9",
  });
  const bounded = await boundedRequest(request, 1024);
  assert.ok(bounded);
  assert.deepEqual(await bounded.json(), { hello: "world" });
  assert.equal(bounded.method, "POST");
  assert.equal(bounded.url, "http://localhost/api/test");
  // Everything the routes read off the headers afterwards is still there.
  assert.equal(bounded.headers.get("cookie"), "vt_member=abc");
  assert.equal(bounded.headers.get("x-forwarded-for"), "203.0.113.9");
  assert.equal(bounded.headers.get("content-type"), "application/json");
});

test("boundedRequest: exactly at the limit is allowed, one byte over is not", async () => {
  assert.ok(await boundedRequest(chunkedRequest(1000, "text/plain").request, 1000));
  assert.equal(await boundedRequest(chunkedRequest(1001, "text/plain").request, 1000), null);
});

test("boundedRequest still refuses a declared length over the limit without reading", async () => {
  const declared = (length: string) =>
    new Request("http://localhost/x", { method: "POST", headers: { "content-length": length }, body: "x" });
  assert.equal(await boundedRequest(declared(String(10 * 1024 * 1024)), 1024), null);
  assert.equal(await boundedRequest(declared("not-a-number"), 1024), null);
});

test("boundedRequest parses a chunked multipart form", async () => {
  const { bytes, type } = await multipart({ key: "k", note: "hello" });
  const bounded = await boundedRequest(chunkedRequest(bytes, type).request, 64 * 1024);
  assert.ok(bounded);
  const form = await bounded.formData();
  assert.equal(form.get("key"), "k");
  assert.equal(form.get("note"), "hello");
});

test("boundedRequest with a stream that breaks part-way gives an empty body, not a crash", async () => {
  let first = true;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (first) {
        first = false;
        controller.enqueue(new Uint8Array([123]));
      } else controller.error(new Error("connection reset"));
    },
  });
  const request = new Request("http://localhost/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: stream,
    duplex: "half",
  } as RequestInit);
  const bounded = await boundedRequest(request, 1024);
  assert.ok(bounded);
  await assert.rejects(bounded.json(), "the route's own parse fails and it answers 400 as for any bad body");
});

// ── Every route ──────────────────────────────────────────────────────────

/** Every route handler that takes a body, and the method that takes it. */
const ROUTES: [file: string, method: "POST" | "DELETE"][] = [
  ["src/app/api/admin/checkin/route.ts", "POST"],
  ["src/app/api/admin/deck/route.ts", "POST"],
  ["src/app/api/admin/member/route.ts", "POST"],
  ["src/app/api/admin/merge/route.ts", "POST"],
  ["src/app/api/admin/order/route.ts", "POST"],
  ["src/app/api/admin/photos/route.ts", "POST"],
  ["src/app/api/admin/questions/route.ts", "POST"],
  ["src/app/api/admin/waitlist/route.ts", "POST"],
  ["src/app/api/admin/wechat/route.ts", "POST"],
  ["src/app/api/admin/wharf/route.ts", "POST"],
  ["src/app/api/checkin/route.ts", "POST"],
  ["src/app/api/claim/route.ts", "POST"],
  ["src/app/api/deck/route.ts", "POST"],
  ["src/app/api/deck/[code]/route.ts", "POST"],
  ["src/app/api/deck/[code]/slides/route.ts", "POST"],
  ["src/app/api/deck/[code]/slides/route.ts", "DELETE"],
  ["src/app/api/feedback/route.ts", "POST"],
  ["src/app/api/me/route.ts", "POST"],
  ["src/app/api/me/avatar/route.ts", "POST"],
  ["src/app/api/my/route.ts", "POST"],
  ["src/app/api/order/route.ts", "POST"],
  ["src/app/api/play/board/route.ts", "POST"],
  ["src/app/api/play/claim/route.ts", "POST"],
  ["src/app/api/play/daily/route.ts", "POST"],
  ["src/app/api/play/join/route.ts", "POST"],
  ["src/app/api/play/move/route.ts", "POST"],
  ["src/app/api/session-photos/route.ts", "POST"],
  ["src/app/api/signup/route.ts", "POST"],
  ["src/app/api/wharf/route.ts", "POST"],
  ["src/app/api/wharf/coach/route.ts", "POST"],
];

type Handler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;

async function handler(file: string, method: string): Promise<Handler> {
  const mod = (await import(path.join(process.cwd(), file))) as Record<string, Handler>;
  assert.equal(typeof mod[method], "function", `${file} exports ${method}`);
  return mod[method];
}

const context = { params: Promise.resolve({ code: "abcd", idx: "0", id: "1" }) };

let address = 0;

for (const [file, method] of ROUTES) {
  test(`★ ${method} ${file.replace("src/app", "").replace("/route.ts", "")} refuses an oversize chunked body with 413`, async () => {
    const run = await handler(file, method);
    // Each content type the routes accept: the size gate must not depend on it.
    for (const type of ["application/json", "multipart/form-data; boundary=x", "application/x-www-form-urlencoded"]) {
      // A fresh address per call, so no route's per-address rate limit can
      // answer before the size gate does, however many calls this file makes.
      const { request, pulled } = chunkedRequest(OVERSIZE, type, method, {
        "sec-fetch-site": "same-origin",
        "x-forwarded-for": `198.51.100.${++address}`,
      });
      const response = await run(request, context);
      // Signup takes JSON only and answers anything else with 415 before it
      // touches the body — refused without reading, which is just as good.
      const refusedUnread = response.status === 415 && pulled() <= CHUNK;
      assert.ok(response.status === 413 || refusedUnread, `${type}: got ${response.status}`);
      assert.ok(pulled() < OVERSIZE, `${type}: stopped reading before the end (read ${pulled()} bytes)`);
    }
  });
}

test("every route that reads a body is in the list above and reads it through boundedRequest", () => {
  const listed = new Set(ROUTES.map(([file]) => file));
  const routeFiles = (readdirSync("src/app", { recursive: true }) as string[])
    .filter((f) => f.endsWith(`${path.sep}route.ts`))
    .map((f) => path.join("src/app", f).split(path.sep).join("/"));
  assert.ok(routeFiles.length > 30, "found the route files");
  for (const file of routeFiles) {
    const source = readFileSync(file, "utf8");
    if (!/request\.(formData|json|text|arrayBuffer|blob)\(\)|request\.body\b|handlePhotoUpload\(/.test(source)) continue;
    assert.ok(listed.has(file), `${file} reads a body but has no oversize test here`);
    if (file.endsWith("session-photos/route.ts")) continue; // reads through handlePhotoUpload
    // Each read must be the first body read after its own `request = bounded;`
    // in the same handler — not merely as many of one as of the other.
    assert.ok(!/request\.clone\(\)/.test(source), `${file}: no clone() around the bounded copy`);
    for (const handler of source.split(/\nexport async function /).slice(1)) {
      const reads = [...handler.matchAll(/request\.(formData|json|text|arrayBuffer|blob)\(\)/g)];
      if (reads.length === 0) continue;
      const bound = handler.indexOf("request = bounded;");
      assert.ok(bound >= 0 && bound < reads[0].index!, `${file}: the body is bounded before it is read`);
    }
  }
});

// ── Normal bodies still get through ───────────────────────────────────────

test("a normal chunked JSON body still works: signup's honeypot answer", async () => {
  const run = await handler("src/app/api/signup/route.ts", "POST");
  const json = new TextEncoder().encode(JSON.stringify({ company: "bot inc" }));
  const response = await run(chunkedRequest(json, "application/json").request, context);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("a normal chunked JSON body still works: /play leaving the room", async () => {
  const run = await handler("src/app/api/play/move/route.ts", "POST");
  const json = new TextEncoder().encode(JSON.stringify({ leave: true, id: "nobody", key: "nothing" }));
  const response = await run(chunkedRequest(json, "application/json").request, context);
  assert.equal(response.status, 204);
});

test("a normal chunked multipart body still works: the avatar file is parsed and checked", async () => {
  const run = await handler("src/app/api/me/avatar/route.ts", "POST");
  const { bytes, type } = await multipart({ avatar: new Blob([new Uint8Array(2000).fill(1)]) });
  const response = await run(chunkedRequest(bytes, type).request, context);
  // Reached the type check, so the file came through the bounded read whole.
  assert.equal(response.status, 415);
  assert.equal((await response.json()).error, "bad_type");
});

test("a normal chunked multipart body still works: a Wharf form reaches its own validation", async () => {
  const run = await handler("src/app/api/wharf/route.ts", "POST");
  const { bytes, type } = await multipart({ action: "coming", question: "1", session: "1999-01-01" });
  const response = await run(chunkedRequest(bytes, type).request, context);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "bad_session");
});

test("a request with a declared, small Content-Length still works as before", async () => {
  const run = await handler("src/app/api/signup/route.ts", "POST");
  const response = await run(
    new Request("http://localhost/api/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ company: "bot inc" }),
    }),
    context,
  );
  assert.equal(response.status, 200);
});

// The Wharf body limit must leave room for the largest allowed answer image
// (500 KB). It was once a flat 64 KB, so every image over 64 KB got a 413
// before the image limit was ever consulted.
test("a Wharf form carrying a ~400 KB image is not rejected for size", async () => {
  const run = await handler("src/app/api/wharf/route.ts", "POST");
  const { bytes, type } = await multipart({
    action: "coming",
    question: "1",
    session: "1999-01-01",
    image: new Blob([new Uint8Array(400 * 1024).fill(1)]),
  });
  const response = await run(chunkedRequest(bytes, type).request, context);
  // Got past the body limit and reached the route's own validation.
  assert.notEqual(response.status, 413);
  assert.equal(response.status, 400);
});

test("a Wharf body well over the image limit is still rejected with 413", async () => {
  const run = await handler("src/app/api/wharf/route.ts", "POST");
  const { bytes, type } = await multipart({
    action: "coming",
    image: new Blob([new Uint8Array(700 * 1024).fill(1)]),
  });
  const response = await run(chunkedRequest(bytes, type).request, context);
  assert.equal(response.status, 413);
});
