"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { DomeBoard } from "@/components/screening/dome-board";
import { LogoutConfirmModal } from "@/components/shared/logout-confirm-modal";
import {
  ApiError,
  acknowledgeCare,
  getLatestBoard,
  getVersionMembership,
  logout,
  type MembershipResponse,
  type ScreeningBoard,
} from "@/lib/api";
import { MOCK_SCREENING_BOARD } from "../screening/dev-mock";

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
        ? mock === "empty" || mock === "board"
          ? { ...MOCK_MEMBERSHIP, screeningDue: false }
          : MOCK_MEMBERSHIP
        : null,
  );
  // the latest result board - this page IS the day view once a board
  // exists, not a screen you pass through on the way back from /screening.
  // ?mock=board previews it directly (?mock=1's screeningDue:true would
  // otherwise always show the "Take Your Check" CTA ahead of any board)
  const [board, setBoard] = useState<ScreeningBoard | null>(() =>
    mock === "board" ? MOCK_SCREENING_BOARD : null,
  );
  const [ackLoading, setAckLoading] = useState(false);
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
      // 204 (no board yet, or the last run was contest-day and never
      // produces one) is a normal outcome, not an error - board just stays
      // null and the plain countdown/CTA view below shows instead
      try {
        const boardRes = await getLatestBoard(VERSION_CODE);
        if (!cancelled) setBoard(boardRes.data ?? null);
      } catch {
        // non-fatal - the day view works fine with no board
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, mock]);

  async function handleCareAck() {
    if (!board?.screeningId) return;
    setAckLoading(true);
    try {
      await acknowledgeCare(board.screeningId);
      // takes the board off the page and reveals the day view underneath,
      // per the product's own rule for this state (§9.2)
      setBoard(null);
    } catch {
      // best-effort - if this fails the board just stays up for a retry
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
        <Image
          src="/images/logo.webp"
          alt="JustGo Health"
          width={384}
          height={67}
          className="h-6 w-auto invert"
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

        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={loggingOut}
          className="border-line hover:border-gold/60 rounded-full border px-4 py-2 text-xs font-semibold text-white/70 transition-colors hover:text-white disabled:opacity-60"
        >
          {loggingOut ? "Logging out…" : "Log out"}
        </button>
      </div>

      {/* main area */}
      <div
        className={`relative flex flex-1 flex-col items-center gap-6 px-6 py-8 text-center ${
          showBoard ? "overflow-y-auto" : "justify-center"
        }`}
      >
        {/* compact mobile-only header - the left panel above is hidden below sm */}
        <div className="flex items-center gap-3 sm:hidden">
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
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={loggingOut}
            className="border-line hover:border-gold/60 ml-auto rounded-full border px-4 py-2 text-xs font-semibold text-white/70 transition-colors hover:text-white disabled:opacity-60"
          >
            {loggingOut ? "…" : "Log out"}
          </button>
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
            {(board.label || board.head) && (
              <div className="mx-auto max-w-xl text-center">
                {board.label && (
                  <p className="text-gold text-xs font-extrabold tracking-[0.2em] uppercase">
                    {board.label}
                  </p>
                )}
                {board.head && (
                  <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">
                    {board.head}
                  </h1>
                )}
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              {/* disabled - there's no backend endpoint that can give a
                  fresh attempt at an already-submitted window. POST
                  /patients/screenings only takes {versionCode} and its own
                  docs say calling it again just resumes what's in
                  progress, so clicking this used to silently re-land on
                  this same board instead of actually retaking anything */}
              <button
                type="button"
                disabled
                title="Retaking an already-submitted check isn't available yet"
                className="border-line text-muted inline-flex cursor-not-allowed items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold tracking-wide uppercase opacity-60"
              >
                ↻ Retake Testing
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
