"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import "./screening.css";
import {
  BatteryMeter,
  Button,
  DomeBoard,
  batteryColor,
  useCountdown,
} from "@just-gohealth/ui";
import { CarePrompt } from "@/components/nsmq/care-prompt";
import { ctaButtonClass } from "@/components/shared/cta";
import { LogoutConfirmModal } from "@/components/shared/logout-confirm-modal";
import { useToast } from "@/components/shared/toast";
import { signOutPatient } from "@/lib/sign-out";
import { toDomeSections } from "@/lib/v2/dome";
import { asApiError, isSignedOut } from "@/lib/v2/errors";
import { formatTimeLeft, secondsUntil } from "@/lib/v2/labels";
import {
  answer,
  getEnrollments,
  getRun,
  startRun,
  submitRun,
} from "@/lib/v2/nsmq";
import { getProfile } from "@/lib/v2/patient";
import { activeEnrollment, firstUnansweredIndex } from "@/lib/v2/runs";
import type {
  InstrumentItem,
  NsmqKind,
  PatientHome,
  StudentRun,
} from "@/lib/v2/types";
import { MOCK_RUN, MOCK_SUBMITTED_RUN, MOCK_URGENT_RUN } from "./dev-mock";

// dev-only shortcut so the UI can be reviewed without spending a real test
// account on every pass — never active in a production build regardless of
// the query string
const MOCK_ENABLED = process.env.NODE_ENV !== "production";

const VERSION_LABEL = "NSMQ 2026";
const LOADING_MIN_MS = 2400;
const KINDS: NsmqKind[] = ["D1", "T3", "TPLUS"];

// the left profile panel — persists across the loading and battery phases
// (not the board, which is a separate full-width layout in the mock)
function LeftPanel({
  profile,
  pct,
  onLogoutClick,
}: {
  profile: PatientHome | null;
  pct: number;
  onLogoutClick: () => void;
}) {
  const photoUrl = profile?.photo?.url;
  return (
    <div
      className="wu-left"
      style={
        photoUrl
          ? {
              backgroundImage: `linear-gradient(180deg, rgba(10,10,12,.28) 0%, rgba(10,10,12,.55) 55%, rgba(10,10,12,.82) 100%), url('${photoUrl}')`,
            }
          : undefined
      }
    >
      {profile?.nickname && <div className="ps-name">{profile.nickname}</div>}

      {/* the battery tracks how far through the check they are, not an
          "energy" stat - copy/colour thresholds live in the shared
          batteryWord/batteryColor */}
      <BatteryMeter percent={pct} size="lg" className="ps-batt-wrap" />

      {profile?.campus && (
        <div className="ps-school">
          <div className="s-name">{profile.campus.fullName}</div>
        </div>
      )}

      <button type="button" className="nsmq-out" onClick={onLogoutClick}>
        <svg viewBox="0 0 24 24">
          <path d="M15 17.5 19.5 12 15 6.5" />
          <path d="M19.5 12H9" />
          <path d="M12 3.5H6.2A2.2 2.2 0 0 0 4 5.7v12.6a2.2 2.2 0 0 0 2.2 2.2H12" />
        </svg>
        <span>Log out</span>
      </button>
    </div>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sortedItems(run: StudentRun | null): InstrumentItem[] {
  return [...(run?.questionnaire?.items ?? [])].sort(
    (a, b) => a.position - b.position,
  );
}

// itemCode → optionId, restored from the run's saved `answers`
function answerMap(run: StudentRun): Record<string, string> {
  return Object.fromEntries(run.answers.map((a) => [a.itemCode, a.optionId]));
}

export default function ScreeningPage() {
  return (
    <Suspense fallback={null}>
      <ScreeningPageInner />
    </Suspense>
  );
}

function ScreeningPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mock = MOCK_ENABLED ? searchParams.get("mock") : null;
  const runIdParam = searchParams.get("run");
  const versionParam = searchParams.get("v");
  const kindParam = searchParams.get("kind");
  const [phase, setPhase] = useState<"loading" | "battery" | "board" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [run, setRun] = useState<StudentRun | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [huhOn, setHuhOn] = useState(false);
  const [qflip, setQflip] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [board, setBoard] = useState<StudentRun | null>(null);
  const { showToast } = useToast();
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(
    null,
  );
  const [profile, setProfile] = useState<PatientHome | null>(() =>
    mock
      ? ({
          nickname: "You",
          campus: { fullName: "Your School" },
        } as unknown as PatientHome)
      : null,
  );
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  // time left in this run's window (T+ has no closesAt)
  const closes = useCountdown(0);
  const { restart: restartCloses } = closes;

  const focusRef = useRef<HTMLDivElement | null>(null);
  const stripRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (mock) return;
    let cancelled = false;
    getProfile()
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        // non-fatal — the left panel just renders without a name/school
      });
    return () => {
      cancelled = true;
    };
  }, [mock]);

  async function handleLogout() {
    setLoggingOut(true);
    await signOutPatient();
    router.push("/onboard");
  }

  // a fully answered or already submitted run belongs on /home's board
  async function finishRun(r: StudentRun) {
    if (r.status === "IN_PROGRESS") await submitRun(r.id);
    router.push("/home");
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (mock) {
          await wait(LOADING_MIN_MS);
          if (cancelled) return;
          setRun(MOCK_RUN);
          setAnswers({});
          setIndex(0);
          setFurthest(0);
          restartCloses(secondsUntil(MOCK_RUN.closesAt));
          setPhase("battery");
          return;
        }
        const load = async (): Promise<StudentRun> => {
          if (runIdParam) return getRun(runIdParam);
          const versionCode =
            versionParam ??
            activeEnrollment(await getEnrollments())?.versionCode;
          if (!versionCode) throw new Error("No NSMQ version to check in for");
          const kind = KINDS.find((k) => k === kindParam);
          // starts the run due now, or returns the one already started
          return startRun(versionCode, kind);
        };
        const [data] = await Promise.all([load(), wait(LOADING_MIN_MS)]);
        if (cancelled) return;
        if (data.status === "SUBMITTED") {
          router.push("/home");
          return;
        }
        if (data.status === "EXPIRED") {
          setPhase("error");
          setErrorMessage(
            "This check's window has closed — no new answers can be saved.",
          );
          return;
        }
        const items = sortedItems(data);
        if (!items.length) {
          setPhase("error");
          setErrorMessage("This check couldn't be opened. Please try again.");
          return;
        }
        const saved = answerMap(data);
        // resuming a run that's already fully answered (e.g. the tab was
        // refreshed right after the last answer) — finish it out and go
        // straight to the board instead of re-showing the last question
        if (items.every((it) => saved[it.code])) {
          await submitRun(data.id);
          router.push("/home");
          return;
        }
        setRun(data);
        setAnswers(saved);
        const start = firstUnansweredIndex(
          items.map((it) => it.code),
          new Set(Object.keys(saved)),
        );
        setIndex(start);
        setFurthest(start);
        restartCloses(secondsUntil(data.closesAt));
        setPhase("battery");
      } catch (e) {
        if (cancelled) return;
        if (isSignedOut(e)) {
          router.push("/onboard");
          return;
        }
        // NOTHING_DUE, NOT_ON_TEAM, ASSENT_REQUIRED… - the detail says why
        setPhase("error");
        setErrorMessage(asApiError(e).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, mock, runIdParam, versionParam, kindParam, restartCloses]);

  const items = useMemo(() => sortedItems(run), [run]);
  const sectionTitles = useMemo(
    () =>
      Object.fromEntries(
        (run?.questionnaire?.sections ?? []).map((s) => [s.code, s.title]),
      ),
    [run],
  );
  const current = items[index];
  const answeredCount = items.filter((it) => answers[it.code]).length;
  const battPct = items.length
    ? Math.round((answeredCount / items.length) * 100)
    : 0;

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [index]);

  function toggleHuh() {
    if (!current?.helpText) return;
    setHuhOn((v) => !v);
    setQflip(true);
    setTimeout(() => setQflip(false), 460);
  }

  function showTip(el: HTMLElement, text: string) {
    const focus = focusRef.current;
    if (!focus || !text) return;
    const f = focus.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    setTip({
      text,
      x: b.left - f.left + b.width / 2,
      y: b.top - f.top - 10,
    });
  }

  function flyEmoji(fromEl: HTMLElement, emoji: string, targetIndex: number) {
    const target = stripRefs.current[targetIndex];
    const a = fromEl.getBoundingClientRect();
    const b = target ? target.getBoundingClientRect() : a;
    const fly = document.createElement("div");
    fly.className = "fly-emoji";
    fly.textContent = emoji;
    fly.style.left = `${a.left + a.width / 2 - 17}px`;
    fly.style.top = `${a.top + a.height / 2 - 17}px`;
    document.body.appendChild(fly);
    requestAnimationFrame(() => {
      fly.style.transform = `translate(${b.left + b.width / 2 - a.left - a.width / 2}px, ${
        b.top + b.height / 2 - a.top - a.height / 2
      }px) scale(.8)`;
      fly.style.opacity = "0";
    });
    setTimeout(() => fly.remove(), 560);
  }

  function moveOn(nextAnswers: Record<string, string>, from: number) {
    // the next unanswered item, never skipping past a gap
    const gap = items.findIndex((it, i) => i <= from && !nextAnswers[it.code]);
    const next = gap !== -1 ? gap : Math.min(from + 1, items.length - 1);
    setIndex(next);
    setFurthest((f) => Math.max(f, next));
    setHuhOn(false);
  }

  async function pick(
    optionId: string,
    e: React.MouseEvent<HTMLButtonElement>,
  ) {
    if (!run || !current || answering) return;
    setAnswering(true);
    const idx = index;
    const itemCode = current.code;
    const previous = answers;
    const emoji = current.options.find((o) => o.id === optionId)?.emoji ?? "";
    const nextAnswers = { ...answers, [itemCode]: optionId };
    setAnswers(nextAnswers);
    setTip(null);
    if (emoji) flyEmoji(e.currentTarget, emoji, idx);

    const isLast = items.every((it) => nextAnswers[it.code]);

    try {
      if (mock) {
        if (isLast) {
          setBoard(mock === "urgent" ? MOCK_URGENT_RUN : MOCK_SUBMITTED_RUN);
          setPhase("board");
          return;
        }
        moveOn(nextAnswers, idx);
        return;
      }
      // saved as it's picked; the answer list comes back with the run
      const saved = await answer(run.id, itemCode, optionId);
      const savedAnswers = answerMap(saved);
      setAnswers(savedAnswers);
      if (items.every((it) => savedAnswers[it.code])) {
        await finishRun(saved);
        return;
      }
      moveOn(savedAnswers, idx);
    } catch (err) {
      const error = asApiError(err);
      if (isSignedOut(error)) {
        router.push("/onboard");
        return;
      }
      if (error.code === "RUN_SUBMITTED") {
        router.push("/home");
        return;
      }
      if (error.code === "RUN_CLOSED") {
        setPhase("error");
        setErrorMessage(error.message);
        return;
      }
      if (error.code === "ANSWERS_MISSING") {
        // the submit found a gap - reload the saved answers and go to it
        try {
          const fresh = await getRun(run.id);
          const freshAnswers = answerMap(fresh);
          setAnswers(freshAnswers);
          const gap = firstUnansweredIndex(
            items.map((it) => it.code),
            new Set(Object.keys(freshAnswers)),
          );
          setIndex(gap);
          setFurthest((f) => Math.max(f, gap));
        } catch {
          // keep what's on screen
        }
        showToast(error.message);
        return;
      }
      // the answer wasn't saved - put the strip back as it was
      setAnswers(previous);
      showToast(error.message);
    } finally {
      setAnswering(false);
    }
  }

  function goto(i: number) {
    if (i < 0 || i > furthest) return;
    setIndex(i);
    setHuhOn(false);
  }

  if (phase === "loading") {
    return (
      <div className="wu-shell">
        <LeftPanel
          profile={profile}
          pct={0}
          onLogoutClick={() => setLogoutConfirmOpen(true)}
        />
        <div className="mh-screen">
          <div className="mh-loading">
            <svg
              className="mh-load-batt"
              width="150"
              height="74"
              viewBox="0 0 150 74"
            >
              <rect
                x="3"
                y="8"
                width="128"
                height="58"
                rx="14"
                fill="rgba(255,255,255,.05)"
                stroke="#fff"
                strokeWidth="3"
              />
              <rect x="134" y="26" width="11" height="22" rx="4" fill="#fff" />
              <rect
                className="mh-load-fill"
                x="10"
                y="15"
                width="20"
                height="44"
                rx="8"
                fill="var(--color-yes)"
              />
            </svg>
            <div className="mh-load-title">Reading the vibes…</div>
            <div className="mh-load-sub">
              your mental health check for {VERSION_LABEL} · no judgment zone
            </div>
          </div>
        </div>
        <LogoutConfirmModal
          open={logoutConfirmOpen}
          loading={loggingOut}
          onCancel={() => setLogoutConfirmOpen(false)}
          onConfirm={handleLogout}
        />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="mh-screen items-center justify-center px-6 text-center">
        <div>
          <p className="text-no font-semibold">{errorMessage}</p>
          <Button
            variant="link"
            onClick={() => router.push("/home")}
            className="text-muted mt-4 h-auto px-0 text-base font-normal underline"
          >
            Back home
          </Button>
        </div>
      </div>
    );
  }

  // dev mock only: real submits land on /home's board
  if (phase === "board" && board) {
    return (
      <div className="board-screen">
        <div className="board-head">
          <p className="board-eyebrow">D-1</p>
          <h1 className="board-title">One day before the contest</h1>
        </div>
        {board.care && <CarePrompt care={board.care} className="mb-6" />}
        <DomeBoard
          sections={toDomeSections(board.sections, {
            questionnaire: MOCK_RUN.questionnaire,
            answers: board.answers,
          })}
        />
        <Button
          onClick={() => router.push("/home?mock=board")}
          className={`${ctaButtonClass} board-continue-btn`}
        >
          Continue
        </Button>
      </div>
    );
  }

  if (!current) return null;

  const closesText =
    run?.closesAt && closes.secondsLeft > 0
      ? `Closes in ${formatTimeLeft(closes.secondsLeft)}`
      : null;

  return (
    <div className="wu-shell">
      <LeftPanel
        profile={profile}
        pct={battPct}
        onLogoutClick={() => setLogoutConfirmOpen(true)}
      />
      <div className="mh-screen">
        <div className="mh-focus" ref={focusRef}>
          <div className="f-kick">
            <span className="f-sec">
              {sectionTitles[current.sectionCode] ?? "Mental Health"}
            </span>
          </div>

          {/* time left in this run's window */}
          {closesText && (
            <div className="f-when">
              <span className="f-when-pill">{closesText}</span>
            </div>
          )}

          <div className="f-title">
            {current.name ?? current.code}
            {current.helpText && (
              <button
                type="button"
                className={`huh-btn${huhOn ? "okay" : ""}`}
                onClick={toggleHuh}
              >
                {huhOn ? "💡 OKAY." : "🤨 HUH?"}
              </button>
            )}
          </div>

          <div className={`f-q${huhOn ? "is-huh" : ""}${qflip ? "qflip" : ""}`}>
            {huhOn ? current.helpText : current.prompt}
          </div>

          <div className="mh-opts">
            {[...current.options]
              .sort((a, b) => a.position - b.position)
              .map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={answering}
                  className={`mh-opt${answers[current.code] === opt.id ? "sel" : ""}`}
                  onClick={(e) => pick(opt.id, e)}
                  onMouseEnter={(e) =>
                    opt.description && showTip(e.currentTarget, opt.description)
                  }
                  onMouseLeave={() => setTip(null)}
                  onFocus={(e) =>
                    opt.description && showTip(e.currentTarget, opt.description)
                  }
                  onBlur={() => setTip(null)}
                >
                  <span className="em">{opt.emoji}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
          </div>

          {tip && (
            <div
              className="mh-tip on"
              style={{ left: tip.x, top: tip.y, ["--tipx" as string]: "50%" }}
            >
              {tip.text}
            </div>
          )}
        </div>

        <div className="mh-bar">
          <div className="mh-bar-head">
            <div className="mh-bar-title">
              Your Mental Health · {VERSION_LABEL}
            </div>
            <div className="mh-tracker">
              <span>{Math.min(index + 1, items.length)}</span>
              <small>/{items.length}</small>
            </div>
            <div className="mh-bar-batt">
              <svg width="52" height="26" viewBox="0 0 150 74">
                <rect
                  x="3"
                  y="8"
                  width="128"
                  height="58"
                  rx="14"
                  fill="rgba(0,0,0,.35)"
                  stroke="#fff"
                  strokeWidth="3"
                />
                <rect
                  x="134"
                  y="26"
                  width="11"
                  height="22"
                  rx="4"
                  fill="#fff"
                />
                <rect
                  x="10"
                  y="15"
                  width={Math.round(111 * (battPct / 100))}
                  height="44"
                  rx="8"
                  fill={batteryColor(battPct)}
                  style={{
                    transition:
                      "width .55s cubic-bezier(.34,1.56,.64,1), fill .45s ease",
                  }}
                />
              </svg>
              <span>{battPct}%</span>
            </div>
          </div>
          <div className="mh-strip">
            {items.map((it, i) => {
              const picked = answers[it.code];
              const isActive = i === index;
              const emoji = picked
                ? (it.options.find((o) => o.id === picked)?.emoji ?? "•")
                : isActive
                  ? "◆"
                  : "•";
              return (
                <button
                  key={it.code}
                  type="button"
                  ref={(el) => {
                    stripRefs.current[i] = el;
                    if (isActive) activeItemRef.current = el;
                  }}
                  disabled={i > furthest}
                  className={`mh-item ${isActive ? "active" : picked ? "done" : "pending"}`}
                  onClick={() => goto(i)}
                >
                  <span className="ring">{emoji}</span>
                  <span className="nm">{it.name ?? it.code}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <LogoutConfirmModal
        open={logoutConfirmOpen}
        loading={loggingOut}
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={handleLogout}
      />
    </div>
  );
}
