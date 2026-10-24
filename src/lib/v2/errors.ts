import { ApiError } from "./http";

const NETWORK_MESSAGE =
  "We couldn't reach JustGo Health. Check your connection and try again.";

/** Any thrown value as an ApiError, so every screen handles one error type. */
export function asApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  return new ApiError({ status: 0, code: "NETWORK", detail: NETWORK_MESSAGE });
}

/** A client-side check that failed before any call (shown like a server error). */
export function localError(detail: string): ApiError {
  return new ApiError({ status: 0, code: "CLIENT", detail });
}

// Codes a screen branches on or that explain themselves; anything else is
// unexpected and shows its traceId in small print for support.
const EXPECTED = new Set([
  "CLIENT",
  "VALIDATION",
  "NOT_SIGNED_IN",
  "RATE_LIMITED",
  "STALE",
  "CONTENT_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "CONTACT_IN_USE",
  "INCORRECT_PASSWORD",
  "CODE_INCORRECT",
  "CODE_EXPIRED",
  "CODE_LOCKED",
  "GRANT_EXPIRED",
  "NICKNAME_TAKEN",
  "CAMPUS_LOCKED",
  "STEP_NOT_READY",
  "ONBOARDING_INCOMPLETE",
  "IMAGE_UNSUPPORTED",
  "IMAGE_TOO_LARGE",
  "IMAGE_UNREADABLE",
  "VERSION_CLOSED",
  "CAMPUS_NOT_ELIGIBLE",
  "CODE_INVALID",
  "ALREADY_ON_TEAM",
  "ASSENT_REQUIRED",
  "NOT_ON_TEAM",
  "NOTHING_DUE",
  "RUN_CLOSED",
  "RUN_SUBMITTED",
  "ANSWERS_MISSING",
]);

export function isUnexpected(error: ApiError): boolean {
  return !EXPECTED.has(error.code);
}

/**
 * The error to show as a general line under a form: null when every field it
 * names is already shown beside its own input on this screen.
 */
export function formLevelError(
  error: ApiError | null | undefined,
  shownFields: readonly string[],
): ApiError | null {
  if (!error) return null;
  if (!error.fields.length) return error;
  return error.fields.every((f) => shownFields.includes(f.field))
    ? null
    : error;
}

export function isSignedOut(e: unknown): boolean {
  return e instanceof ApiError && e.code === "NOT_SIGNED_IN";
}
