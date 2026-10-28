/**
 * The MSW handlers: one catch-all that routes same-origin API calls to the
 * mock routes. Anything the mock doesn't know (pages, assets, RSC payloads)
 * gets no response, so it goes to the network as usual. start.js calls these
 * from a patched `fetch`; /me/stream is a fake EventSource there.
 *
 * Data lives in localStorage, so it survives reloads and is shared by every
 * tab of this app. The session (the signed-in account) is localStorage too,
 * standing in for the backend's HttpOnly cookies.
 */
import { HttpResponse, http } from "msw";
import { ApiError, Reply, iso, newId, readUpload } from "./core.js";
import { isWorkableCode, randomAccessCode, setDue } from "./nsmq-engine.js";
import { seed } from "./seed.js";
import * as auth from "./routes/auth.js";
import * as catalogue from "./routes/catalogue.js";
import * as network from "./routes/network.js";
import * as nsmq from "./routes/nsmq.js";
import * as patient from "./routes/patient.js";
import * as provider from "./routes/provider.js";
import * as results from "./routes/results.js";

const DB_KEY = "jg-mock:db:v1";
const SESSION_KEY = "jg-mock:session";

// ---------- Storage ----------

let memory = null;

if (typeof window !== "undefined") {
  // Another tab changed the data: read it again on the next request.
  window.addEventListener("storage", (event) => {
    if (event.key === DB_KEY) memory = null;
  });
}

function saveDb(db) {
  memory = db;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (error) {
    console.warn(
      "[mock api] Couldn't save the mock data (storage full?). Changes last until reload.",
      error,
    );
  }
}

function loadDb() {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      memory = JSON.parse(raw);
      // Data saved before access codes were 9 digits: renumber them in place.
      for (const c of memory.codes) {
        if (!isWorkableCode(c.code)) c.code = randomAccessCode();
      }
      return memory;
    }
  } catch {
    // Unreadable: start again from the seed.
  }
  const db = seed();
  saveDb(db);
  return db;
}

export function readSession() {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeSession(accountId) {
  try {
    if (accountId) localStorage.setItem(SESSION_KEY, accountId);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Private mode without storage: the session just won't stick.
  }
}

/** Controls for the mock panel. */
export const mockControls = {
  db: loadDb,
  reset() {
    writeSession(null);
    saveDb(seed());
  },
  setDue(kind) {
    const db = loadDb();
    setDue(db, kind);
    saveDb(db);
  },
  signOut() {
    writeSession(null);
  },
};

// ---------- Routing ----------

const routes = [];
function route(method, path, handler, access = "any") {
  routes.push({
    method,
    path,
    parts: path.split("/").filter(Boolean),
    handler,
    access,
  });
}
[auth, patient, nsmq, provider, results, catalogue, network].forEach((m) =>
  m.register(route),
);

function match(method, pathname) {
  const segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  let pathMatched = false;
  for (const r of routes) {
    if (r.parts.length !== segments.length) continue;
    const params = {};
    const ok = r.parts.every((part, i) => {
      if (part.startsWith(":")) {
        params[part.slice(1)] = segments[i];
        return true;
      }
      return part === segments[i];
    });
    if (!ok) continue;
    pathMatched = true;
    if (r.method === method) return { route: r, params };
  }
  return pathMatched ? "METHOD" : null;
}

function checkAccess(access, account) {
  if (access === "public") return;
  if (!account)
    throw new ApiError(401, "NOT_SIGNED_IN", "Please sign in to continue.");
  const allowed =
    access === "any" ||
    access === account.role ||
    (access === "STAFF" &&
      (account.role === "PROVIDER" || account.role === "CURATOR"));
  if (!allowed)
    throw new ApiError(403, "FORBIDDEN", "You don't have access to this.");
}

const problem = (status, code, detail, fields) => {
  const traceId = newId().slice(0, 8);
  return HttpResponse.json(
    { status, detail, code, ...(fields?.length ? { fields } : {}), traceId },
    {
      status,
      headers: {
        "Content-Type": "application/problem+json",
        "X-Trace-Id": traceId,
      },
    },
  );
};

function respond(out) {
  if (out instanceof Reply) {
    if (out.body === undefined)
      return new HttpResponse(null, {
        status: out.status,
        headers: out.headers,
      });
    if (typeof out.body === "string")
      return new HttpResponse(out.body, {
        status: out.status,
        headers: out.headers,
      });
    return HttpResponse.json(out.body, {
      status: out.status,
      headers: out.headers,
    });
  }
  if (out === undefined) return new HttpResponse(null, { status: 204 });
  return HttpResponse.json(out);
}

/** Curator changes go in the audit log, like the real backend's AuditController. */
function audit(db, account, request, r, params, body) {
  const [first, , last] = r.parts;
  const entityType = first.replace(/-/g, "_").replace(/S$/i, "").toUpperCase();
  const verb =
    last && !last.startsWith(":")
      ? last.replace(/-/g, "_").toUpperCase()
      : { POST: "CREATED", PATCH: "UPDATED", PUT: "SET", DELETE: "REMOVED" }[
          request.method
        ];
  db.audit.push({
    id: newId(),
    occurredAt: iso(),
    actorAccountId: account.id,
    action: `${entityType}_${verb}`,
    entityType,
    entityId: params.id ?? params.code ?? "",
    campusId:
      first === "campuses" ? (params.id ?? null) : (body?.campusId ?? null),
    summary: `${request.method} ${new URL(request.url).pathname}`,
    changes: body && typeof body === "object" ? JSON.stringify(body) : null,
  });
}

// First path segments of the v2 API (both apps' API_PROXY_PREFIXES). In mock
// mode these never go to a server: an unknown one gets a 501 instead.
const API_PREFIXES = new Set([
  "auth",
  "me",
  "providers",
  "role-categories",
  "campuses",
  "campus-types",
  "results",
  "benchmarks",
  "runs",
  "care-cases",
  "care",
  "treatments",
  "versions",
  "teams",
  "codes",
  "fixtures",
  "programmes",
  "tags",
  "locations",
  "studio",
  "join-requests",
  "roles",
  "patients",
  "cover-pages",
  "icons",
  "team-entries",
  "reach",
  "venues",
  "hosts",
  "audit",
]);

export function isApiPath(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  // `/versions` alone is a page in the patient app; the API is /versions/<code>.
  if (segments[0] === "versions" && segments.length < 2) return false;
  return API_PREFIXES.has(segments[0]);
}

function skip(request, url) {
  const accept = request.headers.get("accept") ?? "";
  return (
    url.origin !== location.origin ||
    url.searchParams.has("_rsc") ||
    request.headers.has("rsc") ||
    accept.includes("text/html") ||
    accept === "text/event-stream"
  );
}

async function handle({ request }) {
  const url = new URL(request.url);
  if (skip(request, url)) return undefined;
  const found = match(request.method, url.pathname);
  if (!found) {
    if (!isApiPath(url.pathname)) return undefined; // a page or asset: let it through
    console.warn(`[mock api] No mock for ${request.method} ${url.pathname}`);
    return problem(
      501,
      "NOT_MOCKED",
      `The mock API doesn't handle ${request.method} ${url.pathname} yet.`,
    );
  }
  if (found === "METHOD")
    return problem(
      405,
      "METHOD_NOT_ALLOWED",
      "That method isn't allowed here.",
    );

  const { route: r, params } = found;
  const db = loadDb();
  const accountId = readSession();
  const account = accountId
    ? db.accounts.find((a) => a.id === accountId)
    : undefined;

  try {
    let body;
    let files;
    const type = request.headers.get("content-type") ?? "";
    if (type.includes("multipart/form-data")) {
      const file = (await request.formData()).get("file");
      files =
        file && typeof file !== "string"
          ? { file: await readUpload(file) }
          : {};
    } else {
      const text = await request.text();
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          throw new ApiError(
            400,
            "MALFORMED_REQUEST",
            "The request body isn't valid JSON.",
          );
        }
      }
    }

    checkAccess(r.access, account);
    const out = r.handler({
      db,
      params,
      query: Object.fromEntries(url.searchParams),
      search: url.searchParams,
      body,
      files,
      account,
      signIn: (id) => writeSession(id),
      signOut: () => writeSession(null),
      setCsrf: () => {
        document.cookie = "XSRF-TOKEN=mock-xsrf-token; path=/; SameSite=Lax";
      },
    });

    if (request.method !== "GET" || r.path === "/results/:id") {
      if (account?.role === "CURATOR" && request.method !== "GET")
        audit(db, account, request, r, params, body);
      saveDb(db);
    }
    return respond(out);
  } catch (error) {
    if (error instanceof ApiError)
      return problem(error.status, error.code, error.detail, error.fields);
    console.error(
      `[mock api] ${request.method} ${url.pathname} crashed`,
      error,
    );
    return problem(
      500,
      "SYSTEM",
      "We're having a little trouble on our end. Please try again.",
    );
  }
}

export const handlers = [http.all("*", handle)];
