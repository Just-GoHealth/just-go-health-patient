import { NextResponse } from "next/server";

// __Host-prefixed cookies require Secure + Path=/ + no Domain attribute,
// which only a same-origin response can clear - the proxied backend
// (rewritten through next.config.ts) can't do it from client JS, since
// they're HttpOnly. This route is checked before that rewrite because
// Next.js resolves filesystem routes before applying it.
//
// Also clears plain (non-__Host-) accessToken/refreshToken cookies - a
// real logged-in session was observed carrying both the __Host- pair AND
// these, undocumented by the integration guide but genuinely present and
// carrying a valid session, so logout has to drop them too or the patient
// stays signed in via whichever one this route doesn't clear.
export async function POST() {
  const res = NextResponse.json({ success: true });
  const expired = {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    maxAge: 0,
  };
  res.cookies.set("__Host-access_token", "", expired);
  res.cookies.set("__Host-refresh_token", "", expired);
  res.cookies.set("accessToken", "", { path: "/", maxAge: 0 });
  res.cookies.set("refreshToken", "", { path: "/", maxAge: 0 });
  return res;
}
