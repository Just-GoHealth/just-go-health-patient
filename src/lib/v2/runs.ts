import type { Enrollment, StudentRun } from "./types";

/** The version the student is taking part in now (others are suspended). */
export function activeEnrollment(enrollments: Enrollment[]): Enrollment | null {
  return enrollments.find((e) => e.status === "ACTIVE") ?? null;
}

/** The latest submitted run for a version: the one the board shows. */
export function latestSubmittedRun(
  runs: StudentRun[],
  versionCode: string,
): StudentRun | null {
  return runs
    .filter(
      (r) =>
        r.versionCode === versionCode &&
        r.status === "SUBMITTED" &&
        !!r.submittedAt,
    )
    .reduce<StudentRun | null>(
      (latest, r) =>
        !latest || (r.submittedAt ?? "") > (latest.submittedAt ?? "")
          ? r
          : latest,
      null,
    );
}

/** Index of the first item without an answer (the last one when all are answered). */
export function firstUnansweredIndex(
  itemCodes: string[],
  answered: ReadonlySet<string>,
): number {
  const i = itemCodes.findIndex((code) => !answered.has(code));
  return i === -1 ? Math.max(0, itemCodes.length - 1) : i;
}
