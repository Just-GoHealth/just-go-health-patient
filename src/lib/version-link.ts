import { VERSION_LINK_STORAGE_KEY } from "@/lib/constants";

// The NSMQ version a student was invited to, from `?v=<code>` on the entry
// URL (or the landing page's own LOCK IN button). After sign-in the app calls
// POST /me/enrollments/{code} with it - identity knows nothing about versions.

/** The version the landing page's "LOCK IN FOR NSMQ 2026" button enrolls in. */
export const DEFAULT_VERSION_CODE = "nsmq2026";

const CODE_RE = /^[A-Za-z0-9_-]{1,40}$/;

export function rememberVersionCode(code: string | null | undefined): void {
  const trimmed = code?.trim();
  if (!trimmed || !CODE_RE.test(trimmed) || typeof window === "undefined") {
    return;
  }
  try {
    sessionStorage.setItem(VERSION_LINK_STORAGE_KEY, trimmed);
  } catch {
    // storage blocked - the student can still onboard without NSMQ
  }
}

/** Stores `?v=` from the current URL for the rest of this browser session. */
export function captureVersionFromUrl(): void {
  if (typeof window === "undefined") return;
  rememberVersionCode(new URLSearchParams(window.location.search).get("v"));
}

export function getVersionCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(VERSION_LINK_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearVersionCode(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(VERSION_LINK_STORAGE_KEY);
  } catch {
    // nothing to clear
  }
}
