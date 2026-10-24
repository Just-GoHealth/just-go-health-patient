"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Button,
  DomeBoard,
  Logo,
  Spinner,
  useCountdown,
} from "@just-gohealth/ui";
import { EditProfileDialog } from "@/components/home/edit-profile-dialog";
import { CarePrompt } from "@/components/nsmq/care-prompt";
import { WaitingRoom } from "@/components/nsmq/waiting-room";
import { ApiErrorText } from "@/components/shared/api-error-text";
import { ctaButtonClass } from "@/components/shared/cta";
import { LogoutConfirmModal } from "@/components/shared/logout-confirm-modal";
import { useToast } from "@/components/shared/toast";
import { signOutPatient } from "@/lib/sign-out";
import { rememberVersionCode } from "@/lib/version-link";
import { toDomeSections } from "@/lib/v2/dome";
import type { ApiError } from "@/lib/v2/http";
import { asApiError, isSignedOut } from "@/lib/v2/errors";
import { KIND_LABEL, formatTimeLeft, secondsUntil } from "@/lib/v2/labels";
import {
  acceptAssent,
  acknowledgeCare,
  getEnrollments,
  getRuns,
  getStatus,
  retakeRun,
} from "@/lib/v2/nsmq";
import { getProfile } from "@/lib/v2/patient";
import { activeEnrollment, latestSubmittedRun } from "@/lib/v2/runs";
import type {
  DueRun,
  EnrollmentStatusView,
  PatientHome,
  StudentRun,
} from "@/lib/v2/types";
import {
  MOCK_STATUS,
  MOCK_SUBMITTED_RUN,
  MOCK_URGENT_RUN,
} from "../screening/dev-mock";

// dev-only shortcut so the day view can be reviewed without a real test
// account — never active in a production build regardless of query string
const MOCK_ENABLED = process.env.NODE_ENV !== "production";

const MOCK_PROFILE = {
  nickname: "You",
  fullName: "You",
  photo: null,
} as unknown as PatientHome;

// ?mock=1 → a check is due; ?mock=board / board1 / urgent → a result board
// (board1: fewer than 3 sections, to check the dome row's empty slots);
// ?mock=empty → nothing due
function mockRun(mock: string | null): StudentRun | null {
  if (mock === "board") return MOCK_SUBMITTED_RUN;
  if (mock === "urgent") return MOCK_URGENT_RUN;
  if (mock === "board1") {
    return {
      ...MOCK_SUBMITTED_RUN,
      sections: MOCK_SUBMITTED_RUN.sections.slice(0, 1),
    };
  }
  return null;
}

const pillClass =
  "px-4 text-xs font-bold tracking-wide text-white/70 uppercase hover:text-white";

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
  const { showToast } = useToast();

  const [profile, setProfile] = useState<PatientHome | null>(() =>
    mock ? MOCK_PROFILE : null,
  );
  const [status, setStatus] = useState<EnrollmentStatusView | null>(() =>
    mock && mock !== "empty"
      ? { ...MOCK_STATUS, due: mock === "1" ? MOCK_STATUS.due : [] }
      : null,
  );
  // the latest submitted run - this page IS the day view once a result
  // exists, not a screen you pass through on the way back from /screening
  const [latestRun, setLatestRun] = useState<StudentRun | null>(() =>
    mockRun(mock),
  );
  const [loading, setLoading] = useState(!mock);
  const [error, setError] = useState<ApiError | null>(null);
  const [ackLoading, setAckLoading] = useState(false);
  const [retaking, setRetaking] = useState(false);
  const [assenting, setAssenting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const kickoff = useCountdown(0);
  const { restart: restartKickoff } = kickoff;
  // the countdown re-renders every second - keep the domes' input stable
  const domeSections = useMemo(
    () => toDomeSections(latestRun?.sections ?? []),
    [latestRun],
  );

  async function handleLogout() {
    setLoggingOut(true);
    // never throws - local progress is dropped either way
    await signOutPatient();
    router.push("/onboard");
  }

  // NSMQ status and runs for the active version. "Which run is due" is
  // worked out when the status is read, so this re-runs when the page comes
  // back into view.
  const loadNsmq = useCallback(async () => {
    const active = activeEnrollment(await getEnrollments());
    if (!active) return;
    if (!active.teamId) {
      // enrolled but no team yet - /onboard's team picker takes it from here
      if (active.joinable) {
        rememberVersionCode(active.versionCode);
        router.push("/onboard");
      }
      return;
    }
    const [st, runs] = await Promise.all([
      getStatus(active.versionCode),
      getRuns(),
    ]);
    setStatus(st);
    restartKickoff(secondsUntil(st.nextKickoff));
    setLatestRun(latestSubmittedRun(runs, active.versionCode));
  }, [router, restartKickoff]);

  useEffect(() => {
    if (mock) return;
    let cancelled = false;
    (async () => {
      try {
        const me = await getProfile();
        if (cancelled) return;
        // not onboarded yet - /onboard routes by `next`
        if (me.next !== "HOME") {
          router.push("/onboard");
          return;
        }
        setProfile(me);
        await loadNsmq();
      } catch (e) {
        if (cancelled) return;
        // no session at all — this page assumes one
        if (isSignedOut(e)) {
          router.push("/onboard");
          return;
        }
        setError(asApiError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, mock, loadNsmq]);

  useEffect(() => {
    if (mock) return;
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      loadNsmq().catch(() => {
        // keep what's on screen; the next return tries again
      });
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [mock, loadNsmq]);

  useEffect(() => {
    if (!mock || !status) return;
    const raf = requestAnimationFrame(() =>
      restartKickoff(secondsUntil(status.nextKickoff)),
    );
    return () => cancelAnimationFrame(raf);
  }, [mock, status, restartKickoff]);

  async function handleRetake() {
    if (!latestRun || mock) return;
    setRetaking(true);
    try {
      const run = await retakeRun(latestRun.id);
      router.push(`/screening?run=${encodeURIComponent(run.id)}`);
    } catch (e) {
      // RUN_CLOSED: the window has passed - its detail says so
      showToast(asApiError(e).message);
    } finally {
      setRetaking(false);
    }
  }

  async function handleCareAck() {
    if (!latestRun) return;
    if (mock) {
      setLatestRun({ ...latestRun, careAcknowledged: true });
      return;
    }
    setAckLoading(true);
    try {
      // takes the board off the page and opens the Waiting Room
      setLatestRun(await acknowledgeCare(latestRun.id));
      showToast("We've opened your day. Come back whenever you're ready.");
    } catch (e) {
      // best-effort - if this fails the board just stays up for a retry
      showToast(asApiError(e).message);
    } finally {
      setAckLoading(false);
    }
  }

  async function handleAssent() {
    if (!status) return;
    setAssenting(true);
    try {
      setStatus(await acceptAssent(status.versionCode));
    } catch (e) {
      showToast(asApiError(e).message);
    } finally {
      setAssenting(false);
    }
  }

  function startRun(due: DueRun) {
    if (!status) return;
    if (due.runId && due.runStatus === "IN_PROGRESS") {
      router.push(`/screening?run=${encodeURIComponent(due.runId)}`);
    } else {
      router.push(
        `/screening?v=${encodeURIComponent(status.versionCode)}&kind=${due.kind}`,
      );
    }
  }

  if (loading) {
    return (
      <div className="app-warm-bg text-txt flex min-h-screen items-center justify-center">
        <Spinner className="text-gold size-10" />
      </div>
    );
  }

  const openDue = (status?.due ?? []).filter(
    (d) => d.runStatus !== "SUBMITTED",
  );
  const showBoard =
    !openDue.length && !!latestRun && !latestRun.careAcknowledged;
  const countdownText =
    status?.nextKickoff && kickoff.secondsLeft > 0
      ? formatTimeLeft(kickoff.secondsLeft)
      : null;
  // inside the last day before kickoff
  const soon = kickoff.secondsLeft > 0 && kickoff.secondsLeft < 86400;
  const campusName = status?.campusName ?? profile?.campus?.fullName ?? null;

  const editButton = profile && !mock && (
    <Button
      variant="link"
      size="sm"
      onClick={() => setEditOpen(true)}
      className="text-muted hover:text-txt h-auto px-0 text-xs font-semibold"
    >
      Edit profile
    </Button>
  );

  return (
    <div className="app-warm-bg text-txt flex min-h-screen">
      <LogoutConfirmModal
        open={confirmOpen}
        loading={loggingOut}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleLogout}
      />
      {editOpen && profile && (
        <EditProfileDialog
          open={editOpen}
          profile={profile}
          onOpenChange={setEditOpen}
          onSaved={(p) => {
            setProfile(p);
            showToast("Profile saved.");
          }}
        />
      )}

      {/* left panel - persists across every state of this page, showing
          time-to-contest */}
      <div className="hidden w-[300px] shrink-0 flex-col justify-between border-r border-white/10 p-8 sm:flex">
        {/* self-start: a flex-col child stretches to fill the cross axis
            by default, which distorted the logo */}
        <Logo
          variant="light"
          className="h-6 w-auto shrink-0 self-start object-contain sm:h-6"
        />

        <div className="flex flex-col items-center gap-4 text-center">
          {countdownText && (
            <div
              className={`text-3xl font-extrabold ${soon ? "text-no" : "text-yes"}`}
            >
              {countdownText}
            </div>
          )}
          {campusName && <p className="font-bold">{campusName}</p>}
          {profile?.classOf && (
            <p className="text-muted text-xs">
              {[profile.classOf, profile.gradeLabel]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>

        {/* grouped so justify-between above treats these as one bottom
            cluster instead of spreading the profile row away from the
            logout button it belongs next to */}
        <div className="flex flex-col gap-3">
          {profile?.nickname && (
            <div className="flex items-center gap-2.5">
              <Avatar
                src={profile.photo?.thumbnailUrl}
                name={profile.fullName || profile.nickname}
                size="sm"
                className="border-line text-txt border bg-transparent font-bold"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{profile.nickname}</p>
                {editButton}
              </div>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={loggingOut}
            className="px-4 text-xs font-semibold text-white/70 hover:text-white"
          >
            {loggingOut ? "Logging out…" : "Log out"}
          </Button>
        </div>
      </div>

      {/* main area */}
      <div
        className={`relative flex flex-1 flex-col items-center gap-6 px-6 py-8 text-center ${
          showBoard ? "overflow-y-auto" : "justify-center"
        }`}
      >
        {/* compact mobile-only header - the left panel above is hidden below
            sm. Two aligned columns (team+retake / profile+care) so each
            action button sits right under what it relates to. */}
        <div className="flex w-full items-start justify-between gap-4 border-b border-white/10 pb-4 sm:hidden">
          <div className="flex flex-col items-start gap-3">
            <div className="text-left">
              <p className="font-bold">{campusName ?? "Your team"}</p>
              {countdownText && (
                <p
                  className={`text-xs font-semibold ${soon ? "text-no" : "text-yes"}`}
                >
                  {countdownText}
                </p>
              )}
            </div>
            {showBoard && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetake}
                disabled={retaking}
                className={pillClass}
              >
                {retaking ? "…" : "↻ Retake Testing"}
              </Button>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-3">
            <div className="flex flex-col items-end gap-1.5">
              {profile?.nickname && (
                <p className="truncate text-xs font-bold">{profile.nickname}</p>
              )}
              {editButton}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={loggingOut}
                className="px-4 text-xs font-semibold text-white/70 hover:text-white"
              >
                {loggingOut ? "…" : "Log out"}
              </Button>
            </div>
            {showBoard && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCareAck}
                disabled={ackLoading}
                className={pillClass}
              >
                {ackLoading ? "…" : "Get Care ♥"}
              </Button>
            )}
          </div>
        </div>

        <ApiErrorText error={error} />

        {status?.assentNeeded ? (
          <div className="flex max-w-xl flex-col items-center gap-4">
            <p className="text-lg font-bold">
              The {status.versionLabel} agreement has changed
            </p>
            {status.assentText && (
              <div className="max-h-60 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 px-5 py-4 text-left text-sm leading-relaxed whitespace-pre-line text-white/80">
                {status.assentText}
              </div>
            )}
            <Button
              onClick={handleAssent}
              disabled={assenting}
              className={ctaButtonClass}
            >
              {assenting ? "One sec…" : "I agree"}
            </Button>
          </div>
        ) : openDue.length > 0 ? (
          <div className="flex flex-col items-center gap-5">
            {openDue.map((due) => (
              <div
                key={due.obligationKey}
                className="flex flex-col items-center gap-3"
              >
                <p className="text-muted text-sm">{KIND_LABEL[due.kind]}</p>
                <Button
                  onClick={() => startRun(due)}
                  className={ctaButtonClass}
                >
                  {due.runStatus === "IN_PROGRESS"
                    ? "Continue Your Check"
                    : "Take Your Check"}
                </Button>
              </div>
            ))}
          </div>
        ) : showBoard && latestRun ? (
          <div className="flex w-full max-w-6xl flex-1 flex-col gap-6">
            {/* hidden on mobile - those same two buttons already live in the
                compact header above, grouped under their related column */}
            <div className="hidden items-center justify-between gap-3 sm:flex">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetake}
                disabled={retaking}
                className={pillClass}
              >
                {retaking ? "…" : "↻ Retake Testing"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCareAck}
                disabled={ackLoading}
                className={pillClass}
              >
                {ackLoading ? "…" : "Get Care ♥"}
              </Button>
            </div>

            {/* styled by care.urgency only - the triage tag is never shown */}
            {latestRun.care && <CarePrompt care={latestRun.care} />}

            <div className="flex flex-1 items-center justify-center">
              {/* no onGetCare: the header-level Get Care pills above
                  cover it */}
              <DomeBoard sections={domeSections} />
            </div>

            <p className="text-muted/70 text-xs">
              <strong className="text-txt">Get Care</strong> opens your day.
            </p>
          </div>
        ) : (
          <div className="flex w-full flex-col items-center gap-6">
            <p className="text-muted">
              Nothing due right now — check back soon.
            </p>
            {latestRun?.careAcknowledged && !mock && (
              <WaitingRoom runId={latestRun.id} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
