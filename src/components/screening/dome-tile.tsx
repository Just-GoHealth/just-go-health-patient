"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type { BoardSection } from "@/lib/api";

// severity -> the exact colors from the legacy .ss.mild/.mod/.sev rows
const SEVERITY_COLOR: Record<string, string> = {
  mild: "#2bb673",
  mod: "#e69a4a",
  sev: "#e0616e",
};

// band family -> dome pill color
const FAM_COLOR: Record<string, string> = {
  green: "#2bb673",
  gold: "#e8d4ad",
  red: "#ed4b58",
  emg: "#ed4b58",
};

const STAGGER_Y: Record<number, string> = {
  0: "calc(-1 * clamp(16px, 2.6vh, 32px))",
  1: "clamp(20px, 3.4vh, 42px)",
  2: "calc(-1 * clamp(16px, 2.6vh, 32px))",
};

export function DomeTile({
  section,
  open,
  hidden,
  staggerIndex,
  onToggle,
  onGetCare,
  ackLoading,
}: {
  section: BoardSection;
  open: boolean;
  hidden: boolean;
  staggerIndex: number;
  onToggle: () => void;
  onGetCare: () => void;
  ackLoading: boolean;
}) {
  const bandColor = FAM_COLOR[section.emergency ? "emg" : (section.fam ?? "gold")];
  const slotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      slotRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [open]);

  const scoreLabel =
    typeof section.score === "number" && typeof section.max === "number"
      ? `${section.score}/${section.max}`
      : (section.score ?? "");

  return (
    <div
      ref={slotRef}
      data-dome-slot
      style={
        {
          "--dome-stagger": open ? "0px" : (STAGGER_Y[staggerIndex] ?? "0px"),
        } as CSSProperties
      }
      className={cn(
        "flex w-full max-w-[420px] flex-col items-stretch justify-self-center transition-[opacity,transform] duration-300 ease-out",
        "sm:[transform:translateY(var(--dome-stagger))]",
        // fully removed from layout (not faded) — see dome-board.tsx for why
        hidden && "hidden",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          // taller than a true semicircle (was aspect-[2/1]) specifically
          // to give 4 stacked lines of real content room to breathe near
          // the top of the curve - and no overflow-hidden: clipping text
          // to a geometrically "pure" dome shape made long real school/
          // section names actually disappear, which is strictly worse
          // than the curve being slightly imperfect for long content
          "relative flex aspect-[3/2] w-full origin-bottom flex-col items-center justify-end",
          "rounded-t-full border border-white/[.16] bg-white/[.055] px-3 pb-2 text-center sm:px-6 sm:pb-4",
          "shadow-[0_14px_32px_rgba(0,0,0,.45)] backdrop-blur-[14px]",
          "transition-all duration-300 ease-out hover:-translate-y-3 hover:scale-[1.07]",
          "hover:border-white/30 hover:bg-white/[.09] hover:shadow-[0_28px_56px_rgba(0,0,0,.55),0_0_40px_rgba(232,212,173,.18)]",
          // the single-column layout this tile gets when open (see
          // dome-board.tsx) already grows it up to max-w-[420px] on its
          // own - an extra scale on top of that left far more empty dome
          // above the content than the text needs
          section.emergency && "border-[#ed4b58]/55",
        )}
      >
        <span className="text-muted max-w-[80%] text-[10px] leading-tight font-extrabold tracking-wide sm:text-xs">
          {section.time}
        </span>
        <span className="text-txt mt-0.5 max-w-[85%] text-sm leading-tight font-bold tracking-tight sm:mt-1 sm:text-xl">
          {section.title}
        </span>
        {scoreLabel !== "" && (
          <span className="mt-0.5 w-fit self-center rounded-lg bg-white/95 px-2.5 py-0.5 text-sm font-extrabold text-[#2b1210] shadow-md sm:mt-1.5 sm:px-3.5 sm:py-1 sm:text-base">
            {scoreLabel}
          </span>
        )}
        <span
          className="mt-0.5 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide uppercase shadow sm:mt-2 sm:px-3.5 sm:py-1 sm:text-xs"
          style={{ backgroundColor: bandColor, color: "#fff" }}
        >
          {section.band}
        </span>
      </button>

      {open &&
        (section.emergency ? (
          <button
            type="button"
            onClick={onGetCare}
            disabled={ackLoading}
            className="board-care-btn mt-3"
          >
            {ackLoading ? "One sec…" : "Get Care"}
          </button>
        ) : (
          <div className="mt-3 flex max-h-[40vh] flex-col gap-2 overflow-y-auto">
            {(section.items ?? []).map((item, i) => (
              <div
                key={item.itemCode ?? item.name ?? i}
                style={{ animationDelay: `${i * 0.06}s` }}
                className="dome-row-in flex items-center gap-2.5 rounded-[10px] border border-black/10 bg-[#f2e7d4] px-3 py-2 shadow-[0_6px_16px_rgba(0,0,0,.3)]"
              >
                <span
                  className="size-5 shrink-0 rounded-[4px] border-2"
                  style={{
                    borderColor: SEVERITY_COLOR[item.severity ?? "mild"],
                    backgroundColor: SEVERITY_COLOR[item.severity ?? "mild"],
                  }}
                />
                <span className="min-w-0 flex-1 text-xs font-extrabold tracking-wide text-[#2c1622] uppercase">
                  {item.name}
                </span>
                <span
                  className="shrink-0 text-[11px] font-extrabold tracking-wide uppercase"
                  style={{ color: SEVERITY_COLOR[item.severity ?? "mild"] }}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
