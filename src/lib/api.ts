export type ContactType = "PHONE" | "EMAIL";

export type ApiResponse<T> = {
  success?: boolean;
  data?: T;
  message?: string;
};

export class ApiError extends Error {
  status: number;
  // the discriminator the backend actually wants callers to branch on —
  // several failures share an HTTP status (both CODE_ALREADY_USED and
  // CODE_WRONG_CAMPUS are 409) so status/message alone can't tell them apart
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type ErrorEnvelope = {
  errorCode?: string;
  message?: string;
};

// a bare 401 can mean "the access token just expired", not "not signed in" -
// the guide's protocol is to refresh once and retry transparently before
// treating it as a real sign-out. Deduped so concurrent 401s in the same
// moment (e.g. several requests firing on a page mount) share one refresh
// instead of racing multiple refresh-token calls.
let refreshInFlight: Promise<boolean> | null = null;

function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch("/api/v1/patients/auth/refresh-token", {
      method: "POST",
      credentials: "include",
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  isRetryAfterRefresh = false,
): Promise<ApiResponse<T>> {
  // FormData needs the browser to set its own multipart boundary — forcing
  // a JSON content-type here would send the file as a broken request
  const isFormData =
    typeof FormData !== "undefined" && init?.body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });

  // auth/* covers contact-check, signup, otp, signin, and refresh-token
  // itself - none of those should ever trigger a refresh-and-retry loop,
  // since a 401 there means something else (or would recurse forever)
  if (
    res.status === 401 &&
    !isRetryAfterRefresh &&
    !path.startsWith("/v1/patients/auth/")
  ) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiFetch<T>(path, init, true);
    }
  }

  const body = (await res.json().catch(() => ({}))) as ApiResponse<T> & {
    data?: ErrorEnvelope;
  };
  if (!res.ok) {
    const errData = body.data;
    throw new ApiError(
      errData?.message || body.message || `Request failed (${res.status})`,
      res.status,
      errData?.errorCode,
    );
  }
  return body as ApiResponse<T>;
}

function post<T>(path: string, payload?: unknown) {
  return apiFetch<T>(path, {
    method: "POST",
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
  });
}

function put<T>(path: string, payload?: unknown) {
  return apiFetch<T>(path, {
    method: "PUT",
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
  });
}

function get<T>(path: string) {
  return apiFetch<T>(path, { method: "GET" });
}

function del<T>(path: string) {
  return apiFetch<T>(path, { method: "DELETE" });
}

function postForm<T>(path: string, formData: FormData) {
  return apiFetch<T>(path, { method: "POST", body: formData });
}

// ---- Patient Auth ----

export type ContactCheckResponse = {
  exists?: boolean;
  userId?: string;
  nickname?: string;
  nextStep?: "SIGN_IN" | "CREATE_ACCOUNT";
};

export function checkContact(type: ContactType, value: string) {
  return post<ContactCheckResponse>("/v1/patients/auth/contact/check", {
    type,
    value,
  });
}

export type OtpSendResponse = {
  otpReference?: string;
  expiresInSeconds?: number;
};

export function sendOtp(userId: string) {
  return post<OtpSendResponse>("/v1/patients/auth/otp/send", { userId });
}

export type ActiveVersion = {
  code?: string;
  label?: string;
  enrollmentStatus?: string;
  nextStep?: string;
};

export type OtpVerifyResponse = {
  verified?: boolean;
  passwordResetToken?: string;
  nextStep?: string;
  accessToken?: string;
  refreshToken?: string;
  activeVersion?: ActiveVersion;
};

export function verifyOtp(otpReference: string, code: string) {
  return post<OtpVerifyResponse>("/v1/patients/auth/otp/verify", {
    otpReference,
    code,
  });
}

export type ForgotPasswordResponse = {
  otpReference?: string;
  nextStep?: string;
};

// sends a recovery OTP to the contact. The code it produces is verified
// through the SAME endpoint as a normal signup OTP (verifyOtp above) — for
// a recovery otpReference, that endpoint returns only
// { verified, passwordResetToken, nextStep: "NEW_PASSWORD" }, no cookies.
export function forgotPassword(contact: string) {
  return post<ForgotPasswordResponse>("/v1/patients/auth/password/forgot", {
    contact,
  });
}

export type SetPasswordResponse = {
  success?: boolean;
  nextStep?: string;
};

export function setPassword(
  passwordResetToken: string,
  password: string,
  confirmPassword: string,
) {
  return put<SetPasswordResponse>("/v1/patients/auth/password", {
    passwordResetToken,
    password,
    confirmPassword,
  });
}

export type SignupPayload = {
  contactType: ContactType;
  contact: string;
  name: string;
  nickname: string;
  gender: string;
  dateOfBirth: string;
  password: string;
  versionCode?: string;
};

export type SignupResponse = {
  userId?: string;
  verificationRequired?: boolean;
  otpReference?: string;
  nextStep?: string;
  versionCode?: string;
};

export function signup(payload: SignupPayload) {
  return post<SignupResponse>("/v1/patients/auth/signup", payload);
}

export type SigninResponse = {
  accessToken?: string;
  refreshToken?: string;
  nickname?: string;
  onboardingCompleted?: boolean;
  nextStep?: string;
  userId?: string;
  otpReference?: string;
  activeVersion?: ActiveVersion;
};

export function signin(
  contact: string,
  password: string,
  versionCode?: string,
) {
  return post<SigninResponse>("/v1/patients/auth/signin", {
    contact,
    password,
    versionCode,
  });
}

// the backend has no signout endpoint (auth is entirely the __Host-* session
// cookies signin/verify set) - this hits our own Next.js route instead of
// the proxied backend, since only a same-origin response can expire them
export function logout() {
  return post<{ success?: boolean }>("/logout");
}

export type LockinVersionResponse = {
  code?: string;
  label?: string;
  tagline?: string;
  audience?: string;
  themeKey?: string;
  status?: string;
  joinable?: boolean;
  startsAt?: string;
  endsAt?: string;
  inPeriod?: boolean;
  campusTypes?: string[];
  windows?: { kind?: string; label?: string; heading?: string; cardLabel?: string; cardValue?: string }[];
  assentText?: string;
  assentTextVersion?: string;
};

export function getLockinVersion(versionCode: string) {
  return get<LockinVersionResponse>(
    `/v1/lockin-versions/${encodeURIComponent(versionCode)}`,
  );
}

// public, no auth - the version-picker landing list (§3). This app currently
// only ever shows nsmq2026 directly rather than a picker, so nothing calls
// this yet, but it's part of the documented contract
export function getLockinVersions() {
  return get<LockinVersionResponse[]>("/v1/lockin-versions");
}

export function uploadProfilePhoto(photo: Blob) {
  const formData = new FormData();
  formData.append("photo", photo, "photo.jpg");
  return postForm<{ nextStep?: string }>(
    "/v1/patients/profile/photo",
    formData,
  );
}

// the skip is always offered — a student without a usable camera must still
// be able to finish onboarding
export function skipProfilePhoto() {
  return post<{ nextStep?: string }>("/v1/patients/profile/photo/skip");
}

export type HomeProfileResponse = {
  userId?: string;
  photoUrl?: string;
  nickname?: string;
  fullName?: string;
  verified?: boolean;
  age?: number;
  gender?: string;
  graduationYear?: number;
  gradeLabel?: string;
  school?: { id?: number; name?: string };
};

export function getHomeProfile() {
  return get<HomeProfileResponse>("/v1/patients/profile/me");
}

// ---- Patient Teams / Enrollments (version-scoped) ----

export type CampusPickerItem = {
  campusId: number;
  fullName?: string;
  nickname?: string;
  logo?: string;
  bannerPhoto?: string;
  teamId?: number;
  memberCount?: number;
  scheduledAt?: string;
  whenLabel?: string;
  state?: "today" | "tomorrow" | "future" | "out";
};

export function getVersionCampuses(versionCode: string, q?: string) {
  const query = q ? `?q=${encodeURIComponent(q)}` : "";
  return get<CampusPickerItem[]>(
    `/v1/patients/versions/${encodeURIComponent(versionCode)}/campuses${query}`,
  );
}

export type SelectCampusResponse = {
  campusId?: number;
  campusName?: string;
  campusLogo?: string;
  nextStep?: string;
};

export function selectVersionCampus(versionCode: string, campusId: number) {
  return put<SelectCampusResponse>(
    `/v1/patients/versions/${encodeURIComponent(versionCode)}/campus`,
    { campusId },
  );
}

// call when the student backs out of the code modal to browse other
// schools - without this the server still has the old campus recorded, so
// nextStep keeps resuming at ACCESS_CODE for that campus instead of letting
// them land back on the picker
export function deleteVersionCampus(versionCode: string) {
  return del<{ nextStep?: string }>(
    `/v1/patients/versions/${encodeURIComponent(versionCode)}/campus`,
  );
}

export type CountdownResponse = {
  text?: string;
  hoursToContest?: number;
  soon?: boolean;
  out?: boolean;
};

export type JoinTeamResponse = {
  teamId?: number;
  campusId?: number;
  campusName?: string;
  campusLogo?: string;
  nextStep?: string;
  window?: string;
  countdown?: CountdownResponse;
  enrollmentStatus?: string;
  alreadyJoined?: boolean;
};

export function joinVersionTeam(
  versionCode: string,
  payload: {
    campusId: number;
    accessCode: string;
    assentAccepted: boolean;
    assentTextVersion?: string;
  },
) {
  return post<JoinTeamResponse>(
    `/v1/patients/versions/${encodeURIComponent(versionCode)}/join`,
    payload,
  );
}

// the copy the integration guide specifies per errorCode for the join
// endpoint — two of these share HTTP 409, so status alone can't pick copy
export const JOIN_ERROR_COPY: Record<string, string> = {
  CODE_INVALID: "The access code you entered is incorrect.",
  CODE_ALREADY_USED: "This code has already been used.",
  CODE_WRONG_CAMPUS: "That code belongs to a different school.",
  CODE_EXPIRED: "That code has expired. Ask your team for a new one.",
  TOO_MANY_ATTEMPTS: "Too many attempts. Please wait a while and try again.",
};

export type EnrollmentSummary = {
  versionCode?: string;
  versionLabel?: string;
  status?: string; // PENDING | ACTIVE | SUSPENDED
  nextStep?: string; // where THIS version would resume, not what to do now
};

// lists every version the patient takes part in - e.g. to render "you have
// a paused UG Law run" alongside the active one. Not wired into any UI yet,
// since this app currently only ever operates on nsmq2026 directly
export function getEnrollments() {
  return get<EnrollmentSummary[]>("/v1/patients/enrollments");
}

export function activateEnrollment(versionCode: string) {
  return post<{ nextStep?: string }>(
    `/v1/patients/enrollments/${encodeURIComponent(versionCode)}/activate`,
  );
}

// the three canonical fields (§1.5) - status/tool supersede the legacy
// category/currentWindow/screeningTool naming. currentWindow is kept for
// existing display code; new logic should prefer status/tool.
export type MembershipResponse = {
  teamId?: number;
  campusId?: number;
  campusName?: string;
  campusLogo?: string;
  teamStatus?: string;
  versionCode?: string;
  versionLabel?: string;
  currentWindow?: string;
  status?: "TOMORROW" | "TODAY" | "OUT";
  tool?: "D1" | "T3" | "TPLUS";
  internalReason?: string;
  countdown?: CountdownResponse;
  screeningDue?: boolean;
  openScreeningId?: string;
  nextStep?: string;
};

export function getVersionMembership(versionCode: string) {
  return get<MembershipResponse>(
    `/v1/patients/versions/${encodeURIComponent(versionCode)}/membership`,
  );
}

// ---- The screening (§8) ----

export type ScreeningOption = {
  index?: number;
  emoji?: string;
  label?: string;
  sub?: string;
};

export type ScreeningItem = {
  itemCode?: string;
  name?: string;
  shortName?: string;
  section?: string;
  question?: string;
  help?: string;
  cssrs?: boolean;
  options?: ScreeningOption[];
  answeredIndex?: number | null;
};

export type ScreeningRun = {
  screeningId?: string;
  window?: string; // PRE_LONG | PRE_SHORT | POST
  label?: string;
  heading?: string;
  publicStatus?: "TOMORROW" | "TODAY" | "OUT"; // §1.5 canonical status
  tool?: "D1" | "T3" | "TPLUS"; // §1.5 canonical tool
  status?: string; // run status, e.g. IN_PROGRESS - distinct from publicStatus
  countdown?: CountdownResponse;
  answered?: number;
  total?: number;
  riskCode?: string;
  riskLevel?: number;
  items?: ScreeningItem[];
  answeredIndexes?: number[];
};

export function startOrResumeScreening(versionCode: string) {
  return post<ScreeningRun>("/v1/patients/screenings", { versionCode });
}

export function getScreening(screeningId: string) {
  return get<ScreeningRun>(
    `/v1/patients/screenings/${encodeURIComponent(screeningId)}`,
  );
}

export type ScreeningAnswerResponse = {
  itemCode?: string;
  optionIndex?: number;
  answered?: number;
  total?: number;
  riskCode?: string;
  riskLevel?: number;
  complete?: boolean;
};

export function answerScreeningItem(
  screeningId: string,
  itemCode: string,
  optionIndex: number,
) {
  return put<ScreeningAnswerResponse>(
    `/v1/patients/screenings/${encodeURIComponent(screeningId)}/answers/${encodeURIComponent(itemCode)}`,
    { optionIndex },
  );
}

export type BoardSectionItem = {
  itemCode?: string;
  name?: string;
  label?: string;
  severity?: string; // mild | mod | sev
};

export type BoardSection = {
  key?: string;
  title?: string;
  time?: string;
  score?: number;
  max?: number;
  band?: string;
  fam?: string; // green | gold | red | emg
  emergency?: boolean;
  items?: BoardSectionItem[];
};

export type ScreeningBoard = {
  screeningId?: string;
  run?: string;
  label?: string;
  head?: string;
  at?: string;
  school?: string;
  publicStatus?: "TOMORROW" | "TODAY" | "OUT"; // §1.5 canonical status
  tool?: "D1" | "T3" | "TPLUS"; // §1.5 canonical tool
  // triage - server-decided, never recompute these client-side (§9)
  tag?: "911" | "NOW" | "ASAP";
  reasonCode?: string; // stable, machine-readable first-match rule
  reason?: string; // display copy for reasonCode - may change, don't key logic on it
  load?: number;
  peak?: number;
  cross?: number | null;
  // true when a T-3 run's carried D-1 gmh context is missing - a visible
  // data-quality flag, not an instruction to fabricate/backfill it
  carriedContextMissing?: boolean;
  emergency?: boolean;
  careAcknowledged?: boolean;
  sections?: BoardSection[];
};

export function submitScreening(screeningId: string) {
  return post<ScreeningBoard>(
    `/v1/patients/screenings/${encodeURIComponent(screeningId)}/submit`,
  );
}

// ---- The result board (§9) ----

// 204 No Content is a normal outcome here — no board yet, or the last run
// was a contest-day (PRE_SHORT) one, which never produces a board. apiFetch
// returns an empty envelope (data: undefined) for a bodyless 204, so callers
// should treat a missing `data` as "open the day view", not as an error.
export function getLatestBoard(versionCode: string) {
  return get<ScreeningBoard>(
    `/v1/patients/screenings/latest?versionCode=${encodeURIComponent(versionCode)}`,
  );
}

export function acknowledgeCare(screeningId: string) {
  return post<ScreeningBoard>(
    `/v1/patients/screenings/${encodeURIComponent(screeningId)}/care-ack`,
  );
}
