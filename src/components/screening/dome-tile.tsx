"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
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
  showInlineGetCare = true,
}: {
  section: BoardSection;
  open: boolean;
  hidden: boolean;
  staggerIndex: number;
  onToggle: () => void;
  onGetCare: () => void;
  ackLoading: boolean;
  // the screening page's board phase has no header-level Get Care button,
  // so the emergency tile's own inline one is the only way to reach it
  // there. /home already has a always-visible header pill wired to the
  // same handler, so it passes false here to avoid showing it twice.
  showInlineGetCare?: boolean;
}) {
  const bandColor = FAM_COLOR[section.emergency ? "emg" : (section.fam ?? "gold")];
  const slotRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  // how many lines the title actually wrapped to, so it can shrink further
  // when it wraps - a long title pressing right up against the curve at
  // the height its first line sits at (e.g. "General Mental" / "Health")
  // is the same problem this design's own original mockup solved with its
  // .d-name.l2/.l3 size classes, which never made it into either React port
  const [titleLines, setTitleLines] = useState(1);

  useEffect(() => {
    if (open) {
      slotRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [open]);

  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight || "0");
    if (!lineHeight) return;
    const lines = Math.round(el.scrollHeight / lineHeight);
    setTitleLines(Math.max(1, lines));
  }, [section.title]);

  const titleFontSize =
    titleLines >= 3
      ? "clamp(10px, 1.3vw, 15px)"
      : titleLines === 2
        ? "clamp(11.5px, 1.5vw, 17px)"
        : "clamp(13px, 1.7vw, 20px)";

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
        // capped the same whether open or closed - this used to be 420px,
        // and since a closed dome shares its row with 2 others (~300-350px
        // each) but an opened one becomes the sole item in a single-column
        // grid, it was free to grow all the way to 420px for the exact
        // same 4 lines of content, which is the extra empty space this
        // was leaving inside the curve
        "flex w-full max-w-[320px] flex-col items-stretch justify-self-center transition-[opacity,transform] duration-300 ease-out",
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
          // 2:1 (a true semicircle) read as too small/cramped; 3:2 left too
          // much dead space. 1.86:1 is this design's own original mockup's
          // answer for exactly this 3-across layout (guide/Bronze Fury
          // A_33.html's ".rb-row .dome" variant, on the provider side) -
          // splits the difference rather than guessing again. The real fix
          // for content fitting is fluid clamp() font sizes below, not the
          // shape. Deliberately no overflow-hidden: on a long real title
          // this can still spill slightly past the curve, but that's a
          // minor cosmetic imperfection - clipping it made the text
          // disappear outright, which is never an acceptable trade
          "relative flex aspect-[1.86/1] w-full origin-bottom flex-col items-center justify-end",
          "rounded-t-full border border-white/[.16] bg-white/[.055] px-4 pb-3 text-center",
          "shadow-[0_14px_32px_rgba(0,0,0,.45)] backdrop-blur-[14px]",
          "transition-all duration-300 ease-out hover:-translate-y-3 hover:scale-[1.07]",
          "hover:border-white/30 hover:bg-white/[.09] hover:shadow-[0_28px_56px_rgba(0,0,0,.55),0_0_40px_rgba(232,212,173,.18)]",
          section.emergency && "border-[#ed4b58]/55",
        )}
      >
        <span
          className="text-muted max-w-[85%] leading-tight font-extrabold tracking-wide"
          style={{ fontSize: "clamp(9px, 1.3vw, 12.5px)" }}
        >
          {section.time}
        </span>
        <span
          ref={titleRef}
          className="text-txt mt-0.5 max-w-[88%] leading-tight font-bold tracking-tight"
          style={{ fontSize: titleFontSize }}
        >
          {section.title}
        </span>
        {scoreLabel !== "" && (
          <span
            className="mt-0.5 w-fit self-center rounded-lg bg-white/95 px-2.5 py-0.5 font-extrabold text-[#2b1210] shadow-md"
            style={{ fontSize: "clamp(12px, 1.5vw, 16px)" }}
          >
            {scoreLabel}
          </span>
        )}
        <span
          className="mt-0.5 rounded-full px-2.5 py-0.5 font-extrabold tracking-wide uppercase shadow"
          style={{
            fontSize: "clamp(9px, 1.2vw, 12px)",
            backgroundColor: bandColor,
            color: "#fff",
          }}
        >
          {section.band}
        </span>
      </button>

      {open && (
        <>
          {section.emergency && showInlineGetCare && (
            <button
              type="button"
              onClick={onGetCare}
              disabled={ackLoading}
              className="board-care-btn mt-3"
            >
              {ackLoading ? "One sec…" : "Get Care"}
            </button>
          )}
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
                <span className="min-w-0 flex-1 truncate text-xs font-extrabold tracking-wide text-[#2c1622] uppercase">
                  {item.name}
                </span>
                {/* was shrink-0 with no width limit - a long real answer
                    label (vs. these short mock ones) had nowhere to go but
                    to overlap the name on a narrow row; now it shrinks and
                    truncates instead */}
                <span
                  className="max-w-[45%] shrink truncate text-right text-[11px] font-extrabold tracking-wide uppercase"
                  style={{ color: SEVERITY_COLOR[item.severity ?? "mild"] }}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
