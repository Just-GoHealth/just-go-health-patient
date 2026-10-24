import type { CampusCard, Grade, NsmqKind } from "./types";

/** "SHS_2" → "SHS 2", "YEAR_1" → "Year 1" (same wording as `gradeLabel`). */
export function gradeLabel(grade: Grade): string {
  const [stage, n] = grade.split("_");
  return stage === "SHS" ? `SHS ${n}` : `Year ${n}`;
}

export const CARD_LABEL: Record<CampusCard, string> = {
  HIGH_SCHOOL: "High school",
  COLLEGE: "College",
};

export const KIND_LABEL: Record<NsmqKind, string> = {
  D1: "D-1 check · the day before your contest",
  T3: "T-3 check · the last 3 hours before kickoff",
  TPLUS: "T+ check · after the contest",
};

/** Seconds from now until an ISO instant (0 once it has passed). */
export function secondsUntil(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return 0;
  return Math.max(0, Math.floor((new Date(iso).getTime() - now) / 1000));
}

/** 266400 → "3d 2h", 7500 → "2h 05m", 754 → "12:34". */
export function formatTimeLeft(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  // same "m:ss" as the package's formatCountdown, kept here so this module
  // stays free of UI imports
  return `${minutes}:${String(s % 60).padStart(2, "0")}`;
}
