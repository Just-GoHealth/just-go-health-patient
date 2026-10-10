import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

type ApiModule = typeof import("@/lib/api");

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("patient api client", () => {
  const fetchMock = vi.fn();
  let api: ApiModule;

  beforeEach(async () => {
    // Fresh in-memory tokens and refresh state for every test.
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    api = await import("@/lib/api");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("signup", () => {
    const payload = {
      contactType: "PHONE" as const,
      contact: "+233200000000",
      name: "Ama Kumi",
      nickname: "Ama",
      gender: "FEMALE",
      dateOfBirth: "2009-04-12",
      password: "secret123",
      versionCode: "nsmq2026",
    };

    it("posts to the patient signup endpoint through the same-origin proxy", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ data: { userId: "u1" } }));

      const res = await api.signup(payload);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/v1/patients/auth/signup");
      expect(init.method).toBe("POST");
      expect(init.credentials).toBe("include");
      expect(res.data?.userId).toBe("u1");
    });

    it("sends referralHandle when present (item 14)", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ data: {} }));

      await api.signup({ ...payload, referralHandle: "Setornam" });

      expect(JSON.parse(fetchMock.mock.calls[0][1].body).referralHandle).toBe(
        "Setornam",
      );
    });

    it("leaves referralHandle out when absent", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ data: {} }));

      await api.signup(payload);

      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty(
        "referralHandle",
      );
    });
  });

  describe("tokens", () => {
    it("keeps the access token from signin in memory and sends it", async () => {
      fetchMock
        .mockResolvedValueOnce(
          jsonResponse({ data: { accessToken: "a1", refreshToken: "r1" } }),
        )
        .mockResolvedValueOnce(jsonResponse({ data: { nickname: "Ama" } }));

      await api.signin("+233200000000", "secret123");
      await api.getHomeProfile();

      expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(
        "Bearer a1",
      );
    });

    it("refreshes once on 401 and retries", async () => {
      api.setAccessToken("expired");
      fetchMock
        .mockResolvedValueOnce(jsonResponse({}, 401))
        .mockResolvedValueOnce(jsonResponse({ data: { accessToken: "a2" } }))
        .mockResolvedValueOnce(jsonResponse({ data: { nickname: "Ama" } }));

      const res = await api.getHomeProfile();

      expect(fetchMock.mock.calls[1][0]).toBe(
        "/api/v1/patients/auth/refresh-token",
      );
      expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe(
        "Bearer a2",
      );
      expect(res.data).toEqual({ nickname: "Ama" });
    });

    it("shares one refresh between concurrent 401s", async () => {
      api.setAccessToken("expired");
      fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
        if (url.endsWith("/refresh-token")) {
          return jsonResponse({ data: { accessToken: "a2" } });
        }
        const auth = (init.headers as Record<string, string>).Authorization;
        return auth === "Bearer a2"
          ? jsonResponse({ data: {} })
          : jsonResponse({}, 401);
      });

      await Promise.all([api.getHomeProfile(), api.getEnrollments()]);

      const refreshCalls = fetchMock.mock.calls.filter(([url]) =>
        String(url).endsWith("/refresh-token"),
      );
      expect(refreshCalls).toHaveLength(1);
    });

    it("throws ApiError with status and errorCode when the refresh fails", async () => {
      fetchMock
        .mockResolvedValueOnce(
          jsonResponse(
            { data: { errorCode: "UNAUTHORIZED", message: "Sign in" } },
            401,
          ),
        )
        .mockResolvedValueOnce(jsonResponse({}, 401));

      const error = await api.getHomeProfile().catch((e) => e);

      expect(error).toBeInstanceOf(api.ApiError);
      expect(error.status).toBe(401);
      expect(error.code).toBe("UNAUTHORIZED");
      expect(error.message).toBe("Sign in");
    });

    it("never refreshes on auth endpoints", async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, 401));

      await expect(api.signin("+233200000000", "wrong")).rejects.toBeInstanceOf(
        api.ApiError,
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("logout", () => {
    it("invalidates the refresh token on the backend, then clears cookies", async () => {
      fetchMock
        .mockResolvedValueOnce(
          jsonResponse({ data: { accessToken: "a1", refreshToken: "r1" } }),
        )
        .mockResolvedValue(jsonResponse({ success: true }));

      await api.signin("+233200000000", "secret123");
      await api.logout();

      expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/patients/auth/logout");
      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
        refreshToken: "r1",
      });
      expect(fetchMock.mock.calls[2][0]).toBe("/api/logout");
      // Tokens are gone: the logout requests themselves carry none after clear.
      expect(fetchMock.mock.calls[2][1].headers.Authorization).toBeUndefined();
    });

    it("still clears cookies when the backend logout fails", async () => {
      fetchMock
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce(jsonResponse({ success: true }));

      await api.logout();

      expect(fetchMock.mock.calls.at(-1)?.[0]).toBe("/api/logout");
    });
  });
});
