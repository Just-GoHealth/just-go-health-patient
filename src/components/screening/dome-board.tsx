"use client";

import { useState } from "react";
import type { BoardSection } from "@/lib/api";
import { DomeTile } from "./dome-tile";

// generalizes the dwen-wo-ho provider board's fixed 3-item order table to any
// section count: the open tile always lands in the middle grid column, and
// the others keep their original relative left-to-right order around it
function computeOrder(n: number, openIndex: number | null, idx: number): number {
  if (openIndex == null || n < 3) return idx;
  const mid = Math.floor((n - 1) / 2);
  if (idx === openIndex) return mid;
  const others = Array.from({ length: n }, (_, i) => i).filter(
    (i) => i !== openIndex,
  );
  const pos = others.indexOf(idx);
  return pos < mid ? pos : pos + 1;
}

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
      <div className="grid w-full max-w-[1600px] grid-cols-1 items-start gap-6 px-4 sm:grid-cols-3 sm:gap-8 sm:px-10">
        {sections.map((section, idx) => {
          const isOpen = openIndex === idx;
          return (
            <DomeTile
              key={section.key ?? idx}
              section={section}
              open={isOpen}
              hidden={openIndex !== null && !isOpen}
              order={computeOrder(sections.length, openIndex, idx)}
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
