"use client";

import { useEffect, useRef, useState } from "react";

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
  defaultScrollValue,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  className?: string;
  // where to land when nothing is selected yet, if the array midpoint isn't
  // a good guess (e.g. a birth-year list, where the middle skews too old)
  defaultScrollValue?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // land on the selected option if there is one; otherwise on
  // defaultScrollValue if the caller gave us one, otherwise near the middle
  // of the list instead of the very top. This list is used for birth year
  // among other things, and nobody filling this out today was born in the
  // years sitting at the top of that list.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    const selectedIndex = value ? options.indexOf(value) : -1;
    const defaultIndex = defaultScrollValue
      ? options.indexOf(defaultScrollValue)
      : -1;
    const targetIndex =
      selectedIndex >= 0
        ? selectedIndex
        : defaultIndex >= 0
          ? defaultIndex
          : Math.floor(options.length / 2);
    const target = list.children[targetIndex] as HTMLElement | undefined;
    target?.scrollIntoView({ block: "center" });
  }, [open, value, options, defaultScrollValue]);

  return (
    <div ref={ref} className={`relative min-w-0 ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="border-line focus:border-gold/60 flex w-full items-center justify-between rounded-xl border bg-white/5 px-4 py-3 text-left text-base outline-none"
      >
        <span className={`min-w-0 truncate ${value ? "text-txt" : "text-muted"}`}>
          {value || placeholder}
        </span>
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          ref={listRef}
          className="border-line absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border bg-[#2b1210] shadow-2xl"
        >
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={`block w-full px-4 py-2.5 text-left text-sm transition-colors ${
                opt === value
                  ? "bg-gold/20 text-gold"
                  : "text-txt hover:bg-white/10"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
