import { http } from "./http";
import type {
  CodePurpose,
  LookupResponse,
  Me,
  PatientSignUpRequest,
  VerifyResponse,
} from "./types";

// Every /auth call from this app is made as a patient.
const ROLE = "PATIENT" as const;

/** `{exists, claimed, nickname}` — `nickname` is for the "welcome back" greeting. */
export function lookup(contact: string) {
  return http.post<LookupResponse>("/auth/lookup", { contact, role: ROLE });
}

/** 202: a SIGN_UP code is sent by SMS or email. */
export function signUp(body: PatientSignUpRequest) {
  return http.post<void>("/auth/patient/sign-up", body);
}

/** SIGN_UP answers `{me}` (signed in); RECOVERY answers `{grant}`. */
export function verify(contact: string, purpose: CodePurpose, code: string) {
  return http.post<VerifyResponse>("/auth/verify", {
    contact,
    role: ROLE,
    purpose,
    code,
  });
}

/** Resends a code (the old one stops working). Always 202. */
export function resendCode(contact: string, purpose: CodePurpose) {
  return http.post<void>("/auth/codes", { contact, role: ROLE, purpose });
}

export function signIn(contact: string, password: string) {
  return http.post<Me>("/auth/sign-in", { contact, role: ROLE, password });
}

/** Sends a RECOVERY code. Always 202, whether or not the contact exists. */
export function startRecovery(contact: string) {
  return http.post<void>("/auth/recovery", { contact, role: ROLE });
}

/** Sets the new password with the recovery grant; signs in and ends other sessions. */
export function setPassword(grant: string, password: string) {
  return http.post<Me>("/auth/password", { grant, password });
}

/** The session's source of truth. 401 NOT_SIGNED_IN when there is none. */
export function getMe() {
  return http.get<Me>("/auth/me");
}

/** The student's own nickname counts as free. */
export function isNicknameAvailable(nickname: string, signal?: AbortSignal) {
  return http.get<{ available: boolean }>("/patients/nickname-available", {
    query: { nickname },
    signal,
  });
}
