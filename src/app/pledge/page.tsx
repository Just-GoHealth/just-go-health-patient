"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { LockIcon } from "@/components/landing/icons";
import "./pledge.css";

const STANZAS: string[][] = [
  [
    "We, at JustGo Health, promise on our honour",
    "to give every Ghanaian student",
    "the best possible mental health",
    "and the chance to live life to the fullest.",
  ],
  [
    "We pledge ourselves to the service of students,",
    "to care for those who suffer in silence,",
    "those who feel depressed, alone, or without hope,",
    "and remind them they are never alone.",
  ],
  [
    "Through our blood, our work, and our toil,",
    "we will help every student pursue their dreams,",
    "reach their potential, and achieve their best,",
    "without mental health standing in their way.",
  ],
  [
    "We pledge ourselves in all things",
    "to protect the privacy and dignity of every student,",
    "to earn their trust and care with compassion,",
    "and to care for ourselves as we care for others.",
  ],
  [
    "We promise to keep showing up,",
    "for every student, on every campus,",
    "until every student knows they matter,",
    "their life matters, and their future matters.",
    "So help us God.",
  ],
];

const INITIAL_ROSTER = [
  {
    name: "Kwabena Baadu Prince",
    role: "Chief Executive Officer (CEO)",
    years: "6 years ago",
  },
  {
    name: "Patrick Twumasi Yeboah",
    role: "Chief Design Officer (CDO)",
    years: "6 years ago",
  },
  {
    name: "Dr. Obed Ofori Nyarko",
    role: "Chief Medical Officer (CMO)",
    years: "6 years ago",
  },
  {
    name: "Bernard Ograh",
    role: "Chief Technology Officer (CTO)",
    years: "2 years ago",
  },
  {
    name: "Dr. Nathaniel Nii Codjoe",
    role: "Medical Advisor",
    years: "2 years ago",
  },
  {
    name: "Dr. Jimmy Newton Stephen",
    role: "Medical Advisor",
    years: "2 years ago",
  },
  { name: "Rutherford Otu", role: "Data Analyst", years: "2 years ago" },
  { name: "Setornam Dede Koku", role: "Icon", years: "1 year ago" },
];

const STANZA_OFFSETS = STANZAS.reduce<number[]>((acc, stanza, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + STANZAS[i - 1].length);
  return acc;
}, []);

const OTHERS_COUNT = 689;
const STEP = 3000;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const FEMALE_VOICE_RE =
  /female|zira|susan|samantha|karen|moira|tessa|fiona|serena|victoria|hazel|aria|jenny|michelle|catherine|amy|emma|joanna|salli|kendra|ivy|nicole|libby|sonia|maisie/i;
const VOICE_LANG_ORDER = [
  /en[-_]GH/i,
  /en[-_]NG/i,
  /en[-_]KE/i,
  /en[-_]ZA/i,
  /en[-_]GB/i,
  /en[-_]IN/i,
];

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  if (!voices.length) return null;
  const isMale = (v: SpeechSynthesisVoice) => !FEMALE_VOICE_RE.test(v.name);
  for (const re of VOICE_LANG_ORDER) {
    const maleHit = voices.filter((v) => re.test(v.lang) && isMale(v));
    if (maleHit.length) return maleHit[0];
    const anyHit = voices.filter((v) => re.test(v.lang));
    if (anyHit.length) return anyHit[0];
  }
  const en = voices.filter((v) => /^en/i.test(v.lang) && isMale(v));
  return en[0] ?? voices[0] ?? null;
}

type SignedRow = { name: string; role: string; years: string; mine?: boolean };

export default function PledgePage() {
  const lines = useMemo(() => STANZAS.flat(), []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const signedRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const iRef = useRef(-1);
  const runningRef = useRef(false);
  const listeningRef = useRef(false);
  const atSigRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const toastTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [nowIndex, setNowIndex] = useState(-1);
  const [listeningOn, setListeningOn] = useState(false);
  const [sigWhite, setSigWhite] = useState(false);
  const [sigCaption, setSigCaption] = useState("");
  const [sigOn, setSigOn] = useState(false);
  const [entered, setEntered] = useState(false);

  const [roster, setRoster] = useState<SignedRow[]>(() =>
    INITIAL_ROSTER.map((r) => ({ ...r })),
  );
  const [signed, setSigned] = useState(false);
  const [name, setName] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [toast, setToast] = useState<{ msg: string; on: boolean } | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return () => cancelAnimationFrame(raf);
    }
    voiceRef.current = pickVoice();
    const onVoices = () => {
      voiceRef.current = pickVoice();
    };
    window.speechSynthesis.addEventListener("voiceschanged", onVoices);
    return () => {
      cancelAnimationFrame(raf);
      window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      toastTimers.current.forEach(clearTimeout);
      try {
        window.speechSynthesis?.cancel();
      } catch {}
    };
  }, []);

  function clearTimer() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  function hush() {
    try {
      window.speechSynthesis?.cancel();
    } catch {}
  }

  function centre(n: number) {
    if (atSigRef.current) return;
    const scroll = scrollRef.current;
    const ln = lineRefs.current[n];
    if (!scroll || !ln) return;
    const st = ln.parentElement;
    if (!st) return;
    const c = scroll.getBoundingClientRect();
    const target =
      st.getBoundingClientRect().height > c.height * 0.55 ? ln : st;
    const r = target.getBoundingClientRect();
    const delta = r.top - c.top - (c.height - r.height) / 2;
    if (Math.abs(delta) < 2) return;
    scroll.scrollBy({ top: delta, behavior: "smooth" });
  }

  function light(n: number) {
    setNowIndex(n);
    centre(n);
  }

  function breath(n: number) {
    const st = lineRefs.current[n]?.parentElement;
    const nx = lineRefs.current[n + 1]?.parentElement;
    return st && nx && st !== nx ? 1100 : 340;
  }

  function litRows() {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const c = scroll.getBoundingClientRect();
    const mark = c.top + c.height * 0.55;
    rowRefs.current.forEach((el) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.top < c.bottom - 12) el.classList.add("seen");
      el.classList.toggle("now", r.top <= mark && r.bottom > c.top);
    });
  }

  function openSig() {
    if (atSigRef.current) return;
    atSigRef.current = true;
    runningRef.current = false;
    clearTimer();
    hush();
    listeningRef.current = false;
    setListeningOn(false);
    setNowIndex(lines.length);
    setSigWhite(true);
  }

  function closeSig() {
    if (!atSigRef.current) return;
    atSigRef.current = false;
    setSigWhite(false);
  }

  function onScroll() {
    const scroll = scrollRef.current;
    const signedEl = signedRef.current;
    if (!scroll || !signedEl) return;
    const r = signedEl.getBoundingClientRect();
    const c = scroll.getBoundingClientRect();
    if (r.top < c.bottom - 40) openSig();
    else closeSig();
    litRows();
  }

  function finish() {
    runningRef.current = false;
    listeningRef.current = false;
    clearTimer();
    hush();
    setListeningOn(false);
    setNowIndex(lines.length);
    setTimeout(() => {
      openSig();
      signedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(litRows, 800);
    }, 900);
  }

  function goTo(n: number) {
    if (n < 0 || n >= lines.length) return;
    clearTimer();
    hush();
    iRef.current = n;
    light(n);
    if (!runningRef.current) return;
    if (listeningRef.current) speak();
    else timerRef.current = setTimeout(advance, STEP);
  }

  function advance() {
    if (iRef.current + 1 >= lines.length) {
      finish();
      return;
    }
    goTo(iRef.current + 1);
  }

  function speak() {
    hush();
    if (typeof window === "undefined" || !window.speechSynthesis) {
      timerRef.current = setTimeout(advance, STEP);
      return;
    }
    try {
      const utter = new SpeechSynthesisUtterance(lines[iRef.current]);
      if (voiceRef.current) {
        utter.voice = voiceRef.current;
        utter.lang = voiceRef.current.lang;
      }
      utter.rate = 0.7;
      utter.pitch = 0.68;
      utter.volume = 1;
      const gap = breath(iRef.current);
      utter.onend = () => {
        if (listeningRef.current && runningRef.current) {
          timerRef.current = setTimeout(advance, gap);
        }
      };
      utter.onerror = () => {
        if (listeningRef.current && runningRef.current) {
          timerRef.current = setTimeout(advance, STEP);
        }
      };
      window.speechSynthesis.speak(utter);
    } catch {
      timerRef.current = setTimeout(advance, STEP);
    }
  }

  function reset() {
    runningRef.current = false;
    clearTimer();
    hush();
    listeningRef.current = false;
    iRef.current = -1;
    setNowIndex(-1);
    setListeningOn(false);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    atSigRef.current = false;
    setSigWhite(false);
  }

  function handleLineClick(k: number) {
    runningRef.current = true;
    goTo(k);
  }

  function handleListenClick() {
    const turningOn = !listeningRef.current;
    listeningRef.current = turningOn;
    setListeningOn(turningOn);
    if (turningOn) {
      if (iRef.current >= lines.length - 1 && !runningRef.current) reset();
      runningRef.current = true;
      goTo(iRef.current < 0 ? 0 : iRef.current);
    } else {
      hush();
      clearTimer();
      if (runningRef.current) timerRef.current = setTimeout(advance, STEP);
    }
  }

  function showToast(msg: string) {
    toastTimers.current.forEach(clearTimeout);
    setToast({ msg, on: false });
    toastTimers.current = [
      setTimeout(() => setToast({ msg, on: true }), 16),
      setTimeout(
        () => setToast((prev) => (prev ? { ...prev, on: false } : prev)),
        4200,
      ),
      setTimeout(() => setToast(null), 4800),
    ];
  }

  function handleSignSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setShakeKey((k) => k + 1);
      return;
    }
    setRoster((prev) => [
      { name: trimmed, role: "Also cares", years: "Just Now", mine: true },
      ...prev,
    ]);
    setSigned(true);
    const dt = new Date();
    setSigCaption(
      `Signed - ${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`,
    );
    setSigOn(true);
    showToast(
      "Thank you for believing every Ghanaian student deserves the best mental health.",
    );
  }

  function handleSignButtonClick() {
    if (signed) return;
    openSig();
    signedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => {
      litRows();
      nameInputRef.current?.focus({ preventScroll: true });
    }, 640);
  }

  return (
    <div className={`pledge-screen ${entered ? "pl-entering" : ""}`}>
      <div className="pl-photo">
        <Image
          src="/images/pledge-nkrumah.jpg"
          alt="Kwame Nkrumah"
          fill
          sizes="(max-width: 900px) 100vw, 40vw"
          style={{ objectFit: "cover" }}
        />
        <Link href="/" className="pl-mark" aria-label="Back to JustGo Health">
          <svg
            className="bk-arw"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 5l-7 7 7 7" />
          </svg>
          <span className="bk-logo" aria-hidden />
        </Link>
        <span className="pl-cap">Osagyefo Dr Kwame Nkrumah · 1957</span>
      </div>

      <div className={`pl-right ${sigWhite ? "sig-white" : ""}`}>
        <Link href="/" className="pl-lockin" aria-label="Lock in">
          <span className="pl-lock-ic">
            <LockIcon className="size-[1em]" />
          </span>
          <span>LOCK IN</span>
        </Link>

        <h1 className="pl-h1">
          Our Pledge to{" "}
          <em>
            The Motherland <span className="flag">🇬🇭</span>
          </em>
        </h1>
        <span className="pl-rule" />

        <div className="pl-scroll" ref={scrollRef} onScroll={onScroll}>
          <div className="pl-body">
            {STANZAS.map((stanza, si) => (
              <p className="pl-st" key={si}>
                {stanza.map((text, li) => {
                  const idx = STANZA_OFFSETS[si] + li;
                  return (
                    <span
                      key={idx}
                      ref={(el) => {
                        lineRefs.current[idx] = el;
                      }}
                      className={`pl-l ${idx < nowIndex ? "read" : ""} ${idx === nowIndex ? "now" : ""}`}
                      onClick={() => handleLineClick(idx)}
                    >
                      {text}
                    </span>
                  );
                })}
              </p>
            ))}
            <div className={`pl-sig ${sigOn ? "on" : ""}`}>{sigCaption}</div>
          </div>

          <section className="pl-signed" ref={signedRef} aria-label="Signed by">
            <h2 className="pl-signed-h">Signed by:</h2>
            <div className="pl-roster">
              <div className="pl-rhead">
                <span />
                <span>People</span>
                <span>Role</span>
                <span>Since</span>
              </div>

              {!signed && (
                <form
                  className={`pl-signform ${shakeKey ? "shake" : ""}`}
                  key={shakeKey}
                  onSubmit={handleSignSubmit}
                >
                  <span className="pl-num">1</span>
                  <span className="pl-inwrap">
                    <input
                      ref={nameInputRef}
                      type="text"
                      placeholder="Your name"
                      autoComplete="name"
                      maxLength={46}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="pl-inbtn"
                      aria-label="Sign the pledge"
                      disabled={!name.trim()}
                    >
                      <PenIcon />
                      <span>Sign</span>
                      <ArrowRightIcon className="pl-arw" />
                    </button>
                  </span>
                  <span className="pl-rl">Also cares</span>
                  <span className="pl-yr">Just Now</span>
                </form>
              )}

              {roster.map((r, k) => (
                <div
                  key={`${r.name}-${k}`}
                  ref={(el) => {
                    rowRefs.current[k] = el;
                  }}
                  className={`pl-sgn seen ${r.mine ? "pl-mine" : ""}`}
                >
                  <span className="pl-num">{k + 1}</span>
                  <span className="pl-nm">{r.name}</span>
                  <span className="pl-rl">{r.role}</span>
                  <span className="pl-yr">{r.years}</span>
                </div>
              ))}

              <div className="pl-others">
                and <b>{OTHERS_COUNT}</b> others
              </div>
            </div>
          </section>
        </div>

        <button
          type="button"
          className={`pl-btn pl-listen ${listeningOn ? "on" : ""}`}
          onClick={handleListenClick}
          aria-label="Listen to the pledge"
        >
          {listeningOn ? <PauseIcon /> : <PlayIcon />}
          <span>Listen</span>
        </button>

        <button
          type="button"
          className={`pl-btn pl-sign ${signed ? "done" : ""}`}
          onClick={handleSignButtonClick}
          aria-label="Sign the pledge"
        >
          <PenIcon />
          <span>{signed ? "Signed" : "Sign"}</span>
        </button>

        {toast && (
          <div className={`pl-toast ${toast.on ? "on" : ""}`}>{toast.msg}</div>
        )}
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg className="ic-play" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.2v13.6L19 12z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="ic-pause" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 5h3.4v14H7zM13.6 5H17v14h-3.4z" />
    </svg>
  );
}

function PenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 20.4h18v1.6H3zM16.9 2.6a1.6 1.6 0 0 1 2.3 0l2.2 2.2a1.6 1.6 0 0 1 0 2.3l-11 11-5 1.2 1.2-5z" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}
