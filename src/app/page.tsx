"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import {
  HandIcon,
  LockIcon,
  PledgeIcon,
  ProvidersIcon,
  ReceiptIcon,
  StudiosIcon,
} from "@/components/landing/icons";
import { FloatingReceipts } from "@/components/landing/floating-receipts";
import { PrivacyGateModal } from "@/components/landing/privacy-gate-modal";
import { ApiError, getVersionMembership } from "@/lib/api";
import { VERSIONS_SEEN_KEY } from "@/lib/constants";

const VERSION_CODE = "nsmq2026";

const overshoot = { type: "spring" as const, stiffness: 300, damping: 16 };

const HERO_BLUR_DATA_URL =
  "data:image/jpeg;base64,/9j/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAALABADASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABAIF/8QAIxAAAgICAAUFAAAAAAAAAAAAAQIDEQAEEiExQXETFFGBof/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwBEW5LHqLHOIbZaFPV11u+/i+hw+5vp7n0bRgY2YEPx1y7WPzMeIl96NmJJLPd+MiKV5NynYnhTl8j7wP/Z";

export default function Home() {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [checkingSession, setCheckingSession] = useState(false);

  // a first-time visitor lands on the invitation/version-picker screen
  // instead - returning visitors (who've already picked NSMQ 2026) skip
  // straight to this hero
  useEffect(() => {
    try {
      if (!localStorage.getItem(VERSIONS_SEEN_KEY)) {
        router.replace("/versions");
      }
    } catch {
      // unavailable storage (e.g. private browsing) - just show the hero
    }
  }, [router]);

  function handleContinue() {
    setModalOpen(false);
    router.push("/onboard");
  }

  // returning users with a session already shouldn't see the marketing
  // privacy gate at all — /onboard's own session-check routes them straight
  // to wherever they left off (campus picking, the code gate, or in). Only a
  // genuinely unauthenticated 401/403 means this is a first-time visitor.
  async function handleLockInClick() {
    setCheckingSession(true);
    try {
      await getVersionMembership(VERSION_CODE);
      router.push("/onboard");
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        setModalOpen(true);
      } else {
        router.push("/onboard");
      }
    } finally {
      setCheckingSession(false);
    }
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
          src="/images/landing_bg.jpeg"
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
          className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-10"
          initial={{ opacity: 0, y: -16, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...overshoot, delay: 0.1 }}
        >
          {/* Pledge + Providers share the top row on mobile - the logo gets
              its own row below instead of being squeezed between them.
              sm:contents flattens this wrapper away again at the desktop
              breakpoint, where all three go back to one row via order. */}
          <div className="flex items-center justify-between gap-4 sm:contents">
            <motion.a
              href="/pledge"
              className="land-pill land-pledge sm:order-1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.28, ease: "easeOut" }}
            >
              <PledgeIcon />
              The Pledge
            </motion.a>

            <a
              href="https://dwen-wo-ho-nine.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="land-providers-btn sm:order-3"
            >
              Providers
              <ProvidersIcon />
            </a>
          </div>

          <motion.button
            type="button"
            onClick={() => router.push("/versions")}
            aria-label="Switch LOCK IN version"
            className="self-center sm:order-2"
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...overshoot, delay: 0.2 }}
          >
            <Image
              src="/images/logo.webp"
              alt="JustGo Health"
              width={384}
              height={67}
              priority
              className="h-5 w-auto object-contain invert sm:h-7 md:h-8"
            />
          </motion.button>
        </motion.nav>

        <main
          className="relative flex flex-1 flex-col items-center gap-5 px-6 text-center"
          style={{
            justifyContent: "flex-start",
            paddingTop: "clamp(20px, 6vh, 64px)",
          }}
        >
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
            onClick={handleLockInClick}
            disabled={checkingSession}
            className="land-cta-btn relative overflow-hidden disabled:opacity-70"
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...overshoot, delay: 0.42 }}
          >
            <span className="inline-flex items-center gap-[0.5em]">
              <LockIcon className="size-[0.9em] shrink-0" />
              {checkingSession ? "One sec…" : "LOCK IN FOR NSMQ 2026"}
            </span>
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
            className="text-yes max-w-4xl font-bold text-balance"
            style={{ fontSize: "clamp(1.05rem, 2.6vw, 1.5rem)" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6, ease: "easeOut" }}
          >
            Compete at your best while taking care of your mind along the way.
          </motion.p>
        </main>

        {/* mobile: Say Hi / We have Receipts / Studios stacked, centered -
            their combined natural width doesn't fit one row without
            overlapping below the desktop breakpoint, unlike the three-way
            spread below */}
        <div className="absolute inset-x-0 bottom-0 z-[3] flex flex-col items-center gap-3 px-6 pb-6 sm:hidden">
          <motion.div
            className="land-pill"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7, ease: "easeOut" }}
          >
            <HandIcon />
            Say Hi
          </motion.div>

          <motion.div
            className="land-receipts-wrap relative"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.75, ease: "easeOut" }}
          >
            <FloatingReceipts
              className="bottom-[calc(100%+0.6em)] left-1/2"
              mobile
            />
            <span className="rc-pre">We have</span>
            <span className="rc-chip">
              <ReceiptIcon className="rc-ic" /> Receipts
            </span>
          </motion.div>

          <motion.div
            className="land-pill"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7, ease: "easeOut" }}
          >
            <StudiosIcon />
            JustGo Health Studios
          </motion.div>
        </div>

        {/* sm and up: original three-way absolute spread, unchanged */}
        <div className="hidden sm:contents">
          <motion.div
            className="land-pill absolute z-[3]"
            style={{
              left: "clamp(22px, 3.6vw, 48px)",
              bottom: "clamp(24px, 5vh, 52px)",
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7, ease: "easeOut" }}
          >
            <HandIcon />
            Say Hi
          </motion.div>

          <motion.div
            className="land-receipts-wrap absolute left-1/2 z-[3] -translate-x-1/2"
            style={{ bottom: "clamp(24px, 5vh, 52px)" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.75, ease: "easeOut" }}
          >
            <FloatingReceipts className="bottom-[calc(100%+0.6em)] left-1/2" />
            <span className="rc-pre">We have</span>
            <span className="rc-chip">
              <ReceiptIcon className="rc-ic" /> Receipts
            </span>
          </motion.div>

          <motion.div
            className="land-pill absolute z-[3]"
            style={{
              right: "clamp(22px, 3.6vw, 48px)",
              bottom: "clamp(24px, 5vh, 52px)",
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7, ease: "easeOut" }}
          >
            <StudiosIcon />
            JustGo Health Studios
          </motion.div>
        </div>
      </div>

      <PrivacyGateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onContinue={handleContinue}
      />
    </div>
  );
}
