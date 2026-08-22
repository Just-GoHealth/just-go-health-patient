import { NextResponse } from "next/server";

// The backend has no signout endpoint - auth here is entirely the
// __Host-access_token / __Host-refresh_token cookies signin/verify set.
// __Host-prefixed cookies require Secure + Path=/ + no Domain attribute,
// which only a same-origin response can clear - the proxied backend
// (rewritten through next.config.ts) can't do it from client JS, since
// they're HttpOnly. This route is checked before that rewrite because
// Next.js resolves filesystem routes before applying it.
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
  return res;
}
