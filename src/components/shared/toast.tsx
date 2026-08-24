"use client";

import { useEffect, useRef, useState } from "react";

type ToastState = { msg: string; on: boolean } | null;

// same hand-rolled show/fade/hide timing as pledge/page.tsx's toast,
// pulled out here so other pages (home, screening) don't each duplicate
// the timer bookkeeping.
export function useToast() {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, []);

  function showToast(msg: string) {
    timers.current.forEach(clearTimeout);
    setToast({ msg, on: false });
    timers.current = [
      setTimeout(() => setToast({ msg, on: true }), 16),
      setTimeout(
        () => setToast((prev) => (prev ? { ...prev, on: false } : prev)),
        4200,
      ),
      setTimeout(() => setToast(null), 4800),
    ];
  }

  return { toast, showToast };
}

export function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null;
  return <div className={`app-toast ${toast.on ? "on" : ""}`}>{toast.msg}</div>;
}
