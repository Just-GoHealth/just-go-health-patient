"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { useState } from "react";
import {
  HandIcon,
  LockIcon,
  PledgeIcon,
  ProvidersIcon,
  ReceiptIcon,
  StudiosIcon,
} from "@/components/landing/icons";
import { WelcomeModal } from "@/components/landing/welcome-modal";

const overshoot = { type: "spring" as const, stiffness: 300, damping: 16 };

const HERO_BLUR_DATA_URL =
  "data:image/jpeg;base64,/9j/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAALABADASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABAIF/8QAIxAAAgICAAUFAAAAAAAAAAAAAQIDEQAEEiExQXETFFGBof/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwBEW5LHqLHOIbZaFPV11u+/i+hw+5vp7n0bRgY2YEPx1y7WPzMeIl96NmJJLPd+MiKV5NynYnhTl8j7wP/Z";

const FLOATING_RECEIPTS = [
  { text: "@Naledi held a 4.0 through 1L", left: "8%", bottom: "30%", delay: 0 },
  { text: "@Yaw got the Apple internship", left: "30%", bottom: "16%", delay: 1.3 },
  { text: "@Priya clerked the Second Circuit", left: "56%", bottom: "16%", delay: 2.6 },
];

export default function Home() {
  const [modalOpen, setModalOpen] = useState(false);

  function handleReady() {
    // TODO: route to /onboard once the onboarding flow is built
    setModalOpen(false);
  }

  return (
    <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-ink">
      <motion.div
        className="absolute inset-0"
        style={{ transformOrigin: "38% 52%" }}
        initial={{ scale: 1.12 }}
        animate={{ scale: 1 }}
        transition={{ duration: 11, ease: [0.16, 0.84, 0.34, 1] }}
      >
        <Image
          src="/images/nsmqbg.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          placeholder="blur"
          blurDataURL={HERO_BLUR_DATA_URL}
          className="object-cover grayscale"
        />
      </motion.div>
      <motion.div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(12,9,7,0.58) 0%, rgba(12,9,7,0.30) 30%, rgba(12,9,7,0.30) 62%, rgba(12,9,7,0.66) 100%)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />

      <div className="relative z-10 flex flex-1 flex-col">
        <motion.nav
          className="flex items-center justify-between gap-4 p-6 sm:px-10"
          initial={{ opacity: 0, y: -16, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...overshoot, delay: 0.1 }}
        >
          <motion.a
            href="#"
            className="flex items-center gap-2 rounded-full border border-dashed border-white/30 px-4 py-2 text-sm font-medium text-txt transition-colors hover:border-white/50"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.28, ease: "easeOut" }}
          >
            <PledgeIcon className="size-4" />
            The Pledge
          </motion.a>

          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...overshoot, delay: 0.2 }}
          >
            <Image
              src="/images/logo.webp"
              alt="JustGo Health"
              width={140}
              height={28}
              priority
              className="h-6 w-auto invert sm:h-7"
            />
          </motion.div>

          <button
            type="button"
            className="flex items-center gap-1 rounded-full border border-dashed border-white/30 px-4 py-2 text-sm font-medium text-txt transition-colors hover:border-white/50"
          >
            Providers
            <ProvidersIcon className="size-4" />
          </button>
        </motion.nav>

        <main className="relative flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
          {FLOATING_RECEIPTS.map((r) => (
            <motion.div
              key={r.text}
              aria-hidden
              className="absolute rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium text-txt/80 backdrop-blur-sm"
              style={{ left: r.left, bottom: r.bottom }}
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: [0, 1, 1, 0], y: [0, -10, -44, -64] }}
              transition={{
                duration: 4,
                times: [0, 0.15, 0.75, 1],
                repeat: Infinity,
                repeatDelay: 2,
                delay: r.delay,
                ease: "easeOut",
              }}
            >
              <span className="font-semibold">{r.text.split(" ")[0]}</span>{" "}
              {r.text.slice(r.text.indexOf(" ") + 1)}
            </motion.div>
          ))}

          <motion.p
            className="text-sm font-semibold text-gold sm:text-base"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
          >
            Designed with clinical experts and NSMQ alumni.
          </motion.p>

          <motion.button
            type="button"
            onClick={() => setModalOpen(true)}
            className="relative flex items-center gap-2 overflow-hidden rounded-full border border-gold-light bg-gold px-6 py-3 font-semibold text-[#161207] shadow-[0_16px_40px_rgba(232,212,173,0.25)] transition-transform hover:-translate-y-0.5 active:scale-95"
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...overshoot, delay: 0.42 }}
          >
            <LockIcon className="size-4" />
            LOCK IN FOR NSMQ 2026
            <motion.span
              aria-hidden
              className="pointer-events-none absolute top-[-40%] left-0 h-[180%] w-[45%]"
              style={{
                backgroundImage:
                  "linear-gradient(100deg, rgba(255,255,255,0), rgba(255,255,255,0.85), rgba(255,255,255,0))",
              }}
              initial={{ opacity: 0, x: "-40%" }}
              animate={{
                opacity: [0, 0.55, 0, 0],
                x: ["-40%", "32%", "140%", "140%"],
              }}
              transition={{
                duration: 2.6,
                delay: 2.1,
                ease: "easeOut",
                times: [0, 0.18, 0.45, 1],
              }}
            />
          </motion.button>

          <motion.h1
            className="text-5xl font-extrabold tracking-tight sm:text-6xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5, ease: "easeOut" }}
          >
            <span className="text-txt">NSMQ</span>{" "}
            <span className="text-gold">2026</span>
          </motion.h1>

          <motion.p
            className="max-w-2xl text-xl font-bold text-yes text-balance sm:text-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6, ease: "easeOut" }}
          >
            Compete at your best while taking care of your mind along the
            way.
          </motion.p>
        </main>

        <motion.div
          className="flex flex-wrap items-center justify-center gap-3 pb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.7, ease: "easeOut" }}
        >
          <div className="flex items-center gap-2 rounded-full border border-dashed border-white/30 px-4 py-2 text-xs font-medium text-txt">
            <HandIcon className="size-4" />
            Say Hi
          </div>
          <div className="flex items-center gap-2 rounded-full bg-txt px-5 py-2.5 text-sm font-semibold text-[#161207]">
            We have
            <span className="inline-flex items-center gap-1 text-gold">
              <ReceiptIcon className="size-4" /> Receipts
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-dashed border-white/30 px-4 py-2 text-xs font-medium text-txt">
            <StudiosIcon className="size-3.5" />
            JustGo Health Studios
          </div>
        </motion.div>
      </div>

      <WelcomeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onReady={handleReady}
      />
    </div>
  );
}
