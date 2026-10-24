import { http } from "./http";
import type { Grade, PatientHome, PatientPatchRequest, UUID } from "./types";

// Every /patients/me* call needs the PATIENT role and answers the full home
// profile, including the new `next` to route by.

export function getProfile() {
  return http.get<PatientHome>("/patients/me");
}

/** Edits after onboarding. Omitted fields stay as they are. */
export function updateProfile(patch: PatientPatchRequest) {
  return http.patch<PatientHome>("/patients/me", patch);
}

/** Multipart field `file`: the already-cropped JPEG, PNG or WEBP, up to 5 MB. */
export function uploadPhoto(photo: Blob) {
  const form = new FormData();
  const ext =
    photo.type === "image/png"
      ? "png"
      : photo.type === "image/webp"
        ? "webp"
        : "jpg";
  form.append("file", photo, `photo.${ext}`);
  return http.upload<PatientHome>("/patients/me/photo", form, "PUT");
}

export function skipPhoto() {
  return http.post<PatientHome>("/patients/me/photo/skip");
}

/** During onboarding only (CAMPUS_LOCKED afterwards). */
export function setCampus(campusId: UUID) {
  return http.put<PatientHome>("/patients/me/campus", { campusId });
}

export function setProgramme(programmeId: UUID) {
  return http.put<PatientHome>("/patients/me/programme", { programmeId });
}

export function setGrade(grade: Grade) {
  return http.put<PatientHome>("/patients/me/grade", { grade });
}

/** ONBOARDING_INCOMPLETE carries `fields:[{field:"next", message:<PatientNext>}]`. */
export function finishOnboarding() {
  return http.post<PatientHome>("/patients/me/onboarding/finish");
}
