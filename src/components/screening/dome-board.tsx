"use client";

import { useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type { BoardSection } from "@/lib/api";
import { DomeTile } from "./dome-tile";

// the dome row is always a 3-up layout regardless of how many sections the
// backend actually scored - a board with fewer than 3 pads out with empty
// placeholder slots instead of leaving genuine gaps or re-centering.
const MIN_DOME_COUNT = 3;

const STAGGER_Y: Record<number, string> = {
  0: "calc(-1 * clamp(16px, 2.6vh, 32px))",
  1: "clamp(20px, 3.4vh, 42px)",
  2: "calc(-1 * clamp(16px, 2.6vh, 32px))",
};

function EmptyDomeSlot({
  staggerIndex,
  hidden,
}: {
  staggerIndex: number;
  hidden: boolean;
}) {
  return (
    <div
      style={
        { "--dome-stagger": STAGGER_Y[staggerIndex] ?? "0px" } as CSSProperties
      }
      className={cn(
        "flex w-full max-w-[320px] flex-col items-stretch justify-self-center sm:[transform:translateY(var(--dome-stagger))]",
        // fully removed from layout (not faded) when a real dome is open,
        // same as DomeTile's own hidden state — see dome-tile.tsx
        hidden && "hidden",
      )}
    >
      <div className="relative flex aspect-[1.86/1] w-full origin-bottom flex-col items-center justify-center rounded-t-full border border-dashed border-white/[.14] bg-white/[.02] px-4 pb-3 text-center">
        <span className="text-muted/50 text-[11px] font-bold tracking-wide uppercase">
          No data yet
        </span>
      </div>
    </div>
  );
}

export function DomeBoard({
  sections,
  onGetCare,
  ackLoading,
  showInlineGetCare = true,
}: {
  sections: BoardSection[];
  onGetCare: () => void;
  ackLoading: boolean;
  showInlineGetCare?: boolean;
}) {
  // all 3 domes always show closed on load, emergency included - the
  // header-level Get Care pill (or, on /screening, the inline one that
  // now always renders alongside an emergency dome's items once it's
  // opened) already covers "never hidden behind a click", so there's no
  // reason to auto-open and collapse the other two down to nothing.
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const isOpen = openIndex !== null;

  if (!sections.length) return null;

  const slotCount = Math.max(sections.length, MIN_DOME_COUNT);

  return (
    <div
      className="flex min-h-full w-full flex-col items-center justify-center gap-6 py-6"
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("[data-dome-slot]")) {
          setOpenIndex(null);
        }
      }}
    >
      <p className="text-muted/70 text-xs">
        Tap a dome to see every answer behind it.
      </p>
      <div
        className={cn(
          "grid w-full max-w-[1600px] items-start gap-6 px-4 sm:gap-8 sm:px-10",
          // with one open, collapse to a single centered column so the open
          // dome always lands dead-center — always exactly 3 slots
          // otherwise (real sections padded with empty ones), so this no
          // longer needs to branch on the real section count
          isOpen ? "grid-cols-1 justify-items-center" : "grid-cols-1",
          !isOpen && "sm:grid-cols-3",
        )}
      >
        {Array.from({ length: slotCount }, (_, idx) => {
          const section = sections[idx];
          if (!section) {
            return (
              <EmptyDomeSlot
                key={`empty-${idx}`}
                staggerIndex={idx}
                hidden={isOpen}
              />
            );
          }
          const open = openIndex === idx;
          return (
            <DomeTile
              key={section.key ?? idx}
              section={section}
              open={open}
              // fully removed from layout (not just faded) when something
              // else is open, so the open tile's single column truly centers
              hidden={isOpen && !open}
              staggerIndex={idx}
              onToggle={() =>
                setOpenIndex((prev) => (prev === idx ? null : idx))
              }
              onGetCare={onGetCare}
              ackLoading={ackLoading}
              showInlineGetCare={showInlineGetCare}
            />
          );
        })}
      </div>
    </div>
  );
}
