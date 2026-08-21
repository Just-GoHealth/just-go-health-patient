export type ContactType = "PHONE" | "EMAIL";

export type ApiResponse<T> = {
  success?: boolean;
  data?: T;
  message?: string;
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResponse<T>> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const body = (await res.json().catch(() => ({}))) as ApiResponse<T>;
  if (!res.ok) {
    throw new ApiError(
      body.message || `Request failed (${res.status})`,
      res.status,
    );
  }
  return body;
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

// ---- Patient Auth ----

export type ContactCheckResponse = {
  exists?: boolean;
  userId?: string;
  nickname?: string;
  nextStep?: string;
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
  state?: string;
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

export type MembershipResponse = {
  teamId?: number;
  campusId?: number;
  campusName?: string;
  campusLogo?: string;
  teamStatus?: string;
  versionCode?: string;
  versionLabel?: string;
  currentWindow?: string;
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
