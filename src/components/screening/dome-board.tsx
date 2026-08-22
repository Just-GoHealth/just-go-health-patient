"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { BoardSection } from "@/lib/api";
import { DomeTile } from "./dome-tile";

export function DomeBoard({
  sections,
  onGetCare,
  ackLoading,
}: {
  sections: BoardSection[];
  onGetCare: () => void;
  ackLoading: boolean;
}) {
  const emergencyIndex = sections.findIndex((s) => s.emergency);
  // the emergency dome opens by default — Get Care is never hidden behind a
  // click, per the product's own rule for this state
  const [openIndex, setOpenIndex] = useState<number | null>(
    emergencyIndex >= 0 ? emergencyIndex : null,
  );
  const isOpen = openIndex !== null;

  if (!sections.length) return null;

  return (
    <div
      className="flex min-h-full w-full flex-col items-center justify-center gap-6 py-6"
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("[data-dome-slot]")) {
          setOpenIndex(emergencyIndex >= 0 ? emergencyIndex : null);
        }
      }}
    >
      {!sections[emergencyIndex]?.emergency && (
        <p className="text-muted/70 text-xs">
          Tap a dome to see every answer behind it.
        </p>
      )}
      <div
        className={cn(
          "grid w-full max-w-[1600px] items-start gap-6 px-4 sm:gap-8 sm:px-10",
          // with one open, collapse to a single centered column so the open
          // dome always lands dead-center regardless of how many sections
          // there are — a fixed 3-column grid otherwise leaves genuinely
          // empty columns (and an off-center dome) whenever there are fewer
          // than 3 sections, e.g. some T-3 boards
          isOpen ? "grid-cols-1 justify-items-center" : "grid-cols-1",
          !isOpen && sections.length >= 3 && "sm:grid-cols-3",
          !isOpen && sections.length === 2 && "sm:grid-cols-2",
        )}
      >
        {sections.map((section, idx) => {
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
            />
          );
        })}
      </div>
    </div>
  );
}
