// set once a visitor has been through the /versions invitation screen, so
// it shows only on their first visit rather than on every load of "/"
export const VERSIONS_SEEN_KEY = "justgo_versions_seen";

// localStorage: onboarding wizard progress, written by /onboard. /home clears
// it on logout - leaving stale progress cached would let a later /onboard
// visit restore straight past the sign-in screen.
export const ONBOARD_STORAGE_KEY = "onboard_progress_v1";

// sessionStorage: the board returned by the screening submit, stashed by
// /screening and read once by /home. GET /patients/screenings/latest returns
// the just-submitted board for every window (contest day included), so this
// is only a bridge against brief propagation lag between that write and
// /home's read right after the redirect.
export const CARRIED_BOARD_KEY = "screening_carried_board_v1";

// sessionStorage: referral handle from `?ref=` on the entry URL (set by the
// dwen-wo-ho landing page's "Lock In with @handle" button), sent with signup.
export const REFERRAL_STORAGE_KEY = "justgo_referral_v1";
