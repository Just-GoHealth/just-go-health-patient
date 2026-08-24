"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import "./screening.css";
import { DomeBoard } from "@/components/screening/dome-board";
import { LogoutConfirmModal } from "@/components/shared/logout-confirm-modal";
import {
  ApiError,
  acknowledgeCare,
  answerScreeningItem,
  getHomeProfile,
  getLatestBoard,
  getVersionMembership,
  logout,
  startOrResumeScreening,
  submitScreening,
  type HomeProfileResponse,
  type MembershipResponse,
  type ScreeningBoard,
  type ScreeningItem,
  type ScreeningRun,
} from "@/lib/api";
import {
  MOCK_SCREENING_BOARD,
  MOCK_SCREENING_BOARD_EMERGENCY,
  MOCK_SCREENING_RUN,
} from "./dev-mock";

// exact thresholds/copy from the legacy scrWord()/scrApply() — the battery
// here tracks how far through the check they are, not an "energy" stat
function scrWord(v: number): string {
  if (v >= 100) return "Proud Of You";
  if (v >= 90) return "Last One";
  if (v >= 75) return "Almost There";
  if (v >= 55) return "This Is Care";
  if (v >= 40) return "Halfway There";
  if (v >= 20) return "Keep Going";
  if (v > 0) return "Good Start";
  return "Start Strong";
}
function scrColor(v: number): string {
  if (v >= 70) return "#2bb673";
  if (v >= 35) return "#e8d4ad";
  return "#ed4b58";
}

// dev-only shortcut so the UI can be reviewed without spending a real test
// account on every pass — never active in a production build regardless of
// the query string
const MOCK_ENABLED = process.env.NODE_ENV !== "production";

const VERSION_CODE = "nsmq2026";
const VERSION_LABEL = "NSMQ 2026";
const LOADING_MIN_MS = 2400;

// the left profile panel — persists across the loading and battery phases
// (not the board, which is a separate full-width layout in the mock)
function LeftPanel({
  profile,
  membership,
  pct,
  onLogoutClick,
}: {
  profile: HomeProfileResponse | null;
  membership: MembershipResponse | null;
  pct: number;
  onLogoutClick: () => void;
}) {
  return (
    <div
      className="wu-left"
      style={
        profile?.photoUrl
          ? {
              backgroundImage: `linear-gradient(180deg, rgba(10,10,12,.28) 0%, rgba(10,10,12,.55) 55%, rgba(10,10,12,.82) 100%), url('${profile.photoUrl}')`,
            }
          : undefined
      }
    >
      {profile?.nickname && <div className="ps-name">{profile.nickname}</div>}

      <div className="ps-batt-wrap">
        <svg className="ps-batt" width="150" height="74" viewBox="0 0 150 74">
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
          <rect x="134" y="26" width="11" height="22" rx="4" fill="#fff" />
          <rect
            x="10"
            y="15"
            width={Math.round(111 * (pct / 100))}
            height="44"
            rx="8"
            fill={scrColor(pct)}
            style={{
              transition:
                "width .55s cubic-bezier(.34,1.56,.64,1), fill .45s ease",
            }}
          />
        </svg>
        <div className="ps-batt-pct">{pct}%</div>
        <div className="ps-batt-label">{scrWord(pct)}</div>
      </div>

      {membership?.campusName && (
        <div className="ps-school">
          {membership.campusLogo && (
            <div className="ps-logo">
              {/* eslint-disable-next-line @next/next/no-img-element -- unknown, runtime-supplied host; can't be allowlisted for next/image */}
              <img src={membership.campusLogo} alt="" />
            </div>
          )}
          <div className="s-name">{membership.campusName}</div>
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

// which item to land on when a run is resumed: the first one without an
// answer, never skipping past a gap
function firstUnanswered(items: ScreeningItem[]): number {
  for (let i = 0; i < items.length; i++) {
    if (items[i].answeredIndex == null) return i;
  }
  return items.length - 1;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const [phase, setPhase] = useState<"loading" | "battery" | "board" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [run, setRun] = useState<ScreeningRun | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [index, setIndex] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [huhOn, setHuhOn] = useState(false);
  const [qflip, setQflip] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [board, setBoard] = useState<ScreeningBoard | null>(null);
  const [ackLoading, setAckLoading] = useState(false);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(
    null,
  );
  const [profile, setProfile] = useState<HomeProfileResponse | null>(() =>
    mock ? { nickname: "You" } : null,
  );
  const [membership, setMembership] = useState<MembershipResponse | null>(
    () => (mock ? { campusName: "Your School" } : null),
  );
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const focusRef = useRef<HTMLDivElement | null>(null);
  const stripRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (mock) return;
    let cancelled = false;
    (async () => {
      try {
        const [profRes, memRes] = await Promise.all([
          getHomeProfile(),
          getVersionMembership(VERSION_CODE),
        ]);
        if (cancelled) return;
        setProfile(profRes.data ?? null);
        setMembership(memRes.data ?? null);
      } catch {
        // non-fatal — the left panel just renders without a name/crest
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mock]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // cookies are HttpOnly — nothing client-side to fall back to if the
      // clear request itself failed; move on and let sign-in resolve it
    } finally {
      try {
        localStorage.removeItem("onboard_progress_v1");
      } catch {
        // ignore unavailable storage
      }
      router.push("/onboard");
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (mock) {
          await wait(LOADING_MIN_MS);
          if (cancelled) return;
          const data = MOCK_SCREENING_RUN;
          setRun(data);
          const initialAnswers = (data.items ?? []).map(
            (it) => it.answeredIndex ?? null,
          );
          setAnswers(initialAnswers);
          setIndex(0);
          setFurthest(0);
          setPhase("battery");
          return;
        }
        const [res] = await Promise.all([
          startOrResumeScreening(VERSION_CODE),
          wait(LOADING_MIN_MS),
        ]);
        if (cancelled) return;
        const data = res.data;
        const items = data?.items ?? [];
        if (!data?.screeningId || !items.length) {
          setPhase("error");
          setErrorMessage("This check couldn't be opened. Please try again.");
          return;
        }
        // resuming a run that's already fully answered (e.g. the tab was
        // refreshed right after the last answer, before this page ever saw
        // the "complete" response) — submit is idempotent, so finish it out
        // and go straight to the board instead of re-showing the last
        // question with its answer already selected
        if (items.every((it) => it.answeredIndex != null)) {
          const boardRes = await submitScreening(data.screeningId);
          if (cancelled) return;
          setBoard(boardRes.data ?? null);
          setPhase("board");
          return;
        }
        setRun(data);
        const initialAnswers = items.map((it) => it.answeredIndex ?? null);
        setAnswers(initialAnswers);
        const start = firstUnanswered(items);
        setIndex(start);
        setFurthest(start);
        setPhase("battery");
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          router.push("/onboard");
          return;
        }
        // the backend may refuse to (re)open a screening that's already
        // been submitted for this window, rather than just returning it
        // fully-answered — if a real scored board exists, show that
        // instead of a dead-end error
        try {
          const boardRes = await getLatestBoard(VERSION_CODE);
          if (cancelled) return;
          if (boardRes.data) {
            setBoard(boardRes.data);
            setPhase("board");
            return;
          }
        } catch {
          // no board either — fall through to the real error below
        }
        setPhase("error");
        setErrorMessage(
          e instanceof ApiError && e.code === "VERSION_PERIOD_CLOSED"
            ? "This season has closed — no new checks can be started."
            : e instanceof ApiError
              ? e.message
              : "Something went wrong opening your check.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, mock]);

  const items = useMemo(() => run?.items ?? [], [run]);
  const current = items[index];
  const answeredCount = useMemo(
    () => answers.filter((a) => a != null).length,
    [answers],
  );
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
    if (!current?.help) return;
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

  async function pick(optionIndex: number, e: React.MouseEvent<HTMLButtonElement>) {
    if (!run?.screeningId || !current?.itemCode || answering) return;
    setAnswering(true);
    const idx = index;
    const emoji = current.options?.[optionIndex]?.emoji ?? "";
    const nextAnswers = [...answers];
    nextAnswers[idx] = optionIndex;
    setAnswers(nextAnswers);
    setTip(null);
    if (emoji) flyEmoji(e.currentTarget, emoji, idx);

    const isLast = nextAnswers.every((a) => a != null);

    try {
      if (!mock) {
        const res = await answerScreeningItem(
          run.screeningId,
          current.itemCode,
          optionIndex,
        );
        if (res.data?.complete) {
          const boardRes = await submitScreening(run.screeningId);
          setBoard(boardRes.data ?? null);
          setPhase("board");
          return;
        }
      } else if (isLast) {
        setBoard(mock === "emergency" ? MOCK_SCREENING_BOARD_EMERGENCY : MOCK_SCREENING_BOARD);
        setPhase("board");
        return;
      }

      let next = idx + 1;
      for (let i = 0; i < next; i++) {
        if (nextAnswers[i] == null) {
          next = i;
          break;
        }
      }
      setIndex(next);
      setFurthest((f) => Math.max(f, next));
      setHuhOn(false);
    } catch {
      // the answer stays selected locally — the strip already shows it as
      // answered, so let the student continue rather than blocking on a
      // single dropped save
    } finally {
      setAnswering(false);
    }
  }

  function goto(i: number) {
    if (i < 0 || i > furthest) return;
    setIndex(i);
    setHuhOn(false);
  }

  async function handleCareAck() {
    if (!board?.screeningId) {
      router.push("/home");
      return;
    }
    setAckLoading(true);
    try {
      await acknowledgeCare(board.screeningId);
    } catch {
      // still move on — the ack is best-effort, not a gate
    } finally {
      router.push("/home");
    }
  }

  if (phase === "loading") {
    return (
      <div className="wu-shell">
        <LeftPanel
          profile={profile}
          membership={membership}
          pct={0}
          onLogoutClick={() => setLogoutConfirmOpen(true)}
        />
        <div className="mh-screen">
          <div className="mh-loading">
            <svg className="mh-load-batt" width="150" height="74" viewBox="0 0 150 74">
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
          <button
            type="button"
            onClick={() => router.push("/home")}
            className="text-muted mt-4 underline"
          >
            Back home
          </button>
        </div>
      </div>
    );
  }

  if (phase === "board" && board) {
    return (
      <div className="board-screen">
        <div className="board-head">
          <p className="board-eyebrow">{board.label}</p>
          <h1 className="board-title">{board.head}</h1>
        </div>

        <DomeBoard
          sections={board.sections ?? []}
          onGetCare={handleCareAck}
          ackLoading={ackLoading}
        />

        {!board.emergency && (
          <button
            type="button"
            onClick={() => router.push("/home")}
            className="land-cta-btn board-continue-btn"
          >
            Continue
          </button>
        )}
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="wu-shell">
      <LeftPanel
        profile={profile}
        membership={membership}
        pct={battPct}
        onLogoutClick={() => setLogoutConfirmOpen(true)}
      />
      <div className="mh-screen">
      <div className="mh-focus" ref={focusRef}>
        <div className="f-kick">
          <span className="f-sec">{current.section ?? "Mental Health"}</span>
        </div>

        {/* the contest countdown - shown here regardless of whether this is
            the student's first check or a retake, same data as the home
            page's countdown pill */}
        {membership?.countdown?.text && (
          <div className="f-when">
            <span className="f-when-pill">{membership.countdown.text}</span>
          </div>
        )}

        <div className="f-title">
          {current.shortName ?? current.name}
          {current.help && (
            <button
              type="button"
              className={`huh-btn${huhOn ? " okay" : ""}`}
              onClick={toggleHuh}
            >
              {huhOn ? "💡 OKAY." : "🤨 HUH?"}
            </button>
          )}
        </div>

        <div className={`f-q${huhOn ? " is-huh" : ""}${qflip ? " qflip" : ""}`}>
          {huhOn ? current.help : current.question}
        </div>

        <div className="mh-opts">
          {(current.options ?? []).map((opt, oi) => (
            <button
              key={oi}
              type="button"
              disabled={answering}
              className={`mh-opt${answers[index] === (opt.index ?? oi) ? " sel" : ""}`}
              onClick={(e) => pick(opt.index ?? oi, e)}
              onMouseEnter={(e) => opt.sub && showTip(e.currentTarget, opt.sub)}
              onMouseLeave={() => setTip(null)}
              onFocus={(e) => opt.sub && showTip(e.currentTarget, opt.sub)}
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
          <div className="mh-bar-title">Your Mental Health · {VERSION_LABEL}</div>
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
              <rect x="134" y="26" width="11" height="22" rx="4" fill="#fff" />
              <rect
                x="10"
                y="15"
                width={Math.round(111 * (battPct / 100))}
                height="44"
                rx="8"
                fill={scrColor(battPct)}
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
            const answered = answers[i] != null;
            const isActive = i === index;
            const emoji = answered
              ? (it.options?.[answers[i] as number]?.emoji ?? "•")
              : isActive
                ? "◆"
                : "•";
            return (
              <button
                key={it.itemCode ?? i}
                type="button"
                ref={(el) => {
                  stripRefs.current[i] = el;
                  if (isActive) activeItemRef.current = el;
                }}
                disabled={i > furthest}
                className={`mh-item ${isActive ? "active" : answered ? "done" : "pending"}`}
                onClick={() => goto(i)}
              >
                <span className="ring">{emoji}</span>
                <span className="nm">{it.shortName ?? it.name}</span>
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
