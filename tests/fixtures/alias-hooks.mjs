// Module hooks for tests that import route handlers directly
// (tests/body-limits.test.mts).
//
// Route files use the tsconfig "@/..." alias and extensionless specifiers,
// which Node's own resolver does not understand. This maps "@/x" to
// "src/x.ts", "next/server" to "next/server.js", and lets JSON imports load.
//
// One substitution: "@/lib/member-auth" resolves to a stub that says a member
// is signed in. The real one reads a cookie through next/headers, which only
// works inside a live Next request; the routes that need it check the member
// before they read the body, so without the stub a test could never reach the
// body read at all.
const SRC = new URL("../../src/", import.meta.url);
const MEMBER_STUB = new URL("./member-auth-stub.ts", import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (specifier === "@/lib/member-auth") return next(MEMBER_STUB, context);
  if (specifier.startsWith("@/")) {
    const base = new URL(specifier.slice(2), SRC).href;
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
      try {
        return await next(candidate, context);
      } catch {
        // try the next spelling
      }
    }
  }
  // next's subpath entry points are plain .js files with no "exports" map, so
  // ESM needs the extension spelled out.
  if (/^next\/[a-z-]+$/.test(specifier)) return next(`${specifier}.js`, context);
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.endsWith(".json")) {
    return next(url, { ...context, importAttributes: { ...context.importAttributes, type: "json" } });
  }
  return next(url, context);
}
