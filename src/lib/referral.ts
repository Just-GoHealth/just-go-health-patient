import { REFERRAL_STORAGE_KEY } from "@/lib/constants";

// Referral handles arrive as `?ref=<handle>` from the dwen-wo-ho landing
// page's "Lock In with @handle" button. Anything that isn't a plausible
// handle is ignored rather than stored or sent to the backend.
const HANDLE_RE = /^[A-Za-z0-9_.-]{1,40}$/;

export function normalizeReferralHandle(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim().replace(/^@/, "");
  return trimmed && HANDLE_RE.test(trimmed) ? trimmed : null;
}

/** Stores `?ref=` from the current URL for the rest of this browser session. */
export function captureReferralFromUrl(): void {
  if (typeof window === "undefined") return;
  const handle = normalizeReferralHandle(
    new URLSearchParams(window.location.search).get("ref"),
  );
  if (!handle) return;
  try {
    sessionStorage.setItem(REFERRAL_STORAGE_KEY, handle);
  } catch {
    // storage blocked (private mode etc.) - referral is best effort
  }
}

export function getReferralHandle(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return normalizeReferralHandle(
      sessionStorage.getItem(REFERRAL_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

export function clearReferralHandle(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    // nothing to clear
  }
}
