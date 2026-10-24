// set once a visitor has been through the /versions invitation screen, so
// it shows only on their first visit rather than on every load of "/"
export const VERSIONS_SEEN_KEY = "justgo_versions_seen";

// localStorage: onboarding wizard progress (pre-sign-in fields only), written
// by /onboard. Cleared on sign-out - after sign-in the server's `me.next`
// decides the step, never this.
export const ONBOARD_STORAGE_KEY = "onboard_progress_v2";

// sessionStorage: referral handle from `?ref=` on the entry URL (set by the
// dwen-wo-ho landing page's "Lock In with @handle" button). Captured only:
// the v2 backend has no referral field, so it is never sent.
export const REFERRAL_STORAGE_KEY = "justgo_referral_v1";

// sessionStorage: NSMQ version code from `?v=` on the entry URL, enrolled in
// after sign-in (see src/lib/version-link.ts).
export const VERSION_LINK_STORAGE_KEY = "justgo_version_v1";
