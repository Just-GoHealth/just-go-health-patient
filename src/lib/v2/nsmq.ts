import { http } from "./http";
import type {
  AnswerBody,
  Enrollment,
  EnrollmentStatusView,
  JoinBody,
  NsmqKind,
  PickerCampus,
  RunCare,
  StudentRun,
  UUID,
  VersionView,
} from "./types";

const v = (code: string) => encodeURIComponent(code);

// ---- Versions (public) ----

export function getVersion(code: string) {
  return http.get<VersionView>(`/versions/${v(code)}`);
}

/** The schools taking part, for the picker. A plain array, not a page. */
export function getVersionCampuses(code: string, q?: string) {
  return http.get<PickerCampus[]>(`/versions/${v(code)}/campuses`, {
    query: { q },
  });
}

// ---- Enrollments ----

export function getEnrollments() {
  return http.get<Enrollment[]>("/me/enrollments");
}

/** Enrolls and makes this version the active one (after sign-in from a `?v=` link). */
export function enroll(code: string) {
  return http.post<Enrollment>(`/me/enrollments/${v(code)}`);
}

/** Remembers the picked school before the access code is typed. */
export function selectCampus(code: string, campusId: UUID) {
  return http.put<Enrollment>(`/me/enrollments/${v(code)}/campus`, {
    campusId,
  });
}

/** Joins the team with the access code. The student must have read `assentText`. */
export function join(code: string, body: JoinBody) {
  return http.post<EnrollmentStatusView>(
    `/me/enrollments/${v(code)}/join`,
    body,
  );
}

/** Re-accepts after the assent wording changed (`assentNeeded`). */
export function acceptAssent(code: string) {
  return http.post<EnrollmentStatusView>(`/me/enrollments/${v(code)}/assent`);
}

/** NOT_FOUND when the student isn't enrolled in this version. */
export function getStatus(code: string) {
  return http.get<EnrollmentStatusView>(`/me/enrollments/${v(code)}/status`);
}

// ---- Runs ----

/**
 * Starts the run due now, or returns the latest one for that obligation
 * (including an already SUBMITTED one). Leave `kind` out to take whichever is due.
 */
export function startRun(versionCode: string, kind?: NsmqKind) {
  return http.post<StudentRun>("/me/runs", {
    versionCode,
    ...(kind ? { kind } : {}),
  });
}

export function getRuns() {
  return http.get<StudentRun[]>("/me/runs");
}

export function getRun(id: UUID) {
  return http.get<StudentRun>(`/me/runs/${v(id)}`);
}

/** Saves one answer; re-sending changes it. */
export function answer(id: UUID, itemCode: string, optionId: UUID) {
  const body: AnswerBody = { optionId };
  return http.put<StudentRun>(
    `/me/runs/${v(id)}/answers/${encodeURIComponent(itemCode)}`,
    body,
  );
}

/** Scores the run. Every item needs an answer (ANSWERS_MISSING). */
export function submitRun(id: UUID) {
  return http.post<StudentRun>(`/me/runs/${v(id)}/submit`);
}

/** A new attempt while the window is open. The latest attempt counts. */
export function retakeRun(id: UUID) {
  return http.post<StudentRun>(`/me/runs/${v(id)}/retake`);
}

/** The student saw the care prompt. */
export function acknowledgeCare(id: UUID) {
  return http.post<StudentRun>(`/me/runs/${v(id)}/care-ack`);
}

/** The Waiting Room. Never 404s: empty lists instead. */
export function getRunCare(id: UUID) {
  return http.get<RunCare>(`/me/runs/${v(id)}/care`);
}
