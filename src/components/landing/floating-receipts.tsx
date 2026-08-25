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

// horizontal lanes, spaced far enough apart that two pills never touch
const LANES = [-24, 0, 24];

type Chip = {
  id: number;
  lane: number;
  name: string;
  text: string;
  sx: number;
  sh: number;
  sr: number;
};

export function FloatingReceipts({
  className,
  mobile,
}: {
  className?: string;
  mobile?: boolean;
}) {
  const [chips, setChips] = useState<Chip[]>([]);
  const [heldIds, setHeldIds] = useState<Set<number>>(new Set());
  const idxRef = useRef(0);
  const nextId = useRef(0);
  const occupiedLanes = useRef(new Set<number>());
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    idxRef.current = Math.floor(Math.random() * SECRETS.length);
    // the 3-lane spread needs real horizontal room either side of center -
    // on a narrow phone that overruns the screen edges and collides with
    // whatever else sits at the bottom, so mobile gets a single dead-center
    // lane (one chip at a time) instead
    const lanes = mobile ? [0] : LANES;

    function remove(id: number, lane: number) {
      timers.current.delete(id);
      occupiedLanes.current.delete(lane);
      setChips((prev) => prev.filter((c) => c.id !== id));
    }

    function pop() {
      const freeLanes = lanes.map((_, i) => i).filter(
        (i) => !occupiedLanes.current.has(i),
      );
      if (!freeLanes.length) return; // every lane taken - wait for one to clear

      const lane = freeLanes[Math.floor(Math.random() * freeLanes.length)];
      occupiedLanes.current.add(lane);

      const [name, text] = SECRETS[idxRef.current % SECRETS.length];
      idxRef.current++;
      const id = nextId.current++;
      const chip: Chip = {
        id,
        lane,
        name,
        text,
        sx: lanes[lane] + (mobile ? 0 : Math.random() * 6 - 3),
        sh: -(8 + Math.random() * 14),
        sr: Math.random() * 7 - 3.5,
      };
      setChips((prev) => [...prev, chip]);
      timers.current.set(
        id,
        setTimeout(() => remove(id, lane), 4600),
      );
    }

    pop();
    const interval = setInterval(pop, 2000);
    const activeTimers = timers.current;
    const activeLanes = occupiedLanes.current;
    return () => {
      clearInterval(interval);
      activeTimers.forEach((t) => clearTimeout(t));
      activeTimers.clear();
      activeLanes.clear();
      // a StrictMode dev double-invoke cancels the pending removal timer above
      // but leaves any chip already added to state - clear it explicitly so it
      // doesn't linger forever as an orphan once the effect re-runs.
      setChips([]);
    };
  }, [mobile]);

  function hold(id: number) {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    setHeldIds((prev) => new Set(prev).add(id));
  }

  function release(id: number, lane: number) {
    setHeldIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        occupiedLanes.current.delete(lane);
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
              "--sx": `${chip.sx}vw`,
              "--sh": `${chip.sh}px`,
              "--sr": `${chip.sr}deg`,
            } as React.CSSProperties
          }
          onMouseEnter={() => hold(chip.id)}
          onMouseLeave={() => release(chip.id, chip.lane)}
        >
          <b>{chip.name}</b> {chip.text}
        </span>
      ))}
    </div>
  );
}
