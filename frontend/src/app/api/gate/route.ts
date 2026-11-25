import { NextResponse } from "next/server";
import { GATE_COOKIE, gatePassword, gateToken, safeNext, sameText } from "@/lib/gate";

/** Checks the site password and, if it is right, sets the cookie that lets the browser in for 30 days. */
export async function POST(request: Request) {
  const form = await request.formData();
  const next = safeNext(String(form.get("next") ?? ""));
  const password = gatePassword();
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);

  if (!password) return to(next);
  if (!sameText(String(form.get("password") ?? ""), password)) {
    return to(`/gate?error=1${next === "/" ? "" : `&next=${encodeURIComponent(next)}`}`);
  }
  const res = to(next);
  res.cookies.set(GATE_COOKIE, gateToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
