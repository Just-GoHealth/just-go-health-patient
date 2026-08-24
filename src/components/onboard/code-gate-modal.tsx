"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, type RefObject } from "react";

export function CodeGateModal({
  open,
  campusName,
  code,
  codeState,
  codeMessage,
  codeRefs,
  onCodeChange,
  onClose,
}: {
  open: boolean;
  campusName?: string;
  code: string[];
  codeState: "" | "good" | "bad";
  codeMessage: string;
  codeRefs: RefObject<(HTMLInputElement | null)[]>;
  onCodeChange: (i: number, raw: string) => void;
  onClose: () => void;
}) {
  // land on the first box the moment the modal opens — no click required
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => codeRefs.current[0]?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open, codeRefs]);

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
            className="relative flex h-[min(85vh,620px)] w-full max-w-4xl overflow-hidden rounded-3xl bg-white text-[#1a100c] shadow-2xl"
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

            <div className="flex min-w-0 flex-1 flex-col items-center justify-center overflow-y-auto p-8 text-center sm:p-12">
              <div className="mb-8 self-start">
                <Image
                  src="/images/logo.webp"
                  alt="JustGo Health"
                  width={384}
                  height={67}
                  className="h-6 w-auto shrink-0 self-start object-contain"
                />
              </div>

              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                Join{" "}
                <span className="text-[#8f6716]">{campusName ?? "your school"}</span>
              </h1>
              <div className="mt-3 h-px w-16 bg-gradient-to-r from-[#e8d4ad] to-[#b8862e]" />
              <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-black/70">
                The <strong className="text-black">{campusName}</strong> NSMQ
                team is private. To join your team, enter the access code
                provided by your school.
              </p>

              <div className="mt-6 flex items-center justify-center gap-[1.2vw] sm:gap-2.5">
                {code.map((v, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      codeRefs.current[i] = el;
                    }}
                    className={`aspect-[4/5] rounded-lg border text-center font-bold uppercase outline-none ${
                      codeState === "good"
                        ? "border-[#1e8f57] bg-[#1e8f57]/10 text-[#1e8f57]"
                        : codeState === "bad"
                          ? "border-[#c22f3c] bg-[#c22f3c]/10 text-[#c22f3c]"
                          : "border-black/15 bg-black/[0.03] text-[#1a100c] focus:border-[#b8862e]"
                    }`}
                    style={{
                      width: "clamp(26px, 6.5vw, 42px)",
                      fontSize: "clamp(13px, 3vw, 18px)",
                    }}
                    value={v}
                    onChange={(e) => onCodeChange(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !v && i > 0) {
                        codeRefs.current[i - 1]?.focus();
                      }
                    }}
                  />
                ))}
              </div>

              {codeMessage && (
                <p
                  className={`mt-3 text-sm font-medium ${
                    codeState === "good" ? "text-[#1e8f57]" : "text-[#c22f3c]"
                  }`}
                >
                  {codeMessage}
                </p>
              )}
            </div>

            <div className="relative hidden w-[36%] shrink-0 items-end justify-center overflow-hidden bg-gradient-to-b from-[#fdfbf6] to-[#f7f1e6] p-4 sm:flex">
              <div className="absolute top-10 right-4 left-4 rounded-2xl border border-dashed border-[#b8862e]/50 bg-[#fdfbf6] px-4 py-2.5 text-center text-[11px] font-extrabold tracking-wide text-[#8f6716] uppercase shadow-sm">
                Need your code? Contact your team.
              </div>
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
