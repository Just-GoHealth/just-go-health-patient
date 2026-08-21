"use client";

import { useEffect, useRef, useState } from "react";

const SECRETS: [string, string][] = [
  ["@Setornam", "scored 1590 in the SAT"],
  ["@Amara", "made Law Review at Columbia"],
  ["@Dev", "topped the Contracts curve"],
  ["@Mandy", "walked out with 8 A's"],
  ["@Kojo", "topped MB ChB finals"],
  ["@Naledi", "held a 4.0 through 1L"],
  ["@Priya", "clerked the Second Circuit"],
  ["@Yaw", "got the Apple internship"],
  ["@Adjoa", "cleared her tuition in six weeks"],
  ["@Lina", "slept eight hours, thirty nights straight"],
  ["@Jesse", "shipped it before the deadline"],
  ["@Zara", "sat every paper and passed clean"],
];

type Chip = {
  id: number;
  name: string;
  text: string;
  sx: number;
  sh: number;
  sr: number;
};

export function FloatingReceipts({ className }: { className?: string }) {
  const [chips, setChips] = useState<Chip[]>([]);
  const [heldIds, setHeldIds] = useState<Set<number>>(new Set());
  const idxRef = useRef(0);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    idxRef.current = Math.floor(Math.random() * SECRETS.length);

    function remove(id: number) {
      timers.current.delete(id);
      setChips((prev) => prev.filter((c) => c.id !== id));
    }

    function pop() {
      const [name, text] = SECRETS[idxRef.current % SECRETS.length];
      idxRef.current++;
      const id = nextId.current++;
      const chip: Chip = {
        id,
        name,
        text,
        sx: Math.random() * 420 - 210,
        sh: -40 - Math.random() * 260,
        sr: Math.random() * 7 - 3.5,
      };
      setChips((prev) => [...prev, chip]);
      timers.current.set(
        id,
        setTimeout(() => remove(id), 4600),
      );
    }

    function burst() {
      const n = 1 + Math.floor(Math.random() * 3);
      for (let q = 0; q < n; q++) {
        setTimeout(pop, q * (90 + Math.random() * 140));
      }
    }

    burst();
    const interval = setInterval(burst, 3000);
    const activeTimers = timers.current;
    return () => {
      clearInterval(interval);
      activeTimers.forEach((t) => clearTimeout(t));
      activeTimers.clear();
    };
  }, []);

  function hold(id: number) {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    setHeldIds((prev) => new Set(prev).add(id));
  }

  function release(id: number) {
    setHeldIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        setChips((prev) => prev.filter((c) => c.id !== id));
      }, 1100),
    );
  }

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute h-0 w-0 ${className ?? ""}`}
    >
      {chips.map((chip) => (
        <span
          key={chip.id}
          className={`sec pointer-events-auto ${heldIds.has(chip.id) ? "held" : ""}`}
          style={
            {
              "--sx": `${chip.sx}px`,
              "--sh": `${chip.sh}px`,
              "--sr": `${chip.sr}deg`,
            } as React.CSSProperties
          }
          onMouseEnter={() => hold(chip.id)}
          onMouseLeave={() => release(chip.id)}
        >
          <b>{chip.name}</b> {chip.text}
        </span>
      ))}
    </div>
  );
}
