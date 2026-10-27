import { NextResponse } from "next/server";
import { LEARN_COOKIE } from "@/lib/learn";
import { requestOrigin } from "@/lib/request-origin";
import { fromThisSite } from "@/lib/same-origin";

export const dynamic = "force-dynamic";

/**
 * Signs this browser out of /learn: drops the learner cookie. Inside WeChat
 * the person is still recognised by WeChat itself, which is the point of
 * WeChat login; this is for a shared computer signed in by email.
 */
export async function POST(request: Request) {
  const origin = await requestOrigin();
  if (!fromThisSite(request, origin)) return new Response("Forbidden", { status: 403 });
  const response = NextResponse.redirect(new URL("/learn/login", origin), 303);
  response.cookies.set(LEARN_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: origin.startsWith("https://"), path: "/", maxAge: 0 });
  return response;
}
