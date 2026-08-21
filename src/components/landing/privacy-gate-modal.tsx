"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";

const SECTIONS = [
  {
    label: "Personalization",
    body: "LOCK IN is built around you. Creating your own account allows us to understand your needs and provide information and guidance that is personal to you.",
  },
  {
    label: "Access code",
    body: "Your privacy matters, so this version of LOCK IN requires two-step authentication. After you sign in, your school will provide you with your access code.",
  },
  {
    label: "Dark",
    body: "When you click OK, LOCK IN will switch to dark mode. Think of it as a reminder that what you share here is private. Be honest with your answers. You know your body and your experience, and we know the science of mental health.",
  },
];

export function PrivacyGateModal({
  open,
  onClose,
  onContinue,
}: {
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <motion.div
            className="relative flex h-[min(85vh,680px)] w-full max-w-4xl overflow-hidden rounded-3xl bg-white text-[#1a100c] shadow-2xl"
            initial={{ opacity: 0, scale: 0.96, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 24 }}
            transition={{ duration: 0.4, ease: [0.2, 0.85, 0.3, 1.05] }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 z-10 flex size-8 items-center justify-center rounded-full border border-black/10 text-black/50 transition-colors hover:bg-black/5"
            >
              ✕
            </button>

            <div className="min-w-0 flex-1 overflow-y-auto p-8 sm:p-12">
              <div className="mb-8">
                <Image
                  src="/images/logo.webp"
                  alt="JustGo Health"
                  width={140}
                  height={28}
                  className="h-6 w-auto"
                />
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Your Privacy Comes <span className="text-[#8f6716]">First</span>
              </h1>
              <div className="mt-4 h-px w-16 bg-gradient-to-r from-[#e8d4ad] to-[#b8862e]" />

              <div className="mt-6 flex flex-col divide-y divide-black/10">
                {SECTIONS.map((s) => (
                  <div key={s.label} className="py-4 text-center first:pt-0">
                    <div className="text-xs font-bold tracking-[0.2em] text-[#8f6716] uppercase">
                      {s.label}
                    </div>
                    <p className="mt-2 text-[15px] leading-relaxed text-black/70">
                      {s.body}
                    </p>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={onContinue}
                className="mx-auto mt-8 flex items-center gap-2 rounded-full bg-[#4a201c] px-6 py-3 font-semibold text-[#f6e7c4] transition-colors hover:bg-[#5a2c26]"
              >
                Okay, let&apos;s go 🚀
              </button>
            </div>

            <div className="hidden w-[36%] shrink-0 items-end justify-center overflow-hidden bg-gradient-to-b from-[#fdfbf6] to-[#f7f1e6] p-4 sm:flex">
              <Image
                src="/images/access-code-illustration.webp"
                alt=""
                width={280}
                height={400}
                className="h-full w-full object-contain object-bottom"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
