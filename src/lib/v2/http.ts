/**
 * Backend v2 HTTP client (see V2-MIGRATION.md items 1–2).
 *
 * - Sessions are HttpOnly cookies owned by the backend (`access_token`, `refresh_token`
 *   with Path=/auth). The browser must reach the API on this app's own origin, proxied
 *   at the ROOT path (next.config rewrites), so every call sends `credentials: "include"`.
 * - CSRF: `GET /auth/csrf` sets the readable `XSRF-TOKEN` cookie; every unsafe request
 *   echoes it in `X-XSRF-TOKEN` (sign-in and sign-up included).
 * - On `401 NOT_SIGNED_IN` one shared `POST /auth/refresh` runs, then the request is
 *   retried once. Two refreshes in parallel would reuse the rotating refresh token, which
 *   the backend treats as a leak and ends the session — so refresh is single-flight.
 * - Errors are RFC 9457 problems: branch on `code`, show `detail`.
 */

export type FieldProblem = { field: string; message: string };

export type Problem = {
  status: number;
  detail?: string;
  code?: string;
  fields?: FieldProblem[];
  traceId?: string;
};

export const SYSTEM_ERROR_MESSAGE =
  "We're having a little trouble on our end. Please try again.";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: FieldProblem[];
  readonly traceId?: string;
  /** Seconds to wait, from `Retry-After` on `429 RATE_LIMITED`. */
  readonly retryAfter?: number;

  constructor(problem: Problem, retryAfter?: number) {
    const code = problem.code ?? (problem.status >= 500 ? "SYSTEM" : "UNKNOWN");
    const detail =
      code === "SYSTEM" || !problem.detail
        ? SYSTEM_ERROR_MESSAGE
        : problem.detail;
    super(detail);
    this.name = "ApiError";
    this.status = problem.status;
    this.code = code;
    this.fields = problem.fields ?? [];
    this.traceId = problem.traceId;
    this.retryAfter = retryAfter;
  }

  /** Message for one form field, from `fields[]` on `400 VALIDATION`. */
  fieldError(field: string): string | undefined {
    return this.fields.find((f) => f.field === field)?.message;
  }
}

type SessionOptions = {
  /** Called once when the session can't be refreshed (go to sign-in). */
  onSessionExpired?: () => void;
};

let options: SessionOptions = {};

export function configureHttp(next: SessionOptions): void {
  options = { ...options, ...next };
}

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Calls that must never trigger a refresh-and-retry.
const NO_REFRESH = [
  "/auth/refresh",
  "/auth/sign-in",
  "/auth/sign-out",
  "/auth/csrf",
  "/auth/lookup",
  "/auth/verify",
  "/auth/codes",
  "/auth/recovery",
  "/auth/password",
  "/auth/claim",
];

function baseUrl(): string {
  // Browser: same origin (proxied at the root). Server: talk to the API directly.
  if (typeof window !== "undefined") return "";
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://justgo.up.railway.app"
  ).replace(/\/+$/, "");
}

export function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

let csrfPromise: Promise<void> | null = null;

/** Makes sure the XSRF-TOKEN cookie exists. Safe to call many times. */
export function ensureCsrf(): Promise<void> {
  if (readCookie("XSRF-TOKEN")) return Promise.resolve();
  if (!csrfPromise) {
    csrfPromise = fetch(`${baseUrl()}/auth/csrf`, { credentials: "include" })
      .then(() => undefined)
      .finally(() => {
        csrfPromise = null;
      });
  }
  return csrfPromise;
}

let refreshPromise: Promise<boolean> | null = null;

/** Single-flight refresh. Resolves true when the session was renewed. */
export function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      await ensureCsrf();
      const res = await fetch(`${baseUrl()}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: csrfHeader(),
      });
      return res.ok;
    })()
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function csrfHeader(): Record<string, string> {
  const token = readCookie("XSRF-TOKEN");
  return token ? { "X-XSRF-TOKEN": token } : {};
}

export type Query = Record<
  string,
  string | number | boolean | null | undefined | (string | number)[]
>;

export type RequestOptions = {
  query?: Query;
  /** JSON body (ignored when `form` is set). */
  body?: unknown;
  /** Multipart body, e.g. a photo upload. */
  form?: FormData;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

export function buildQuery(query?: Query): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, String(v)));
    } else {
      params.append(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function toApiError(res: Response): Promise<ApiError> {
  let problem: Problem = { status: res.status };
  try {
    const body = (await res.json()) as Partial<Problem>;
    problem = { ...body, status: body.status ?? res.status };
  } catch {
    // Non-JSON error body (proxy error page etc.)
  }
  const retryAfterHeader = res.headers.get("Retry-After");
  const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : undefined;
  return new ApiError(
    problem,
    Number.isFinite(retryAfter) ? retryAfter : undefined,
  );
}

async function send(
  method: string,
  path: string,
  opts: RequestOptions,
): Promise<Response> {
  if (UNSAFE.has(method)) await ensureCsrf();
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(UNSAFE.has(method) ? csrfHeader() : {}),
    ...opts.headers,
  };
  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  return fetch(`${baseUrl()}${path}${buildQuery(opts.query)}`, {
    method,
    credentials: "include",
    headers,
    body,
    signal: opts.signal,
  });
}

/** Performs a v2 API call and returns the parsed JSON (undefined for 202/204). */
export async function request<T>(
  method: string,
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  let res = await send(method, path, opts);

  if (res.status === 401 && !NO_REFRESH.some((p) => path.startsWith(p))) {
    const problem = await Promise.resolve()
      .then(() => res.clone().json())
      .catch(() => ({}) as Problem);
    if ((problem as Problem).code === "NOT_SIGNED_IN") {
      if (await refreshSession()) {
        res = await send(method, path, opts);
      } else {
        options.onSessionExpired?.();
      }
    }
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 202 || res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const http = {
  get: <T>(path: string, opts?: RequestOptions) =>
    request<T>("GET", path, opts),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>("POST", path, { ...opts, body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>("PUT", path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>("PATCH", path, { ...opts, body }),
  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>("DELETE", path, opts),
  upload: <T>(path: string, form: FormData, method: "PUT" | "POST" = "PUT") =>
    request<T>(method, path, { form }),
};

/** Ends the session on the server (clears the cookies). Never throws. */
export async function signOut(): Promise<void> {
  try {
    await request<void>("POST", "/auth/sign-out");
  } catch {
    // Cookies may already be gone; local clean-up still happens.
  }
}
