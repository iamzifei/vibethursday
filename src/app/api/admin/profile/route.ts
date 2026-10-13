import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/admin-auth";
import { isSessionDate } from "@/lib/checkin";
import { getCopy } from "@/lib/content";
import { checkIn, listProfiledPeople, savePersonProfile, undoCheckin } from "@/lib/db";
import {
  PERSON_LEVEL_LABEL,
  PERSON_ROLE_LABEL,
  cleanProfile,
  cleanSessionNote,
  csvField,
  matchesFilter,
  type PeopleFilter,
} from "@/lib/person-profile";
import { bodyTooLarge, boundedRequest, tooMany } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { fromThisSite } from "@/lib/same-origin";

/** The most this route reads from a request body (see `boundedRequest`). */
const MAX_BODY = 16 * 1024;

export const dynamic = "force-dynamic";

/**
 * The tagging page's autosave (2026-10-13). JSON in, JSON out, so a tap on a
 * chip saves without reloading the page.
 *
 *   { op: "save", signupId, session?, profile, sessionNote? } — the whole card, every time
 *   { op: "arrived" | "absent", signupId, session }            — tick or untick a check-in
 *
 * The same four gates as every other /admin write: size, same site, rate,
 * organiser cookie.
 */
export async function POST(request: Request) {
  if (bodyTooLarge(request, MAX_BODY)) return new Response("Payload too large", { status: 413 });
  if (!fromThisSite(request, await requestOrigin())) return new Response("Forbidden", { status: 403 });

  const limited = tooMany(request, "admin-profile", 600);
  if (limited) return limited;

  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });

  if (!isAdminRequest((await cookies()).get(ADMIN_COOKIE)?.value, null)) {
    return NextResponse.json({ error: "not_authorised" }, { status: 403 });
  }

  const body = (await bounded.json().catch(() => null)) as Record<string, unknown> | null;
  const signupId = body?.signupId;
  if (typeof signupId !== "string" || !/^\d+$/.test(signupId)) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }
  const session = typeof body?.session === "string" && isSessionDate(body.session) ? body.session : null;

  try {
    if (body?.op === "save") {
      await savePersonProfile({
        signupId,
        profile: cleanProfile(body.profile),
        session,
        sessionNote: cleanSessionNote(body.sessionNote),
      });
    } else if ((body?.op === "arrived" || body?.op === "absent") && session) {
      if (body.op === "arrived") await checkIn({ session, signupId, onWall: false, source: "admin" });
      else await undoCheckin(session, signupId);
    } else {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
  } catch {
    // An id that is not a signup fails the foreign key: a stale page, not a server fault.
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * /admin/people as a CSV, with the same filters (`?format=csv&role=owner…`).
 * Organiser cookie only. A BOM up front so Excel reads the Chinese as UTF-8.
 */
export async function GET(request: Request) {
  if (!fromThisSite(request, await requestOrigin())) return new Response("Forbidden", { status: 403 });
  const limited = tooMany(request, "admin-profile", 600);
  if (limited) return limited;
  if (!isAdminRequest((await cookies()).get(ADMIN_COOKIE)?.value, null)) {
    return NextResponse.json({ error: "not_authorised" }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const filter: PeopleFilter = {};
  for (const key of ["role", "level", "industry", "tag", "resource", "q"] as const) {
    const value = params.get(key);
    if (value) filter[key] = value.slice(0, 60);
  }

  const industries = getCopy("zh").signup.fields.industryOptions;
  const people = (await listProfiledPeople()).filter((person) => matchesFilter(person, filter));
  const header = ["名字", "微信", "角色", "水平", "行业", "专业/能力", "资源", "来过次数", "来过的场次", "每场备注", "长期印象", "标注于"];
  const lines = people.map((person) =>
    [
      person.name,
      person.wechat,
      person.roles.map((role) => PERSON_ROLE_LABEL[role]).join("、"),
      person.level ? `${person.level} ${PERSON_LEVEL_LABEL[person.level]}` : "",
      industries.find((option) => option.value === person.industry)?.label ?? person.industry,
      person.tags.join("、"),
      person.resources.join("、"),
      person.attended.length,
      person.attended.join(" "),
      person.session_notes.map((item) => `${item.session} ${item.note}`).join(" | "),
      person.note,
      person.updated_at,
    ]
      .map(csvField)
      .join(","),
  );

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(`\uFEFF${[header.join(","), ...lines].join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="people-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
