"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { DomeBoard } from "@/components/screening/dome-board";
import { LogoutConfirmModal } from "@/components/shared/logout-confirm-modal";
import { Toast, useToast } from "@/components/shared/toast";
import {
  ApiError,
  acknowledgeCare,
  getHomeProfile,
  getLatestBoard,
  getVersionMembership,
  logout,
  retakeScreening,
  type HomeProfileResponse,
  type MembershipResponse,
  type ScreeningBoard,
} from "@/lib/api";
import { MOCK_SCREENING_BOARD } from "../screening/dev-mock";

const VERSION_CODE = "nsmq2026";

// must match onboard/page.tsx's STORAGE_KEY - logging out with stale wizard
// progress still cached would let a later /onboard visit restore straight
// past the sign-in screen
const ONBOARD_STORAGE_KEY = "onboard_progress_v1";

// must match screening/page.tsx's key. GET /patients/screenings/latest now
// returns the just-submitted board for every window, contest day included
// (backend fix - it used to deliberately 204 on contest day). This carried
// copy is just a bridge against any brief propagation lag between that
// write and the read right below, not the primary path anymore.
const CARRIED_BOARD_KEY = "screening_carried_board_v1";

function readCarriedBoard(): ScreeningBoard | null {
  try {
    const raw = sessionStorage.getItem(CARRIED_BOARD_KEY);
    return raw ? (JSON.parse(raw) as ScreeningBoard) : null;
  } catch {
    return null;
  }
}

function clearCarriedBoard() {
  try {
    sessionStorage.removeItem(CARRIED_BOARD_KEY);
  } catch {
    // ignore unavailable storage
  }
}

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
        ? mock === "empty" || mock === "board" || mock === "board1"
          ? { ...MOCK_MEMBERSHIP, screeningDue: false }
          : MOCK_MEMBERSHIP
        : null,
  );
  // the latest result board - this page IS the day view once a board
  // exists, not a screen you pass through on the way back from /screening.
  // ?mock=board previews it directly (?mock=1's screeningDue:true would
  // otherwise always show the "Take Your Check" CTA ahead of any board).
  // ?mock=board1 previews a board with fewer than 3 real sections, to
  // check the dome row's empty-slot padding (see DomeBoard/EmptyDomeSlot).
  const [board, setBoard] = useState<ScreeningBoard | null>(() =>
    mock === "board"
      ? MOCK_SCREENING_BOARD
      : mock === "board1"
        ? { ...MOCK_SCREENING_BOARD, sections: MOCK_SCREENING_BOARD.sections?.slice(0, 1) }
        : null,
  );
  const [profile, setProfile] = useState<HomeProfileResponse | null>(() =>
    mock ? { nickname: "You" } : null,
  );
  const [ackLoading, setAckLoading] = useState(false);
  const [retaking, setRetaking] = useState(false);
  const [loading, setLoading] = useState(!mock);
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast, showToast } = useToast();

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
      // 204 (no board yet, or the last run was contest-day and never
      // produces one) is a normal outcome, not an error - board just stays
      // null and the plain countdown/CTA view below shows instead
      try {
        const boardRes = await getLatestBoard(VERSION_CODE);
        const liveBoard = boardRes.data ?? null;
        if (liveBoard) clearCarriedBoard();
        if (!cancelled) setBoard(liveBoard ?? readCarriedBoard());
      } catch {
        // non-fatal - the day view works fine with no board
        if (!cancelled) setBoard(readCarriedBoard());
      }
      try {
        const profRes = await getHomeProfile();
        if (!cancelled) setProfile(profRes.data ?? null);
      } catch {
        // non-fatal - the logout corner just renders without a name/photo
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, mock]);

  async function handleRetake() {
    if (!board?.screeningId || mock) return;
    setRetaking(true);
    try {
      await retakeScreening(board.screeningId);
      router.push("/screening");
    } catch (e) {
      if (e instanceof ApiError && e.code === "SCREENING_WINDOW_CLOSED") {
        showToast("This window has closed — a new check isn't available.");
      } else if (e instanceof ApiError && e.code === "SCREENING_NOT_SUBMITTED") {
        // the current attempt is still open rather than submitted - just
        // go resume it instead of treating this as a failure
        router.push("/screening");
      } else {
        showToast("Something went wrong. Please try again.");
      }
    } finally {
      setRetaking(false);
    }
  }

  async function handleCareAck() {
    if (!board?.screeningId) return;
    setAckLoading(true);
    try {
      await acknowledgeCare(board.screeningId);
      // takes the board off the page and reveals the day view underneath,
      // per the product's own rule for this state (§9.2)
      setBoard(null);
      clearCarriedBoard();
      showToast("We've opened your day. Come back whenever you're ready.");
    } catch {
      // best-effort - if this fails the board just stays up for a retry
      showToast("Something went wrong. Please try again.");
    } finally {
      setAckLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="app-warm-bg text-txt flex min-h-screen items-center justify-center">
        <div className="border-gold/30 border-t-gold size-10 animate-spin rounded-full border-4" />
      </div>
    );
  }

  const showBoard = !membership?.screeningDue && !!board?.sections?.length;

  return (
    <div className="app-warm-bg text-txt flex min-h-screen">
      <Toast toast={toast} />

      <LogoutConfirmModal
        open={confirmOpen}
        loading={loggingOut}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleLogout}
      />

      {/* left panel - persists across every state of this page, same role
          as the screening battery's left panel but showing time-to-contest
          instead of quiz progress, since that's what's relevant here */}
      <div className="hidden w-[300px] shrink-0 flex-col justify-between border-r border-white/10 p-8 sm:flex">
        {/* self-start: a flex-col child stretches to fill the cross axis
            (full container width) by default, which was forcing this box
            far wider than the logo's real ratio and letting object-fit's
            default "fill" distort the pixels to match - the wrong width/
            height props were a red herring, this was the actual cause */}
        <Image
          src="/images/logo.webp"
          alt="JustGo Health"
          width={384}
          height={67}
          className="h-6 w-auto shrink-0 self-start object-contain invert"
        />

        <div className="flex flex-col items-center gap-4 text-center">
          {membership?.countdown?.text && (
            <div
              className={`text-3xl font-extrabold ${
                membership.countdown.soon ? "text-no" : "text-yes"
              }`}
            >
              {membership.countdown.text}
            </div>
          )}
          {membership?.campusName && (
            <div className="flex flex-col items-center gap-2">
              {membership.campusLogo && (
                // eslint-disable-next-line @next/next/no-img-element -- unknown, runtime-supplied host; can't be allowlisted for next/image
                <img
                  src={membership.campusLogo}
                  alt=""
                  width={44}
                  height={44}
                  className="size-11 rounded-full object-cover"
                />
              )}
              <p className="font-bold">{membership.campusName}</p>
            </div>
          )}
        </div>

        {/* grouped so justify-between above treats these as one bottom
            cluster (tightly spaced) instead of spreading the profile row
            away from the logout button it belongs next to */}
        <div className="flex flex-col gap-3">
          {profile?.nickname && (
            <div className="flex items-center gap-2.5">
              {profile.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- unknown, runtime-supplied host; can't be allowlisted for next/image
                <img
                  src={profile.photoUrl}
                  alt=""
                  width={32}
                  height={32}
                  className="size-8 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="border-line flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold uppercase">
                  {profile.nickname.charAt(0)}
                </div>
              )}
              <p className="truncate text-sm font-bold">{profile.nickname}</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={loggingOut}
            className="border-line hover:border-gold/60 rounded-full border px-4 py-2 text-xs font-semibold text-white/70 transition-colors hover:text-white disabled:opacity-60"
          >
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      </div>

      {/* main area */}
      <div
        className={`relative flex flex-1 flex-col items-center gap-6 px-6 py-8 text-center ${
          showBoard ? "overflow-y-auto" : "justify-center"
        }`}
      >
        {/* compact mobile-only header - the left panel above is hidden below
            sm. Two aligned columns (branding+retake / profile+care) so each
            action button sits right under what it relates to, instead of
            floating on its own row with a big gap on either side of it. */}
        <div className="flex w-full items-start justify-between gap-4 border-b border-white/10 pb-4 sm:hidden">
          <div className="flex flex-col items-start gap-3">
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
                {membership?.countdown?.text && (
                  <p
                    className={`text-xs font-semibold ${
                      membership.countdown.soon ? "text-no" : "text-yes"
                    }`}
                  >
                    {membership.countdown.text}
                  </p>
                )}
              </div>
            </div>
            {showBoard && board && (
              <button
                type="button"
                onClick={handleRetake}
                disabled={retaking}
                className="border-line hover:border-gold/60 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold tracking-wide whitespace-nowrap text-white/70 uppercase transition-colors hover:text-white disabled:opacity-60"
              >
                {retaking ? "…" : "↻ Retake Testing"}
              </button>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-3">
            <div className="flex flex-col items-end gap-1.5">
              {profile?.nickname && (
                <p className="truncate text-xs font-bold">{profile.nickname}</p>
              )}
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={loggingOut}
                className="border-line hover:border-gold/60 rounded-full border px-4 py-2 text-xs font-semibold text-white/70 whitespace-nowrap transition-colors hover:text-white disabled:opacity-60"
              >
                {loggingOut ? "…" : "Log out"}
              </button>
            </div>
            {showBoard && board && (
              <button
                type="button"
                onClick={handleCareAck}
                disabled={ackLoading}
                className="border-line hover:border-gold/60 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold tracking-wide whitespace-nowrap text-white/70 uppercase transition-colors hover:text-white disabled:opacity-60"
              >
                {ackLoading ? "…" : "Get Care ♥"}
              </button>
            )}
          </div>
        </div>

        {membership?.screeningDue ? (
          <button
            type="button"
            onClick={() => router.push("/screening")}
            className="land-cta-btn"
          >
            Take Your Check
          </button>
        ) : showBoard && board ? (
          <div className="flex w-full max-w-6xl flex-1 flex-col gap-6">
            {/* no separate "D-1 / One day before the contest" heading here
                on purpose - the left panel's countdown is the one timing
                message on this page now, since board.label/head can be
                worded inconsistently with it (real example: "Scheduled"
                vs "One day before the contest" for the same state) */}
            {/* hidden on mobile - those same two buttons already live in the
                compact header above, grouped under their related column */}
            <div className="hidden items-center justify-between gap-3 sm:flex">
              <button
                type="button"
                onClick={handleRetake}
                disabled={retaking}
                className="border-line hover:border-gold/60 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold tracking-wide text-white/70 uppercase transition-colors hover:text-white disabled:opacity-60"
              >
                {retaking ? "…" : "↻ Retake Testing"}
              </button>
              <button
                type="button"
                onClick={handleCareAck}
                disabled={ackLoading}
                className="border-line hover:border-gold/60 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold tracking-wide text-white/70 uppercase transition-colors hover:text-white disabled:opacity-60"
              >
                {ackLoading ? "…" : "Get Care ♥"}
              </button>
            </div>

            <div className="flex flex-1 items-center justify-center">
              <DomeBoard
                sections={board.sections ?? []}
                onGetCare={handleCareAck}
                ackLoading={ackLoading}
                showInlineGetCare={false}
              />
            </div>

            <p className="text-muted/70 text-xs">
              <strong className="text-txt">Get Care</strong> opens your day.
            </p>
          </div>
        ) : (
          <p className="text-muted">Nothing due right now — check back soon.</p>
        )}
      </div>
    </div>
  );
}
