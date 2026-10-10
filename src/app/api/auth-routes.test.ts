import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as logout } from "./logout/route";
import { POST as refresh } from "./v1/patients/auth/refresh-token/route";

describe("patient auth route handlers", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("POST /api/logout", () => {
    it("expires both __Host- cookies and the plain token cookies", async () => {
      const res = await logout();

      for (const name of [
        "__Host-access_token",
        "__Host-refresh_token",
        "accessToken",
        "refreshToken",
      ]) {
        expect(res.cookies.get(name)?.maxAge).toBe(0);
      }
      expect(res.cookies.get("__Host-refresh_token")?.httpOnly).toBe(true);
      expect(res.cookies.get("__Host-refresh_token")?.secure).toBe(true);
    });
  });

  describe("POST /api/v1/patients/auth/refresh-token", () => {
    function refreshRequest(cookie?: string): NextRequest {
      return new NextRequest(
        "http://localhost/api/v1/patients/auth/refresh-token",
        {
          method: "POST",
          headers: cookie ? { cookie } : {},
        },
      );
    }

    it("returns 401 without the HttpOnly refresh cookie", async () => {
      const res = await refresh(refreshRequest());

      expect(res.status).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("sends the cookie value as the bearer token and relays Set-Cookie", async () => {
      const backend = new Response(
        JSON.stringify({ data: { accessToken: "a2" } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
      backend.headers.append(
        "set-cookie",
        "__Host-refresh_token=r2; Path=/; Secure; HttpOnly",
      );
      backend.headers.append(
        "set-cookie",
        "__Host-access_token=a2; Path=/; Secure; HttpOnly",
      );
      fetchMock.mockResolvedValue(backend);

      const res = await refresh(refreshRequest("__Host-refresh_token=r1"));

      const [, init] = fetchMock.mock.calls[0];
      expect(init.headers.Authorization).toBe("Bearer r1");
      expect(res.status).toBe(200);
      expect((await res.json()).data.accessToken).toBe("a2");
      expect(res.headers.getSetCookie()).toHaveLength(2);
    });

    it("passes a backend rejection through", async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ success: false }), { status: 401 }),
      );

      const res = await refresh(refreshRequest("__Host-refresh_token=old"));

      expect(res.status).toBe(401);
    });
  });
});
