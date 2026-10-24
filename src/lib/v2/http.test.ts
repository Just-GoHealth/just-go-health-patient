import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

type HttpModule = typeof import("./http");
type FetchInit = RequestInit & { headers: Record<string, string> };
type ApiErrorInstance = InstanceType<HttpModule["ApiError"]>;

/** Resolves with the error a request rejected with. */
function failure(promise: Promise<unknown>): Promise<ApiErrorInstance> {
  return promise.then(
    () => {
      throw new Error("expected the request to fail");
    },
    (e: unknown) => e as ApiErrorInstance,
  );
}

function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("v2 http client", () => {
  const fetchMock =
    vi.fn<(url: string, init: FetchInit) => Promise<Response>>();
  let http: HttpModule;
  let cookie = "";

  beforeEach(async () => {
    vi.resetModules();
    fetchMock.mockReset();
    cookie = "XSRF-TOKEN=tok-1";
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", {
      get cookie() {
        return cookie;
      },
    });
    http = await import("./http");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends credentials and no CSRF header on GET, same-origin", async () => {
    fetchMock.mockResolvedValue(json({ id: 1 }));

    const res = await http.http.get<{ id: number }>("/providers/me");

    expect(res).toEqual({ id: 1 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/providers/me");
    expect(init.credentials).toBe("include");
    expect(init.headers["X-XSRF-TOKEN"]).toBeUndefined();
  });

  it("echoes XSRF-TOKEN on unsafe requests and sends JSON", async () => {
    fetchMock.mockResolvedValue(json({ ok: true }));

    await http.http.patch("/providers/me", { title: "Dr" });

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.method).toBe("PATCH");
    expect(init.headers["X-XSRF-TOKEN"]).toBe("tok-1");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ title: "Dr" }));
  });

  it("bootstraps the CSRF cookie before the first unsafe request", async () => {
    cookie = "";
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/auth/csrf") {
        cookie = "XSRF-TOKEN=fresh";
        return new Response(null, { status: 204 });
      }
      return json({});
    });

    await http.http.post("/auth/sign-in", { contact: "a@b.c" });

    expect(fetchMock.mock.calls[0]![0]).toBe("/auth/csrf");
    expect(fetchMock.mock.calls[1]![1].headers["X-XSRF-TOKEN"]).toBe("fresh");
  });

  it("returns undefined for 202 and 204", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 202 }));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    expect(await http.http.post("/auth/codes", {})).toBeUndefined();
    expect(await http.http.post("/me/notifications/read-all")).toBeUndefined();
  });

  it("refreshes once on NOT_SIGNED_IN and retries", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ status: 401, code: "NOT_SIGNED_IN" }, 401))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json({ id: 2 }));

    const res = await http.http.get("/providers/me");

    expect(res).toEqual({ id: 2 });
    expect(fetchMock.mock.calls[1]![0]).toBe("/auth/refresh");
    expect(fetchMock.mock.calls[1]![1].headers["X-XSRF-TOKEN"]).toBe("tok-1");
  });

  it("shares one refresh between concurrent 401s", async () => {
    let refreshed = false;
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/auth/refresh") {
        refreshed = true;
        return new Response(null, { status: 204 });
      }
      return refreshed
        ? json({})
        : json({ status: 401, code: "NOT_SIGNED_IN" }, 401);
    });

    await Promise.all([
      http.http.get("/providers/me"),
      http.http.get("/me/notifications/counts"),
    ]);

    const refreshCalls = fetchMock.mock.calls.filter(
      ([u]) => u === "/auth/refresh",
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it("reports an expired session when the refresh fails", async () => {
    const onSessionExpired = vi.fn();
    http.configureHttp({ onSessionExpired });
    fetchMock
      .mockResolvedValueOnce(json({ status: 401, code: "NOT_SIGNED_IN" }, 401))
      .mockResolvedValueOnce(json({ status: 401, code: "NOT_SIGNED_IN" }, 401));

    await expect(http.http.get("/providers/me")).rejects.toMatchObject({
      status: 401,
      code: "NOT_SIGNED_IN",
    });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it("never refreshes for auth calls or other 401 codes", async () => {
    // A fresh Response per call: a body can only be read once.
    fetchMock.mockImplementation(async () =>
      json({ status: 401, code: "INCORRECT_PASSWORD", detail: "Wrong" }, 401),
    );

    await expect(http.http.post("/auth/sign-in", {})).rejects.toMatchObject({
      code: "INCORRECT_PASSWORD",
      message: "Wrong",
    });
    await expect(http.http.get("/providers/me")).rejects.toMatchObject({
      code: "INCORRECT_PASSWORD",
    });
    expect(fetchMock.mock.calls.some(([u]) => u === "/auth/refresh")).toBe(
      false,
    );
  });

  it("parses validation problems with field messages", async () => {
    fetchMock.mockResolvedValue(
      json(
        {
          status: 400,
          code: "VALIDATION",
          detail: "Check the highlighted fields.",
          fields: [{ field: "nickname", message: "That nickname is taken" }],
          traceId: "t-1",
        },
        400,
      ),
    );

    const error = await failure(http.http.put("/patients/me", {}));

    expect(error).toBeInstanceOf(http.ApiError);
    expect(error.fieldError("nickname")).toBe("That nickname is taken");
    expect(error.fieldError("other")).toBeUndefined();
    expect(error.traceId).toBe("t-1");
  });

  it("reads Retry-After on 429", async () => {
    fetchMock.mockResolvedValue(
      json({ status: 429, code: "RATE_LIMITED", detail: "Slow down" }, 429, {
        "Retry-After": "42",
      }),
    );

    const error = await failure(http.http.post("/auth/codes", {}));

    expect(error.code).toBe("RATE_LIMITED");
    expect(error.retryAfter).toBe(42);
  });

  it("uses the fixed system message for 500 and non-JSON errors", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ status: 500, code: "SYSTEM", detail: "stack" }, 500),
    );
    fetchMock.mockResolvedValueOnce(new Response("<html>", { status: 502 }));

    const a = await failure(http.http.get("/x"));
    const b = await failure(http.http.get("/x"));

    expect(a.message).toBe(http.SYSTEM_ERROR_MESSAGE);
    expect(b.code).toBe("SYSTEM");
    expect(b.status).toBe(502);
  });

  it("builds query strings, skipping empty values and repeating arrays", () => {
    expect(
      http.buildQuery({
        page: 0,
        q: "",
        active: true,
        outcome: ["GMH:Poor", "DEPRESSION:Moderate"],
        none: undefined,
      }),
    ).toBe(
      "?page=0&active=true&outcome=GMH%3APoor&outcome=DEPRESSION%3AModerate",
    );
    expect(http.buildQuery()).toBe("");
  });

  it("uploads multipart without a JSON content type", async () => {
    fetchMock.mockResolvedValue(json({}));
    const form = new FormData();
    form.append("file", new Blob(["x"]), "a.jpg");

    await http.http.upload("/providers/me/photo", form);

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(form);
    expect(init.headers["Content-Type"]).toBeUndefined();
  });

  it("signOut never throws", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(http.signOut()).resolves.toBeUndefined();
  });
});
