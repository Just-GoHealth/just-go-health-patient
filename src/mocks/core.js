/**
 * Mock API helpers: ids, problems (RFC 9457 errors), paging, validation and
 * images. Runs in the browser (MSW), so no Node APIs.
 */

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export const iso = (ms = Date.now()) => new Date(ms).toISOString();

/** Stable UUID-shaped id from a seed key, so seeded URLs survive a reset. */
export function sid(key) {
  let hex = "";
  for (let round = 0; hex.length < 32; round++) {
    let h = 2166136261 ^ round;
    for (let i = 0; i < key.length; i++) {
      h = Math.imul(h ^ key.charCodeAt(i), 16777619);
    }
    hex += (h >>> 0).toString(16).padStart(8, "0");
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export const newId = () => crypto.randomUUID();

// ---------- Replies ----------

export class Reply {
  constructor(status, body, headers = {}) {
    this.status = status;
    this.body = body;
    this.headers = headers;
  }
}
export const created = (body) => new Reply(201, body);
export const accepted = () => new Reply(202);
export const noContent = () => new Reply(204);

// ---------- Problems ----------

export class ApiError extends Error {
  constructor(status, code, detail, fields) {
    super(detail);
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.fields = fields;
  }
}

export function fail(status, code, detail, fields) {
  throw new ApiError(status, code, detail, fields);
}
export const notFound = (what = "that") =>
  fail(404, "NOT_FOUND", `We couldn't find ${what}.`);
export const forbidden = (detail = "You don't have access to this.") =>
  fail(403, "FORBIDDEN", detail);
export function invalid(field, message) {
  fail(400, "VALIDATION", message, [{ field, message }]);
}
export const nameTaken = (field) =>
  fail(409, "NAME_TAKEN", "That name is already in use.", [
    { field, message: "That name is already in use." },
  ]);

/** 409 STALE when the client sent an old `version`; otherwise bumps it. */
export function checkVersion(entity, body) {
  if (body?.version != null && body.version !== entity.version) {
    fail(409, "STALE", "Someone else changed this. Reload to see the latest.");
  }
  entity.version += 1;
}

// ---------- Values ----------

export const int = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};
export const bool = (value) =>
  value === "true" ? true : value === "false" ? false : undefined;

export function paginate(items, query = {}) {
  const page = Math.max(0, int(query.page, 0));
  const size = Math.min(100, Math.max(1, int(query.size, 20)));
  return {
    items: items.slice(page * size, page * size + size),
    page,
    size,
    total: items.length,
  };
}

/** Pages a list, mapping only the items on the page. */
export function pageOf(items, query, map) {
  const page = paginate(items, query);
  return { ...page, items: page.items.map(map) };
}

/** Case-insensitive "contains" over a list of names. */
export const matchesQ = (names, q) =>
  !q ||
  names.some((n) => n && n.toLowerCase().includes(String(q).toLowerCase()));

export function initials(name = "") {
  return name
    .split(/\s+/)
    .filter((w) => w && !/^(dr|mr|mrs|ms|prof|rev)\.?$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

/** Trimmed, non-blank, length-checked text field. */
export function requireText(body, field, max = 100) {
  const value =
    typeof body?.[field] === "string"
      ? body[field].trim().replace(/[ \t]+/g, " ")
      : "";
  if (!value) invalid(field, "This field is required");
  if (value.length > max) invalid(field, `Use ${max} characters or fewer`);
  return value;
}

/** Optional text: undefined = unchanged, "" = cleared (null). */
export function optionalText(body, field, max = 1000) {
  const value = body?.[field];
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") invalid(field, "Enter text");
  if (value.length > max) invalid(field, `Use ${max} characters or fewer`);
  return value.trim() || null;
}

/** Throws NAME_TAKEN when a name is already used by another item (ignoring case). */
export function ensureUnique(list, names, namesOf, field, self) {
  const keys = names.filter(Boolean).map((n) => n.toLowerCase());
  const clash = list.some(
    (item) =>
      item !== self &&
      namesOf(item).some((n) => n && keys.includes(n.toLowerCase())),
  );
  if (clash) nameTaken(field);
}

/** Applies the keys present in `body` onto `target`. */
export function assign(target, body, keys) {
  for (const key of keys) {
    if (body?.[key] !== undefined) target[key] = body[key];
  }
}

// ---------- Images ----------

const PALETTE = [
  "#0E7C66",
  "#1D4ED8",
  "#B45309",
  "#7C3AED",
  "#BE123C",
  "#0F766E",
  "#4338CA",
  "#A16207",
];

/** A coloured square with initials, as an inline SVG (no image host needed). */
export function avatar(label, seed = label) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  const bg = PALETTE[h % PALETTE.length];
  const text = label.slice(0, 3).replace(/[<&>"]/g, "");
  const size = text.length > 2 ? 72 : 96;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="${bg}"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="700" fill="#ffffff">${text}</text></svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return { url, thumbnailUrl: url };
}

const MAX_IMAGE = 5 * 1024 * 1024;

function sniffImage(bytes) {
  const ascii = (from, to) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Reads a multipart `file` part before the handler runs (handlers stay synchronous). */
export async function readUpload(file) {
  const buffer = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buffer.length; i += 0x8000) {
    binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
  }
  return {
    size: buffer.length,
    mime: sniffImage(buffer),
    base64: btoa(binary),
  };
}

/** The uploaded `file` part as an Image (a data: URL, so it shows without a CDN). */
export function imageFromUpload(files) {
  const file = files?.file;
  if (!file) invalid("file", "Choose a photo to upload");
  if (file.size > MAX_IMAGE) {
    fail(
      413,
      "IMAGE_TOO_LARGE",
      "That photo is over 5 MB. Choose a smaller one.",
    );
  }
  if (!file.mime)
    fail(415, "IMAGE_UNSUPPORTED", "Use a JPEG, PNG or WEBP photo.");
  const url = `data:${file.mime};base64,${file.base64}`;
  return { url, thumbnailUrl: url };
}

// ---------- Seeded randomness ----------

/** mulberry32: the same seed gives the same "random" data on every reset. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
