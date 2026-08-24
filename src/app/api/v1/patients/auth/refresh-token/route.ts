import { NextRequest, NextResponse } from "next/server";

// The backend requires the raw refresh token in the Authorization header,
// not just the __Host-refresh_token cookie - but that cookie is HttpOnly,
// so client JS can never read it back to build that header itself. This
// route runs server-side (where HttpOnly cookies ARE readable) and does it
// on the client's behalf. Same trick as ../../../../logout/route.ts: Next.js
// resolves filesystem routes before the /api/:path* rewrite in
// next.config.ts, so this intercepts the call instead of proxying straight
// through to the backend.
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://justgo.up.railway.app";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get("__Host-refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json(
      { success: false, message: "No refresh token" },
      { status: 401 },
    );
  }

  const backendRes = await fetch(
    `${API_BASE_URL}/api/v1/patients/auth/refresh-token`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${refreshToken}`,
        cookie: request.headers.get("cookie") ?? "",
      },
    },
  );

  const body = await backendRes.json().catch(() => ({}));
  const response = NextResponse.json(body, { status: backendRes.status });

  // the backend rotates both cookies on a successful refresh - relay every
  // Set-Cookie verbatim so their __Host-* attributes (Secure, Path=/, no
  // Domain) survive the hop instead of being collapsed into one header
  for (const cookie of backendRes.headers.getSetCookie()) {
    response.headers.append("set-cookie", cookie);
  }

  return response;
}
