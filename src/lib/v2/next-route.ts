import type { Enrollment, PatientNext } from "./types";

/** The /onboard wizard's post-sign-in steps, one per `me.next` value. */
export type OnboardStep =
  | "photo"
  | "schoolType"
  | "programme"
  | "grade"
  | "finish"
  // the NSMQ team picker + access code: joining a team onboards the student
  | "nsmqCampus";

export type Destination =
  { page: "/home" } | { page: "/onboard"; step: OnboardStep };

/** `me.next` → where the app goes. The single routing table for the patient app. */
export const NEXT_ROUTES: Record<PatientNext, Destination> = {
  PHOTO: { page: "/onboard", step: "photo" },
  SCHOOL_TYPE: { page: "/onboard", step: "schoolType" },
  PROGRAMME: { page: "/onboard", step: "programme" },
  GRADE: { page: "/onboard", step: "grade" },
  FINISH: { page: "/onboard", step: "finish" },
  HOME: { page: "/home" },
};

/** True when the student is enrolled in an NSMQ version but hasn't joined a team. */
export function needsTeam(enrollment: Enrollment | null | undefined): boolean {
  return !!enrollment && !enrollment.teamId && enrollment.joinable;
}

/**
 * Where to go after sign-in, verify, password reset and every onboarding step.
 * A student opened from an NSMQ link (`?v=`) who still needs a team goes to
 * the team picker once the photo step is done: joining onboards them, so the
 * school type / programme / grade steps don't apply.
 */
export function nextDestination(
  next: PatientNext,
  enrollment?: Enrollment | null,
): Destination {
  if (next !== "PHOTO" && needsTeam(enrollment)) {
    return { page: "/onboard", step: "nsmqCampus" };
  }
  return NEXT_ROUTES[next] ?? NEXT_ROUTES.HOME;
}
