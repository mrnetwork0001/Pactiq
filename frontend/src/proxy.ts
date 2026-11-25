import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GATE_COOKIE, gatePassword, gateToken, sameText } from "@/lib/gate";

/*
 * The site password (see lib/gate.ts). Pages and the app's own API calls need the cookie.
 * Left open on purpose, because machines without a cookie read them: badge metadata (wallets and
 * explorers), share cards (link previews), the public score API, calendar reminders and the
 * hourly reminder job, which has its own secret.
 */
export function proxy(request: NextRequest) {
  const password = gatePassword();
  if (!password) return NextResponse.next();

  const cookie = request.cookies.get(GATE_COOKIE)?.value;
  if (cookie && sameText(cookie, gateToken(password))) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "This site is password-protected. Open it in a browser and enter the password first." }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/gate";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/|gate$|api/gate$|api/badge/|api/card|api/score/|api/reminder/|api/push/cron|badges/|qie/|favicon\\.ico|icon|manifest\\.webmanifest|sw\\.js).*)",
  ],
};
