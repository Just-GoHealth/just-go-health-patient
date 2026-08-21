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
import { FloatingReceipts } from "@/components/landing/floating-receipts";
import { WelcomeModal } from "@/components/landing/welcome-modal";

const overshoot = { type: "spring" as const, stiffness: 300, damping: 16 };

const HERO_BLUR_DATA_URL =
  "data:image/jpeg;base64,/9j/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAALABADASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABAIF/8QAIxAAAgICAAUFAAAAAAAAAAAAAQIDEQAEEiExQXETFFGBof/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwBEW5LHqLHOIbZaFPV11u+/i+hw+5vp7n0bRgY2YEPx1y7WPzMeIl96NmJJLPd+MiKV5NynYnhTl8j7wP/Z";

export default function Home() {
  const [modalOpen, setModalOpen] = useState(false);

  function handleReady() {
    // TODO: route to /onboard once the onboarding flow is built
    setModalOpen(false);
  }

  return (
    <div className="bg-ink relative flex min-h-screen flex-1 flex-col overflow-hidden">
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
            className="text-txt flex items-center gap-[0.5em] rounded-full border border-dashed border-white/30 font-medium transition-colors hover:border-white/50"
            style={{
              fontSize: "clamp(12.65px, 1.6vh, 15px)",
              padding: "0.55em 1.1em",
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.28, ease: "easeOut" }}
          >
            <PledgeIcon className="size-[1.1em] shrink-0" />
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
              className="invert"
              style={{ height: "clamp(22px, 3.4vh, 30px)", width: "auto" }}
            />
          </motion.div>

          <button
            type="button"
            className="text-txt flex items-center gap-[0.4em] rounded-full border border-dashed border-white/30 font-medium transition-colors hover:border-white/50"
            style={{
              fontSize: "clamp(12.65px, 1.6vh, 15px)",
              padding: "0.55em 1.1em",
            }}
          >
            Providers
            <ProvidersIcon className="size-[1.1em] shrink-0" />
          </button>
        </motion.nav>

        <main className="relative flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
          <motion.p
            className="text-gold font-semibold"
            style={{ fontSize: "clamp(13.5px, 1.86vh, 17.5px)" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
          >
            Designed with clinical experts and NSMQ alumni.
          </motion.p>

          <motion.button
            type="button"
            onClick={() => setModalOpen(true)}
            className="border-gold-light bg-gold relative flex items-center gap-[0.5em] overflow-hidden rounded-full border font-semibold text-[#161207] shadow-[0_16px_40px_rgba(232,212,173,0.25)] transition-transform hover:-translate-y-0.5 active:scale-95"
            style={{
              fontSize: "clamp(14px, 2vh, 18px)",
              padding: "0.85em 1.6em",
            }}
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...overshoot, delay: 0.42 }}
          >
            <LockIcon className="size-[0.9em] shrink-0" />
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
            className="font-extrabold tracking-tight"
            style={{ fontSize: "clamp(2.25rem, 6vw, 4.25rem)" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5, ease: "easeOut" }}
          >
            <span className="text-txt">NSMQ</span>{" "}
            <span className="text-gold">2026</span>
          </motion.h1>

          <motion.p
            className="text-yes max-w-2xl font-bold text-balance"
            style={{ fontSize: "clamp(1.05rem, 2.6vw, 1.5rem)" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6, ease: "easeOut" }}
          >
            Compete at your best while taking care of your mind along the way.
          </motion.p>
        </main>

        <motion.div
          className="flex flex-wrap items-center justify-center gap-3 pb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.7, ease: "easeOut" }}
        >
          <div
            className="text-txt flex items-center gap-[0.45em] rounded-full border border-dashed border-white/30 font-medium"
            style={{
              fontSize: "clamp(11px, 1.5vh, 13px)",
              padding: "0.5em 1em",
            }}
          >
            <HandIcon className="size-[1.1em] shrink-0" />
            Say Hi
          </div>
          <div
            className="bg-txt relative flex items-center gap-[0.45em] rounded-full font-semibold text-[#161207]"
            style={{
              fontSize: "clamp(12.65px, 1.6vh, 15px)",
              padding: "0.6em 1.2em",
            }}
          >
            <FloatingReceipts className="bottom-[calc(100%+0.6em)] left-1/2" />
            We have
            <span className="text-gold inline-flex items-center gap-[0.3em]">
              <ReceiptIcon className="size-[1.1em] shrink-0" /> Receipts
            </span>
          </div>
          <div
            className="text-txt flex items-center gap-[0.45em] rounded-full border border-dashed border-white/30 font-medium"
            style={{
              fontSize: "clamp(11px, 1.5vh, 13px)",
              padding: "0.5em 1em",
            }}
          >
            <StudiosIcon className="size-[1.1em] shrink-0" />
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
