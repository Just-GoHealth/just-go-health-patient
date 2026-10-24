/**
 * Backend v2 types used by the patient app, exactly as V2-API-CONTRACT.md lists
 * them (JSON keys are the Java record component names; nulls are sent as null).
 */

export type UUID = string;
/** ISO-8601 UTC instant, e.g. "2026-10-16T09:30:00Z". */
export type ISOInstant = string;
/** "YYYY-MM-DD" */
export type ISODate = string;

// ---------- Paging ----------
export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
}
export interface PageParams {
  /** >= 0, default 0 */
  page?: number;
  /** default 20, max 100 */
  size?: number;
}

/** null when there is no image. Private photos are signed URLs valid 15 min. */
export interface Image {
  url: string;
  thumbnailUrl: string;
}

// ---------- Enums ----------
export type Role = "PATIENT" | "PROVIDER" | "CURATOR";
export type PatientNext =
  "PHOTO" | "SCHOOL_TYPE" | "PROGRAMME" | "GRADE" | "FINISH" | "HOME";
export type Gender = "MALE" | "FEMALE";
export type Grade =
  "SHS_1" | "SHS_2" | "SHS_3" | "YEAR_1" | "YEAR_2" | "YEAR_3" | "YEAR_4";
export type CampusCard = "HIGH_SCHOOL" | "COLLEGE";
export type CodePurpose = "SIGN_UP" | "RECOVERY" | "CLAIM";
export type ContactKind = "EMAIL" | "PHONE";
export type NsmqKind = "D1" | "T3" | "TPLUS";
export type RunStatus = "IN_PROGRESS" | "SUBMITTED" | "EXPIRED";
export type Urgency = "NOW" | "SOON" | "ROUTINE";
export type VersionStatus = "OPENS_SOON" | "LIVE" | "CLOSED" | "INVITE_ONLY";
export type EnrollmentStatus = "ACTIVE" | "SUSPENDED";
export type TeamStatus = "REGISTERED" | "ACTIVE" | "ELIMINATED" | "CHAMPION";

// ---------- Auth ----------
export interface PatientMeProfile {
  fullName: string;
  initials: string;
  nickname: string;
  onboarded: boolean;
}
/** `GET /auth/me` for this app. Only the PATIENT variant is ever used here. */
export interface Me {
  accountId: UUID;
  role: "PATIENT";
  contact: string;
  next: PatientNext;
  profile: PatientMeProfile | null;
}

export interface LookupResponse {
  exists: boolean;
  claimed: boolean;
  nickname: string | null;
}
/** SIGN_UP → {me}; RECOVERY → {grant} */
export interface VerifyResponse {
  me: Me | null;
  grant: string | null;
}
export interface PatientSignUpRequest {
  contact: string;
  password: string;
  fullName: string;
  nickname: string;
  gender: Gender;
  dateOfBirth: ISODate;
}

// ---------- Patient profile and onboarding ----------
export interface PatientCampus {
  id: UUID;
  fullName: string;
  type: string;
  card: CampusCard;
}
export interface PatientProgramme {
  id: UUID;
  fullName: string;
}
export interface PatientHome {
  accountId: UUID;
  fullName: string;
  initials: string;
  nickname: string;
  /** "@" + nickname */
  handle: string;
  age: number;
  gender: Gender;
  dateOfBirth: ISODate;
  contactKind: ContactKind | null;
  contact: string | null;
  photo: Image | null;
  photoSkipped: boolean;
  campus: PatientCampus | null;
  programme: PatientProgramme | null;
  grade: Grade | null;
  /** "SHS 2" | "Year 1" */
  gradeLabel: string | null;
  graduationYear: number | null;
  /** "Class of 2029" */
  classOf: string | null;
  /** [] when there is no campus */
  grades: Grade[];
  next: PatientNext;
  onboarded: boolean;
}
export interface PatientPatchRequest {
  fullName?: string;
  nickname?: string;
  gender?: Gender;
  dateOfBirth?: ISODate;
}
export interface CampusType {
  code: string;
  label: string;
  card: CampusCard;
  quickScreenMinAge: number;
  quickScreenMaxAge: number;
  quickScreenYears: string[];
}
export interface CampusCardItem {
  id: UUID;
  fullName: string;
  nicknames: string[];
  motto: string | null;
  type: string;
  card: CampusCard;
  logo: Image | null;
  lockedIn: number;
}
export interface Choice {
  id: UUID;
  label: string;
  on: boolean;
}
export interface TagSetup {
  tagId: UUID;
  title: string;
  options: Choice[];
}
export interface OfferedProgramme {
  programmeId: UUID;
  fullName: string;
  nicknames: string[];
  bio: string | null;
  cover: Image | null;
  yearsFrom: number;
  yearsTo: number;
  graduationMonth: number;
  graduationMonthOverride: number | null;
  nicknameChoices: Choice[];
  tags: TagSetup[];
}
export interface ProgrammeList {
  /** true when the campus offers nothing yet, so the whole catalogue is listed */
  fromCatalogue: boolean;
  items: OfferedProgramme[];
}

// ---------- NSMQ ----------
export interface VersionView {
  code: string;
  label: string;
  description: string | null;
  status: VersionStatus;
  joinable: boolean;
  startsAt: ISOInstant | null;
  endsAt: ISOInstant | null;
  d1Hours: number;
  t3Hours: number;
  assentText: string | null;
  assentVersion: number;
  campusTypes: string[];
  version: number;
}
export interface PickerCampus {
  id: UUID;
  fullName: string;
  type: string;
}
export interface Enrollment {
  versionCode: string;
  versionLabel: string;
  status: EnrollmentStatus;
  selectedCampusId: UUID | null;
  teamId: UUID | null;
  joinable: boolean;
}
export interface DueRun {
  kind: NsmqKind;
  obligationKey: string;
  from: ISOInstant;
  until: ISOInstant | null;
  runId: UUID | null;
  runStatus: RunStatus | null;
}
export interface EnrollmentStatusView {
  versionCode: string;
  versionLabel: string;
  open: boolean;
  teamId: UUID | null;
  campusId: UUID | null;
  campusName: string | null;
  teamStatus: TeamStatus | null;
  assentNeeded: boolean;
  assentText: string | null;
  assentVersion: number;
  nextKickoff: ISOInstant | null;
  due: DueRun[];
}
export interface JoinBody {
  /** Optional: falls back to the selected campus. */
  campusId?: UUID | null;
  code: string;
  assent: boolean;
}

export interface Instrument {
  id: UUID;
  code: string;
  revision: number;
  title: string;
  sections: InstrumentSection[];
  items: InstrumentItem[];
}
export interface InstrumentSection {
  code: string;
  parentCode: string | null;
  title: string;
  timeLabel: string | null;
  position: number;
  maxScore: number | null;
}
export interface InstrumentItem {
  id: UUID;
  code: string;
  name: string | null;
  sectionCode: string;
  prompt: string;
  helpText: string | null;
  position: number;
  reversed: boolean;
  cssrs: boolean;
  options: InstrumentOption[];
}
export interface InstrumentOption {
  id: UUID;
  label: string;
  description: string | null;
  emoji: string | null;
  score: number;
  position: number;
  safetyEffect: "NONE" | "GMH_VERY_POOR" | "EMERGENCY";
}
/** level 0 is best, 4 is worst. */
export type RunLevel = 0 | 1 | 2 | 3 | 4;
export interface RunSection {
  code: string;
  title: string;
  score: number | null;
  maxScore: number | null;
  level: RunLevel;
  band: string;
  carried: boolean;
}
export interface RunAnswer {
  itemCode: string;
  optionId: UUID;
  optionLabel: string;
}
export interface CarePrompt {
  urgency: Urgency;
  message: string;
}
/** What a student sees of a run. Never carries the triage tag. */
export interface StudentRun {
  id: UUID;
  versionCode: string;
  kind: NsmqKind;
  attempt: number;
  status: RunStatus;
  startedAt: ISOInstant;
  submittedAt: ISOInstant | null;
  closesAt: ISOInstant | null;
  /** ONLY when status === "IN_PROGRESS" */
  questionnaire: Instrument | null;
  answers: RunAnswer[];
  /** [] until submitted */
  sections: RunSection[];
  /** only when SUBMITTED */
  care: CarePrompt | null;
  careAcknowledged: boolean;
}
export interface StartRunBody {
  versionCode: string;
  kind?: NsmqKind;
}
export interface AnswerBody {
  optionId: UUID;
}
export interface Treatment {
  id: UUID;
  name: string;
  rank: number;
  photo: Image | null;
}
export interface OutcomeCare {
  outcomeId: UUID;
  sectionCode: string;
  sectionTitle: string;
  band: string;
  label: string;
  treatments: Treatment[];
}
export interface RunCare {
  first: Treatment[];
  outcomes: OutcomeCare[];
}
