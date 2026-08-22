"use client";

import { AnimatePresence, motion } from "motion/react";

export function LogoutConfirmModal({
  open,
  loading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[400] flex items-center justify-center p-6 backdrop-blur-sm"
          style={{ background: "rgba(8,5,4,.62)" }}
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) onCancel();
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className="w-full max-w-[420px] rounded-[20px] p-7 text-center"
            style={{
              background:
                "radial-gradient(118% 86% at 50% 12%, #733730 0%, #572621 44%, #3b1a17 76%, #2b1210 100%)",
              border: "1.5px solid rgba(232,212,173,.42)",
              boxShadow:
                "0 32px 80px rgba(0,0,0,.62), inset 0 1px 0 rgba(255,255,255,.12)",
            }}
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.26, ease: [0.2, 0.9, 0.3, 1.2] }}
          >
            <h3 className="mb-2 text-2xl font-extrabold tracking-tight text-white">
              Log out?
            </h3>
            <p className="mb-6 text-[15px] leading-relaxed text-white/72">
              Your answers and your account go with you. The version you were
              invited to stays.
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full border border-white/30 bg-transparent px-6 py-3 text-[15px] font-extrabold text-white/85 transition-all hover:-translate-y-px hover:border-[#ed4b58] hover:bg-[#ed4b58]/92 hover:text-white active:scale-[0.97]"
              >
                Stay logged in
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className="rounded-full border border-[#e8d4ad] bg-[#e8d4ad] px-6 py-3 text-[15px] font-extrabold text-[#2b1210] transition-all hover:-translate-y-px hover:bg-[#f6e7c4] active:scale-[0.97] disabled:opacity-70"
              >
                {loading ? "Logging out…" : "Log out"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
