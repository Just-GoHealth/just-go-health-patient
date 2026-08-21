"use client";

import { useState } from "react";
import {
  Briefcase,
  GraduationCap,
  Hand,
  Heart,
  HeartHandshake,
  Lock,
  Radio,
  Receipt,
  ShieldCheck,
  Smartphone,
  ArrowUpRight,
  X,
} from "lucide-react";

type CardId = "whatsup" | "mental" | "actions";

const CARDS: { id: CardId; label: string; msg: string }[] = [
  {
    id: "whatsup",
    label: "What's Up?",
    msg: "Everything you dealing with right now, from Exams to Assignments to Dating to Family and Roommates Drama. Every little thing matters when it comes to you.",
  },
  {
    id: "mental",
    label: "Your Mental Health",
    msg: "How you're really doing underneath it all, your mood, stress, sleep and energy. We read your true state, no judgment, so nothing about you gets missed.",
  },
  {
    id: "actions",
    label: "Actions & Radio",
    msg: "The move. Once your battery is set, we build the plan, the exact steps to take, paired with the right sound to carry you all the way through.",
  },
];

const DEFAULT_SUB =
  "Set your battery with What's Up + Your Mental Health, then we cook up the exact game plan for you (Actions). No fluff, just moves. 🚀";

export default function Home() {
  const [modalOpen, setModalOpen] = useState(false);
  const [view, setView] = useState<"choice" | "tiktok">("choice");
  const [activeCard, setActiveCard] = useState<CardId | null>(null);

  function openModal() {
    setView("choice");
    setActiveCard(null);
    setModalOpen(true);
  }

  function handleReady() {
    // TODO: route to /onboard once the onboarding flow is built
    setModalOpen(false);
  }

  const active = CARDS.find((c) => c.id === activeCard);

  return (
    <div className="bg-ink relative flex min-h-screen flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(60% 50% at 50% 0%, rgba(149,90,164,0.25), transparent 70%), radial-gradient(55% 45% at 85% 100%, rgba(232,212,173,0.16), transparent 70%), linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.25) 40%, rgba(0,0,0,0.65))",
        }}
      />

      <div className="relative z-10 flex flex-1 flex-col">
        <nav className="flex items-center justify-between gap-4 p-6 sm:px-10">
          <a
            href="#"
            className="text-muted hover:text-txt flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <HeartHandshake className="size-4" />
            The Pledge
          </a>
          <div className="text-lg font-bold tracking-tight">
            JustGo <span className="text-gold">Health</span>
          </div>
          <button
            type="button"
            className="text-muted hover:text-txt flex items-center gap-1 text-sm font-medium transition-colors"
          >
            Providers
            <ArrowUpRight className="size-4" />
          </button>
        </nav>

        <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
          <button
            type="button"
            onClick={openModal}
            className="border-gold-light bg-gold hover:bg-gold-light flex items-center gap-2 rounded-full border px-6 py-3 font-semibold text-[#161207] shadow-[0_16px_40px_rgba(232,212,173,0.25)] transition-all hover:-translate-y-0.5 active:scale-95"
          >
            <Lock className="size-4" />
            LOCK IN
          </button>

          <h1 className="max-w-2xl text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
            <span className="text-gold">The Best, Ever,</span>{" "}
            <span className="text-brand-purple">Version of Yourself.</span>
          </h1>

          <p className="text-muted flex max-w-xl flex-wrap items-center justify-center gap-x-2 gap-y-2 text-base sm:text-lg">
            <span>From</span>
            <span className="text-txt inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1">
              <Heart className="size-3.5" /> Dating
            </span>
            <span>to</span>
            <span className="text-txt inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1">
              <GraduationCap className="size-3.5" /> All A&apos;s in Exam
            </span>
            <span>to</span>
            <span className="text-txt inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1">
              <Briefcase className="size-3.5" /> Internship
            </span>
            <span>at Apple Inc.</span>
          </p>

          <button
            type="button"
            className="border-line text-txt flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition-colors hover:border-white/25 hover:bg-white/5"
          >
            <Hand className="size-4" />
            Say Hi
          </button>
        </main>

        <div className="flex flex-wrap items-center justify-center gap-3 pb-8">
          <button
            type="button"
            className="border-line text-muted hover:text-txt flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition-colors"
          >
            We have
            <span className="text-txt inline-flex items-center gap-1">
              <Receipt className="size-3.5" /> Receipts
            </span>
          </button>
          <button
            type="button"
            className="border-line text-muted hover:text-txt flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition-colors"
          >
            <Radio className="size-3.5" />
            JustGo Health Studios
          </button>
        </div>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="border-line bg-panel relative w-full max-w-lg overflow-hidden rounded-3xl border shadow-2xl">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              aria-label="Close"
              className="text-muted hover:text-txt absolute top-4 right-4 z-10 transition-colors"
            >
              <X className="size-5" />
            </button>

            {view === "choice" ? (
              <div className="flex flex-col">
                <div className="divide-line grid grid-cols-2 divide-x">
                  <button
                    type="button"
                    onClick={() => setView("tiktok")}
                    className="text-muted hover:text-txt flex flex-col items-center gap-3 px-4 py-8 text-sm font-medium transition-colors hover:bg-white/5"
                  >
                    <Smartphone className="text-no size-6" />
                    No, I wanna waste time on TikTok
                  </button>
                  <button
                    type="button"
                    onClick={handleReady}
                    className="text-txt flex flex-col items-center gap-3 px-4 py-8 text-sm font-semibold transition-colors hover:bg-white/5"
                  >
                    <ShieldCheck className="text-yes size-6" />
                    Yes, I&apos;m Ready To Lock In
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 px-6 pt-6">
                  {CARDS.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onMouseEnter={() => setActiveCard(card.id)}
                      onMouseLeave={() => setActiveCard(null)}
                      onFocus={() => setActiveCard(card.id)}
                      onBlur={() => setActiveCard(null)}
                      className="hover:border-gold/50 border-line text-txt rounded-xl border px-3 py-4 text-xs font-medium transition-colors hover:bg-white/5"
                    >
                      {card.label}
                    </button>
                  ))}
                </div>

                <div className="px-6 pt-5 pb-6 text-center">
                  <div className="text-txt text-sm font-semibold">
                    Welcome to LOCK IN 2.0
                  </div>
                  <div className="text-muted mt-1.5 text-xs leading-relaxed">
                    {active ? (
                      <>
                        <span className="text-gold font-semibold">
                          {active.label}:{" "}
                        </span>
                        {active.msg}
                      </>
                    ) : (
                      DEFAULT_SUB
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 px-8 py-12 text-center">
                <div className="text-txt text-xl font-bold">No Worries.</div>
                <p className="text-muted max-w-xs text-sm">
                  Go ahead, enjoy the scroll. We&apos;ll be right here whenever
                  you&apos;re ready to lock in.
                </p>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                  <a
                    href="https://www.tiktok.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-txt flex items-center justify-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-white/15"
                  >
                    Open TikTok
                  </a>
                  <button
                    type="button"
                    onClick={() => setView("choice")}
                    className="border-line text-muted hover:text-txt rounded-full border px-5 py-2.5 text-sm font-medium transition-colors"
                  >
                    Actually, let&apos;s lock in
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
