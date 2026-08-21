"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { NoIcon, YesIcon } from "./icons";

type CardId = "whatsup" | "mental" | "actions";

const CARDS: { id: CardId; label: string; image: string; msg: string }[] = [
  {
    id: "whatsup",
    label: "What's Up?",
    image: "/images/grid-whatsup.jpg",
    msg: "Everything you dealing with right now, from Exams to Assignments to Dating to Family and Roommates Drama. Every little thing matters when it comes to you.",
  },
  {
    id: "mental",
    label: "Your Mental Health",
    image: "/images/grid-mental.jpg",
    msg: "How you're really doing underneath it all, your mood, stress, sleep and energy. We read your true state, no judgment, so nothing about you gets missed.",
  },
  {
    id: "actions",
    label: "Actions & Radio",
    image: "/images/grid-actions.jpg",
    msg: "The move. Once your battery is set, we build the plan, the exact steps to take, paired with the right sound to carry you all the way through.",
  },
];

const DEFAULT_SUB =
  "Set your battery with What's Up + Your Mental Health, then we cook up the exact game plan for you (Actions). No fluff, just moves. 🚀";

export function WelcomeModal({
  open,
  onClose,
  onReady,
}: {
  open: boolean;
  onClose: () => void;
  onReady: () => void;
}) {
  const [view, setView] = useState<"choice" | "tiktok">("choice");
  const [activeCard, setActiveCard] = useState<CardId | null>(null);

  const active = CARDS.find((c) => c.id === activeCard);

  return (
    <AnimatePresence
      onExitComplete={() => {
        setView("choice");
        setActiveCard(null);
      }}
    >
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(4,4,6,0.55)] backdrop-blur-[7px]"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <motion.div
            className="border-gold bg-panel relative flex h-[80vh] w-[80vw] max-w-3xl flex-col overflow-hidden rounded-[26px] border-2 p-4 shadow-[0_40px_120px_rgba(0,0,0,0.55),0_0_0_4px_rgba(232,212,173,0.22)] sm:p-7"
            initial={{ opacity: 0, scale: 0.9, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 14 }}
            transition={{ duration: 0.4, ease: [0.2, 0.9, 0.3, 1.2] }}
          >
            {view === "choice" ? (
              <div className="relative flex flex-1 flex-col">
                <button
                  type="button"
                  onClick={() => setView("tiktok")}
                  className="bg-no absolute flex items-center gap-[0.55em] rounded-full font-bold text-white shadow-[0_10px_26px_rgba(237,75,88,0.35)] transition-transform hover:-translate-y-0.5"
                  style={{
                    top: "clamp(16px, 2.4vh, 30px)",
                    left: "clamp(16px, 2.4vh, 30px)",
                    fontSize: "clamp(12.65px, 1.725vh, 18.4px)",
                    padding: "0.72em 1.4em",
                  }}
                >
                  <NoIcon className="size-[1.15em] shrink-0" />
                  No, I wanna waste time on TikTok
                </button>
                <button
                  type="button"
                  onClick={onReady}
                  className="bg-yes absolute flex items-center gap-[0.55em] rounded-full font-bold text-white shadow-[0_10px_26px_rgba(43,182,115,0.38)] transition-transform hover:-translate-y-0.5"
                  style={{
                    top: "clamp(16px, 2.4vh, 30px)",
                    right: "clamp(16px, 2.4vh, 30px)",
                    fontSize: "clamp(12.65px, 1.725vh, 18.4px)",
                    padding: "0.72em 1.4em",
                  }}
                >
                  <YesIcon className="size-[1.15em] shrink-0" />
                  Yes, I&apos;m Ready To Lock In
                </button>

                <div className="mx-auto grid w-full max-w-md flex-1 grid-cols-3 items-center gap-2 pt-14 sm:gap-4 sm:pt-16">
                  {CARDS.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onMouseEnter={() => setActiveCard(card.id)}
                      onMouseLeave={() => setActiveCard(null)}
                      onFocus={() => setActiveCard(card.id)}
                      onBlur={() => setActiveCard(null)}
                      className="border-line relative aspect-square overflow-hidden rounded-2xl border transition-transform hover:scale-[1.03]"
                    >
                      <Image
                        src={card.image}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 30vw, 160px"
                        className="object-cover"
                      />
                      <div
                        aria-hidden
                        className="absolute inset-0"
                        style={{
                          backgroundImage:
                            "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.5) 55%, rgba(0,0,0,0.7) 100%)",
                        }}
                      />
                      <span className="relative px-1.5 text-center text-[11px] leading-tight font-semibold text-white sm:text-sm">
                        {card.label}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="pt-4 text-center sm:pt-6">
                  <div className="text-txt text-sm font-semibold sm:text-base">
                    Welcome to LOCK IN 2.0
                  </div>
                  <div className="text-muted mx-auto mt-1.5 max-w-md text-xs leading-relaxed sm:text-sm">
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
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
