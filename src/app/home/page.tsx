"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LogoutConfirmModal } from "@/components/shared/logout-confirm-modal";
import {
  ApiError,
  getVersionMembership,
  logout,
  type MembershipResponse,
} from "@/lib/api";

const VERSION_CODE = "nsmq2026";

// must match onboard/page.tsx's STORAGE_KEY - logging out with stale wizard
// progress still cached would let a later /onboard visit restore straight
// past the sign-in screen
const ONBOARD_STORAGE_KEY = "onboard_progress_v1";

// dev-only shortcut so the day view can be reviewed without a real test
// account — never active in a production build regardless of query string
const MOCK_ENABLED = process.env.NODE_ENV !== "production";

const MOCK_MEMBERSHIP: MembershipResponse = {
  teamId: 7,
  campusId: 42,
  campusName: "Presbyterian Boys Senior High School",
  teamStatus: "ACTIVE",
  versionCode: VERSION_CODE,
  versionLabel: "NSMQ 2026",
  currentWindow: "PRE_LONG",
  countdown: { text: "3 Days", hoursToContest: 72, soon: false, out: false },
  screeningDue: true,
  openScreeningId: "mock-screening-id",
  nextStep: "SCREENING",
};

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageInner />
    </Suspense>
  );
}

function HomePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mock = MOCK_ENABLED ? searchParams.get("mock") : null;
  const [membership, setMembership] = useState<MembershipResponse | null>(
    () =>
      mock
        ? mock === "empty"
          ? { ...MOCK_MEMBERSHIP, screeningDue: false }
          : MOCK_MEMBERSHIP
        : null,
  );
  const [loading, setLoading] = useState(!mock);
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // the cookies are HttpOnly - if the clear request itself failed,
      // there's no client-side fallback to expire them; send the patient
      // to sign-in anyway, where a still-valid session just resumes normally
    } finally {
      try {
        localStorage.removeItem(ONBOARD_STORAGE_KEY);
      } catch {
        // ignore unavailable storage (e.g. private browsing)
      }
      router.push("/onboard");
    }
  }

  useEffect(() => {
    if (mock) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getVersionMembership(VERSION_CODE);
        if (!cancelled) setMembership(res.data ?? null);
      } catch (e) {
        if (cancelled) return;
        // no session at all — this page assumes one, so send them into the
        // real flow instead of showing an empty shell
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          router.push("/onboard");
          return;
        }
        // authenticated but nothing to show yet (e.g. no enrolment) — leave
        // the chrome empty rather than guessing where to send them
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, mock]);

  if (loading) {
    return (
      <div className="bg-ink text-txt flex min-h-screen items-center justify-center">
        <div className="border-gold/30 border-t-gold size-10 animate-spin rounded-full border-4" />
      </div>
    );
  }

  return (
    <div className="bg-ink text-txt relative flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={loggingOut}
        className="border-line hover:border-gold/60 absolute top-6 right-6 rounded-full border px-4 py-2 text-xs font-semibold text-white/70 transition-colors hover:text-white disabled:opacity-60"
      >
        {loggingOut ? "Logging out…" : "Log out"}
      </button>

      <LogoutConfirmModal
        open={confirmOpen}
        loading={loggingOut}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleLogout}
      />

      <div className="flex items-center gap-3">
        {membership?.campusLogo && (
          // eslint-disable-next-line @next/next/no-img-element -- unknown, runtime-supplied host; can't be allowlisted for next/image
          <img
            src={membership.campusLogo}
            alt=""
            width={44}
            height={44}
            className="size-11 rounded-full object-cover"
          />
        )}
        <div className="text-left">
          <p className="font-bold">{membership?.campusName ?? "Your team"}</p>
          {membership?.currentWindow && (
            <p className="text-muted text-xs">{membership.currentWindow}</p>
          )}
        </div>
      </div>

      {membership?.countdown?.text && (
        <div
          className={`inline-flex items-center gap-2 rounded-full border px-5 py-2 font-bold ${
            membership.countdown.soon
              ? "border-no/60 text-no"
              : "border-gold/50 text-gold"
          }`}
        >
          {membership.countdown.text}
        </div>
      )}

      {membership?.screeningDue ? (
        <button
          type="button"
          onClick={() => router.push("/screening")}
          className="land-cta-btn"
        >
          Take Your Check
        </button>
      ) : (
        <p className="text-muted">Nothing due right now — check back soon.</p>
      )}
    </div>
  );
}
