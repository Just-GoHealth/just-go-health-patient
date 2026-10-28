"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  Button,
  Field as UiField,
  ImageCard,
  Input,
  Logo,
  OtpInput,
  PasswordInput,
  PhotoUpload,
  RadioGroup,
  Select,
  Spinner,
  ToggleGroup,
  cn,
  formatCountdown,
  useCountdown,
  type FieldProps,
  type PasswordRule,
} from "@just-gohealth/ui";
import { CodeGateModal } from "@/components/onboard/code-gate-modal";
import { GhanaFlag } from "@/components/onboard/ghana-flag";
import { PhotoTestimonialPanel } from "@/components/onboard/photo-testimonial-panel";
import { ApiErrorText } from "@/components/shared/api-error-text";
import { useToast } from "@/components/shared/toast";
import { ONBOARD_STORAGE_KEY } from "@/lib/constants";
import {
  clearVersionCode,
  getVersionCode,
  rememberVersionCode,
} from "@/lib/version-link";
import type { ApiError } from "@/lib/v2/http";
import {
  asApiError,
  formLevelError,
  isSignedOut,
  isUnexpected,
  localError,
} from "@/lib/v2/errors";
import * as auth from "@/lib/v2/auth";
import * as patient from "@/lib/v2/patient";
import { getCampusTypes, getProgrammes, searchCampuses } from "@/lib/v2/campus";
import {
  enroll,
  getVersion,
  getVersionCampuses,
  join,
  selectCampus,
} from "@/lib/v2/nsmq";
import { CARD_LABEL, gradeLabel } from "@/lib/v2/labels";
import { nextDestination, type OnboardStep } from "@/lib/v2/next-route";
import type {
  CampusCard,
  CampusCardItem,
  CodePurpose,
  Enrollment,
  Gender,
  Grade,
  Me,
  OfferedProgramme,
  PatientHome,
  PatientNext,
  PickerCampus,
} from "@/lib/v2/types";
import { useNicknameCheck } from "@/lib/v2/use-nickname-check";
import { useRateLimit } from "@/lib/v2/use-rate-limit";

type ContactType = "PHONE" | "EMAIL";

// before sign-in
type AuthStep =
  | "choice"
  | "phone"
  | "email"
  | "signup"
  | "verify"
  | "signin"
  | "forgotVerify"
  | "resetPassword";

// after sign-in: the `me.next` steps (src/lib/v2/next-route.ts) plus the
// campus picker that follows the school type
type Step = AuthStep | OnboardStep | "campus";

const AUTH_STEPS: Step[] = [
  "choice",
  "phone",
  "email",
  "signup",
  "verify",
  "signin",
  "forgotVerify",
  "resetPassword",
];

// dev-only shortcut so later steps can be reviewed without a real code —
// never active in a production build. Steps that call real backend endpoints
// on submit still do (and will fail without a real session); this only gets
// you to the screen to look at it.
const DEV_JUMP_ENABLED = process.env.NODE_ENV !== "production";
const DEV_JUMP_STEPS = ["photo", "schoolType", "nsmqCampus", "code"] as const;

const DEV_MOCK_CAMPUSES: PickerCampus[] = [
  {
    id: "dev-1",
    fullName: "Presbyterian Boys Senior High School",
    type: "SHS",
  },
  { id: "dev-2", fullName: "Mfantsipim School", type: "SHS" },
  { id: "dev-3", fullName: "Wesley Girls High School", type: "SHS" },
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
// full names crowd the narrow Day/Month/Year row on mobile - the short name
// is shown there instead, while the option's value stays the full month
// name either way (MONTHS.indexOf(dobMonth) relies on that)
const MONTH_OPTIONS = MONTHS.map((m) => ({
  value: m,
  label: (
    <>
      <span className="sm:hidden">{m.slice(0, 3)}</span>
      <span className="hidden sm:inline">{m}</span>
    </>
  ),
}));

// title-cases as you type ("john kwame" -> "John Kwame") and strips anything
// that isn't a letter, space, apostrophe or hyphen - a real name, not a handle
function smartName(raw: string): string {
  let v = raw.replace(/[^a-zA-ZÀ-ɏ' -]/g, "");
  v = v.replace(/\s{2,}/g, " ").replace(/^\s+/, "");
  v = v.replace(/(^\s*[a-zA-ZÀ-ɏ])|(\s+[a-zA-ZÀ-ɏ])/g, (m) => m.toUpperCase());
  return v.slice(0, 100);
}

// the server's nickname rule: letters, numbers and _ . ' - with no spaces,
// 30 characters at most
function sanitizeNickname(raw: string): string {
  return raw.replace(/[^\p{L}\p{M}\p{N}_.'’-]/gu, "").slice(0, 30);
}

const toOptions = (values: string[]) =>
  values.map((v) => ({ value: v, label: v }));
const DAY_OPTIONS = toOptions(
  Array.from({ length: 31 }, (_, i) => String(i + 1)),
);
// the server accepts birth years 1980–2015
const YEAR_OPTIONS = toOptions(
  Array.from({ length: 2015 - 1980 + 1 }, (_, i) => String(2015 - i)),
);

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
];

const CONTACT_OPTIONS = (["PHONE", "EMAIL"] as ContactType[]).map((type) => ({
  value: type,
  label: (
    <span className="flex flex-col items-center gap-3 py-4 font-bold">
      <span className="text-gold">{type === "PHONE" ? "☎" : "✉"}</span>
      {type}
    </span>
  ),
}));

// the app's own password rules (6+ chars, a letter, a number) for the shared
// PasswordInput checklist. PasswordRule ids are a fixed set, so "a letter"
// rides on the "lowercase" id with its own test.
const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: "6+ characters", test: (p) => p.length >= 6 },
  { id: "lowercase", label: "One letter", test: (p) => /[A-Za-z]/.test(p) },
  { id: "number", label: "One number", test: (p) => /[0-9]/.test(p) },
];
const PASSWORD_MESSAGE =
  "Use 6 to 72 characters, with at least one letter and one number";

function passwordOk(p: string): boolean {
  return (
    p.length >= 6 &&
    /[A-Za-z]/.test(p) &&
    /[0-9]/.test(p) &&
    new TextEncoder().encode(p).length <= 72
  );
}

const OTP_LENGTH = 6;
// real access codes issued to schools are 9 characters (the server allows
// up to 40, so this is the UI's choice, not a server rule)
const ACCESS_CODE_LENGTH = 9;
// a new code can be asked for once a minute
const RESEND_SECONDS = 60;
// the first OTP box's id, so a failed code can put focus back on it
const OTP_INPUT_ID = "onboard-otp-input";
const SENT_COPY = "If that account exists, we've sent a code.";

// the shared Field (real <label for>, error/description wiring) with this
// screen's small uppercase label style
function Field({ className, ...props }: FieldProps) {
  return (
    <UiField
      className={cn(
        "[&>label]:text-muted gap-1.5 [&>label]:text-xs [&>label]:font-bold [&>label]:tracking-[0.15em] [&>label]:uppercase",
        className,
      )}
      {...props}
    />
  );
}

const inputClass = "rounded-xl text-txt placeholder:text-muted";

// the 6-box code row, sized like the old hand-rolled boxes
const otpClass =
  "mx-auto mt-6 max-w-none justify-center gap-[1.5vw] sm:gap-2 [&_input]:aspect-[4/5] [&_input]:w-[clamp(32px,11vw,44px)] [&_input]:max-w-none [&_input]:flex-none [&_input]:rounded-xl [&_input]:font-sans [&_input]:text-[clamp(16px,4.5vw,20px)] [&_input]:font-bold";

// two side-by-side choice cards (phone/email, high school/college). The dot
// sits in the card's corner so the label centres on the card, not beside it.
const pickCardGroupClass =
  "mt-8 grid-cols-2 gap-4 sm:grid-cols-2 [&>label]:relative [&>label]:justify-center [&>label]:rounded-2xl [&>label]:bg-black/20 [&_[data-slot=radio-group-item]]:absolute [&_[data-slot=radio-group-item]]:top-3 [&_[data-slot=radio-group-item]]:left-3 [&_[data-slot=radio-group-item]]:mt-0";

const backClass =
  "border-white/15 font-semibold text-white/70 hover:border-white/30 hover:bg-transparent hover:text-white";

const resendClass =
  "text-muted mt-6 h-auto px-0 text-sm font-medium disabled:opacity-60";

const pickCardClass =
  "w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-left transition-colors hover:border-gold disabled:opacity-60";

const PROGRESS: Record<Step, number> = {
  choice: 4,
  phone: 8,
  email: 8,
  signup: 20,
  verify: 30,
  signin: 15,
  forgotVerify: 15,
  resetPassword: 15,
  photo: 45,
  schoolType: 55,
  campus: 65,
  nsmqCampus: 65,
  programme: 75,
  grade: 85,
  finish: 95,
};

const SIGNUP_FIELDS = [
  "fullName",
  "nickname",
  "gender",
  "dateOfBirth",
  "password",
] as const;

type SavedProgress = {
  step?: Step;
  contactType?: ContactType;
  selectedType?: ContactType | null;
  contactValue?: string;
  signinNickname?: string;
  name?: string;
  nickname?: string;
  gender?: Gender | "";
  dobDay?: string;
  dobMonth?: string;
  dobYear?: string;
};

export default function OnboardPage() {
  return (
    <Suspense fallback={null}>
      <OnboardPageInner />
    </Suspense>
  );
}

function OnboardPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const devJumpParam = searchParams.get("devstep");
  const devJumpStep =
    DEV_JUMP_ENABLED &&
    (DEV_JUMP_STEPS as readonly string[]).includes(devJumpParam ?? "")
      ? (devJumpParam as (typeof DEV_JUMP_STEPS)[number])
      : null;
  // "code" isn't a real step (it's a modal over the team picker) —
  // devstep=code lands on nsmqCampus with the modal pre-opened
  const [step, setStep] = useState<Step>(
    devJumpStep === "code" ? "nsmqCampus" : (devJumpStep ?? "choice"),
  );
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);
  const rateLimit = useRateLimit();
  const resend = useCountdown(0);

  const [contactType, setContactType] = useState<ContactType>("PHONE");
  const [selectedType, setSelectedType] = useState<ContactType | null>(null);
  const [contactValue, setContactValue] = useState("");
  const [signinNickname, setSigninNickname] = useState("");

  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [dobDay, setDobDay] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobYear, setDobYear] = useState("");
  const [password, setPassword] = useState("");
  const nicknameTaken = useNicknameCheck(step === "signup" ? nickname : "");

  const [signinPassword, setSigninPassword] = useState("");

  const [grant, setGrant] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [otp, setOtp] = useState("");

  const [photo, setPhoto] = useState<{ blob: Blob; previewUrl: string } | null>(
    null,
  );

  // the signed-in student's profile (campus, grades) and NSMQ enrollment
  const [profile, setProfile] = useState<PatientHome | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  // the NSMQ version from `?v=` (or the landing page's LOCK IN button)
  const linkVersion = searchParams.get("v");
  const [versionCode] = useState<string | null>(() => {
    rememberVersionCode(linkVersion);
    return linkVersion ?? getVersionCode();
  });

  // school type → campus (general onboarding)
  const [cards, setCards] = useState<CampusCard[]>([]);
  const [card, setCard] = useState<CampusCard | "">("");
  const [campusQuery, setCampusQuery] = useState("");
  const [campusPage, setCampusPage] = useState<{
    items: CampusCardItem[];
    page: number;
    total: number;
  }>({ items: [], page: 0, total: 0 });
  const [campusesLoading, setCampusesLoading] = useState(false);
  const [pickingId, setPickingId] = useState<string | null>(null);

  // programme
  const [programmeQuery, setProgrammeQuery] = useState("");
  const [programmes, setProgrammes] = useState<{
    fromCatalogue: boolean;
    items: OfferedProgramme[];
  } | null>(null);

  // NSMQ team picker + access code
  const [teamQuery, setTeamQuery] = useState("");
  const [teamCampuses, setTeamCampuses] = useState<PickerCampus[]>(
    devJumpStep === "nsmqCampus" || devJumpStep === "code"
      ? DEV_MOCK_CAMPUSES
      : [],
  );
  const [selectedTeam, setSelectedTeam] = useState<PickerCampus | null>(
    devJumpStep === "code" ? DEV_MOCK_CAMPUSES[0] : null,
  );
  const [assentText, setAssentText] = useState<string | null>(null);
  const [codeModalOpen, setCodeModalOpen] = useState(devJumpStep === "code");
  const [code, setCode] = useState("");
  const [codeState, setCodeState] = useState<"" | "good" | "bad">("");
  const [codeMessage, setCodeMessage] = useState("");
  const [codeTraceId, setCodeTraceId] = useState<string | undefined>();

  const [restored, setRestored] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(!!devJumpStep);

  useEffect(() => {
    if (devJumpStep) {
      const raf = requestAnimationFrame(() => setRestored(true));
      return () => cancelAnimationFrame(raf);
    }
    const raf = requestAnimationFrame(() => {
      try {
        const raw = localStorage.getItem(ONBOARD_STORAGE_KEY);
        if (raw) {
          const saved: SavedProgress = JSON.parse(raw);
          if (saved.step && AUTH_STEPS.includes(saved.step)) {
            setStep(saved.step);
          }
          if (saved.contactType) setContactType(saved.contactType);
          if (saved.selectedType) setSelectedType(saved.selectedType);
          if (saved.contactValue) setContactValue(saved.contactValue);
          if (saved.signinNickname) setSigninNickname(saved.signinNickname);
          if (saved.name) setName(saved.name);
          if (saved.nickname) setNickname(saved.nickname);
          if (saved.gender) setGender(saved.gender);
          if (saved.dobDay) setDobDay(saved.dobDay);
          if (saved.dobMonth) setDobMonth(saved.dobMonth);
          if (saved.dobYear) setDobYear(saved.dobYear);
        }
      } catch {
        // ignore corrupt/unavailable storage
      }
      setRestored(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [devJumpStep]);

  // the single place `me.next` turns into a screen (via the tested table in
  // src/lib/v2/next-route.ts) — after sign-in, verify, password reset and
  // every onboarding step
  const go = useCallback(
    (next: PatientNext, current: Enrollment | null = enrollment) => {
      const dest = nextDestination(next, current);
      setError(null);
      if (dest.page === "/home") {
        try {
          localStorage.removeItem(ONBOARD_STORAGE_KEY);
        } catch {
          // ignore unavailable storage
        }
        router.push("/home");
      } else {
        setStep(dest.step);
      }
    },
    [router, enrollment],
  );

  // after any sign-in: opened from an NSMQ link → enroll in that version
  // (identity knows nothing about versions), then route by `me.next`
  const afterSignIn = useCallback(
    async (me: Me) => {
      let enrolled: Enrollment | null = null;
      if (versionCode) {
        try {
          enrolled = await enroll(versionCode);
        } catch {
          // closed or unknown version - carry on with plain onboarding
          clearVersionCode();
        }
      }
      setEnrollment(enrolled);
      go(me.next, enrolled);
    },
    [versionCode, go],
  );

  // GET /auth/me is the session's source of truth: a signed-in student is
  // routed straight to their next step; otherwise the restored sign-in
  // screens stay as they were
  useEffect(() => {
    if (!restored || devJumpStep) return;
    let cancelled = false;
    (async () => {
      try {
        const me = await auth.getMe();
        if (cancelled) return;
        await afterSignIn(me);
      } catch {
        // not signed in - stay on the (restored) sign-in steps
      } finally {
        if (!cancelled) setSessionChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restored, devJumpStep, afterSignIn]);

  useEffect(() => {
    if (!restored) return; // don't overwrite saved progress with initial state
    try {
      const toSave: SavedProgress = {
        // only the sign-in steps are resumed from here; after sign-in the
        // server's `me.next` decides
        step: AUTH_STEPS.includes(step) ? step : undefined,
        contactType,
        selectedType,
        contactValue,
        signinNickname,
        name,
        nickname,
        gender,
        dobDay,
        dobMonth,
        dobYear,
      };
      localStorage.setItem(ONBOARD_STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // ignore unavailable storage (e.g. private browsing)
    }
  }, [
    restored,
    step,
    contactType,
    selectedType,
    contactValue,
    signinNickname,
    name,
    nickname,
    gender,
    dobDay,
    dobMonth,
    dobYear,
  ]);

  // one handler for every failed call: back to sign-in when the session is
  // gone, the countdown on RATE_LIMITED, otherwise show the problem
  function fail(e: unknown): ApiError {
    const err = asApiError(e);
    if (isSignedOut(err)) {
      setCodeModalOpen(false);
      setStep(contactValue ? "signin" : "choice");
    }
    rateLimit.trip(err);
    setError(err);
    return err;
  }

  // loads behind a screen only show what went wrong (setError is stable, so
  // these effects don't re-run on every render)
  const showLoadError = useCallback((e: unknown) => {
    setError(asApiError(e));
  }, []);

  // the profile drives the programme (campus id), grade (grades) and finish
  // (summary) steps
  useEffect(() => {
    if (
      devJumpStep ||
      profile ||
      (step !== "programme" && step !== "grade" && step !== "finish")
    ) {
      return;
    }
    let cancelled = false;
    patient
      .getProfile()
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((e) => {
        if (!cancelled) showLoadError(e);
      });
    return () => {
      cancelled = true;
    };
  }, [step, profile, devJumpStep, showLoadError]);

  // school type: two cards (HIGH_SCHOOL, COLLEGE). Nothing is saved here.
  useEffect(() => {
    if (step !== "schoolType" || cards.length) return;
    let cancelled = false;
    getCampusTypes()
      .then((types) => {
        if (cancelled) return;
        setCards([...new Set(types.map((t) => t.card))]);
      })
      .catch((e) => {
        if (cancelled) return;
        // still offer both cards if the list couldn't load
        setCards(["HIGH_SCHOOL", "COLLEGE"]);
        showLoadError(e);
      });
    return () => {
      cancelled = true;
    };
  }, [step, cards.length, showLoadError]);

  const loadCampuses = useCallback(
    async (page: number) => {
      if (!card) return;
      setCampusesLoading(true);
      try {
        const res = await searchCampuses({
          card,
          q: campusQuery.trim() || undefined,
          page,
          size: 20,
        });
        setCampusPage((prev) => ({
          items: page === 0 ? res.items : [...prev.items, ...res.items],
          page: res.page,
          total: res.total,
        }));
      } catch (e) {
        showLoadError(e);
      } finally {
        setCampusesLoading(false);
      }
    },
    [card, campusQuery, showLoadError],
  );

  // campus search: paged, alphabetical, 300 ms after typing stops
  useEffect(() => {
    if (step !== "campus") return;
    const t = setTimeout(() => loadCampuses(0), 300);
    return () => clearTimeout(t);
  }, [step, loadCampuses]);

  // programmes the campus offers (or the whole catalogue when it offers none)
  useEffect(() => {
    if (step !== "programme" || !profile?.campus) return;
    const campusId = profile.campus.id;
    let cancelled = false;
    const t = setTimeout(() => {
      getProgrammes(campusId, programmeQuery.trim() || undefined)
        .then((res) => {
          if (!cancelled) setProgrammes(res);
        })
        .catch((e) => {
          if (!cancelled) showLoadError(e);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [step, profile, programmeQuery, showLoadError]);

  // NSMQ team picker: the schools taking part in this version
  useEffect(() => {
    if (step !== "nsmqCampus" || !versionCode || devJumpStep) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setCampusesLoading(true);
      getVersionCampuses(versionCode, teamQuery.trim() || undefined)
        .then((res) => {
          if (!cancelled) setTeamCampuses(res);
        })
        .catch((e) => {
          if (!cancelled) showLoadError(e);
        })
        .finally(() => {
          if (!cancelled) setCampusesLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [step, versionCode, teamQuery, devJumpStep, showLoadError]);

  // the assent the join accepts - shown in the code modal, since the
  // student must have read it
  useEffect(() => {
    if (step !== "nsmqCampus" || !versionCode || assentText !== null) return;
    let cancelled = false;
    getVersion(versionCode)
      .then((v) => {
        if (!cancelled) setAssentText(v.assentText ?? "");
      })
      .catch(() => {
        // non-fatal: a join without it answers ASSENT_REQUIRED
      });
    return () => {
      cancelled = true;
    };
  }, [step, versionCode, assentText]);

  function pickContactMethod(type: ContactType) {
    setContactType(type);
    setContactValue("");
    setError(null);
    setStep(type === "PHONE" ? "phone" : "email");
  }

  async function submitContact() {
    if (!contactValue.trim()) return;
    // phones are accepted as typed; the +233 prefix is shown beside the box
    const value =
      contactType === "PHONE"
        ? `+233${contactValue.replace(/\D/g, "").replace(/^0+/, "")}`
        : contactValue.trim();
    setLoading(true);
    setError(null);
    try {
      const res = await auth.lookup(value);
      setContactValue(value);
      if (res.exists) {
        setSigninNickname(res.nickname ?? "there");
        setStep("signin");
      } else {
        setStep("signup");
      }
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
  }

  function resetOtp() {
    setOtp("");
    document.getElementById(OTP_INPUT_ID)?.focus();
  }

  async function submitSignup() {
    if (
      !name.trim() ||
      !nickname.trim() ||
      !gender ||
      !dobDay ||
      !dobMonth ||
      !dobYear
    ) {
      setError(localError("Please fill in every field."));
      return;
    }
    if (!passwordOk(password)) {
      setError(localError(PASSWORD_MESSAGE));
      return;
    }
    if (nicknameTaken) return;
    const monthIndex = MONTHS.indexOf(dobMonth) + 1;
    const dateOfBirth = `${dobYear}-${String(monthIndex).padStart(2, "0")}-${dobDay.padStart(2, "0")}`;

    setLoading(true);
    setError(null);
    try {
      // no referral here: the backend has no field for it (the handle from
      // `?ref=` is still captured client-side, see src/lib/referral.ts)
      await auth.signUp({
        contact: contactValue,
        password,
        fullName: name.trim(),
        nickname: nickname.trim(),
        gender,
        dateOfBirth,
      });
      setOtp("");
      resend.restart(RESEND_SECONDS);
      setStep("verify");
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
  }

  // one resend for both code screens - the purpose matches the screen's
  // verify call
  async function resendCode(purpose: CodePurpose) {
    if (resend.isRunning && resend.secondsLeft > 0) return;
    setLoading(true);
    setError(null);
    try {
      await auth.resendCode(contactValue, purpose);
      resend.restart(RESEND_SECONDS);
      showToast(SENT_COPY);
    } catch (e) {
      const err = fail(e);
      if (err.code === "RATE_LIMITED") {
        resend.restart(Math.max(1, err.retryAfter ?? RESEND_SECONDS));
      }
    } finally {
      setLoading(false);
    }
  }

  async function completeVerify(fullCode: string, purpose: CodePurpose) {
    setLoading(true);
    setError(null);
    try {
      const res = await auth.verify(contactValue, purpose, fullCode);
      if (purpose === "RECOVERY") {
        if (!res.grant) throw localError("That code didn't work");
        setGrant(res.grant);
        setStep("resetPassword");
      } else if (res.me) {
        setPassword("");
        await afterSignIn(res.me);
      }
    } catch (e) {
      const err = fail(e);
      // a dead code: let them ask for a new one right away
      if (err.code === "CODE_EXPIRED" || err.code === "CODE_LOCKED") {
        resend.restart(0);
      }
      resetOtp();
    } finally {
      setLoading(false);
    }
  }

  // recovery: "Forgot your password?" on the sign-in step. Always 202, so the
  // copy never claims the account exists.
  async function submitForgotPassword() {
    setLoading(true);
    setError(null);
    try {
      await auth.startRecovery(contactValue);
      setOtp("");
      resend.restart(RESEND_SECONDS);
      setStep("forgotVerify");
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
  }

  async function submitResetPassword() {
    if (!passwordOk(newPassword)) {
      setError(localError(PASSWORD_MESSAGE));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError(localError("Passwords don't match."));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // signs in, and ends every other session
      const me = await auth.setPassword(grant, newPassword);
      setNewPassword("");
      setConfirmNewPassword("");
      setGrant("");
      await afterSignIn(me);
    } catch (e) {
      const err = fail(e);
      if (err.code === "GRANT_EXPIRED") {
        // the grant lasts 10 minutes and works once - start recovery again
        setGrant("");
        setStep("signin");
      }
    } finally {
      setLoading(false);
    }
  }

  // OtpInput only accepts digits, moves focus itself and calls this once
  // every box is filled
  function handleOtpComplete(fullCode: string) {
    completeVerify(fullCode, step === "forgotVerify" ? "RECOVERY" : "SIGN_UP");
  }

  async function submitSignin() {
    if (!signinPassword) return;
    setLoading(true);
    setError(null);
    try {
      const me = await auth.signIn(contactValue, signinPassword);
      setSigninPassword("");
      await afterSignIn(me);
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
  }

  // ---- onboarding steps: each saves on pick and answers the new `next` ----

  async function savePhoto(skip: boolean) {
    // dev-jump previews this screen with no real session
    if (devJumpStep) {
      setStep("schoolType");
      return;
    }
    if (!skip && !photo) return;
    setLoading(true);
    setError(null);
    try {
      const home =
        skip || !photo
          ? await patient.skipPhoto()
          : await patient.uploadPhoto(photo.blob);
      setProfile(home);
      go(home.next);
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
  }

  async function pickCampus(item: CampusCardItem) {
    setPickingId(item.id);
    setError(null);
    try {
      const home = await patient.setCampus(item.id);
      setProfile(home);
      setProgrammes(null);
      go(home.next);
    } catch (e) {
      fail(e);
    } finally {
      setPickingId(null);
    }
  }

  async function pickProgramme(item: OfferedProgramme) {
    setPickingId(item.programmeId);
    setError(null);
    try {
      const home = await patient.setProgramme(item.programmeId);
      setProfile(home);
      go(home.next);
    } catch (e) {
      fail(e);
    } finally {
      setPickingId(null);
    }
  }

  async function pickGrade(grade: Grade) {
    setPickingId(grade);
    setError(null);
    try {
      const home = await patient.setGrade(grade);
      setProfile(home);
      go(home.next);
    } catch (e) {
      fail(e);
    } finally {
      setPickingId(null);
    }
  }

  async function finish() {
    setLoading(true);
    setError(null);
    try {
      const home = await patient.finishOnboarding();
      go(home.next);
    } catch (e) {
      const err = fail(e);
      // names the missing step - send them there
      const missing = err.fieldError("next") as PatientNext | undefined;
      if (err.code === "ONBOARDING_INCOMPLETE" && missing) go(missing);
    } finally {
      setLoading(false);
    }
  }

  // ---- NSMQ: pick the team's school, then the access code ----

  async function pickTeam(item: PickerCampus) {
    setPickingId(item.id);
    // dev-jump previews this screen with no real session
    if (devJumpStep || !versionCode) {
      setSelectedTeam(item);
      setCodeModalOpen(true);
      setPickingId(null);
      return;
    }
    setError(null);
    try {
      await selectCampus(versionCode, item.id);
      setSelectedTeam(item);
      setCode("");
      setCodeState("");
      setCodeMessage("");
      setCodeModalOpen(true);
    } catch (e) {
      fail(e);
    } finally {
      setPickingId(null);
    }
  }

  function joined(message: string) {
    setCodeState("good");
    setCodeMessage(message);
    setTimeout(async () => {
      setCodeModalOpen(false);
      if (devJumpStep) return;
      try {
        // joining onboards the student - route by the fresh `next`
        setEnrollment(null);
        clearVersionCode();
        go((await auth.getMe()).next, null);
      } catch {
        router.push("/home");
      }
    }, 1100);
  }

  async function completeCode(fullCode: string) {
    if (!selectedTeam) return;
    if (devJumpStep || !versionCode) {
      joined("Great, you're in! (dev preview)");
      return;
    }
    setCodeTraceId(undefined);
    try {
      await join(versionCode, {
        campusId: selectedTeam.id,
        code: fullCode,
        assent: true,
      });
      joined("Great, you're in!");
    } catch (e) {
      const err = asApiError(e);
      if (err.code === "ALREADY_ON_TEAM") {
        // a retried join that already landed counts as success
        joined("You're already on this team!");
        return;
      }
      if (isSignedOut(err)) {
        fail(err);
        return;
      }
      rateLimit.trip(err);
      setCodeState("bad");
      setCodeMessage(err.message);
      if (isUnexpected(err)) setCodeTraceId(err.traceId);
    }
  }

  // OtpInput (allowLetters) keeps only letters/digits, uppercases them and
  // strips separators from a pasted code, then calls completeCode once
  // every box is filled; any edit clears the previous good/bad verdict
  function handleCodeChange(value: string) {
    setCode(value);
    setCodeState("");
    setCodeMessage("");
    setCodeTraceId(undefined);
  }

  function goBack() {
    setError(null);
    switch (step) {
      case "phone":
      case "email":
        setStep("choice");
        return;
      case "signup":
      case "signin":
        setStep(contactType === "PHONE" ? "phone" : "email");
        return;
      case "verify":
        // a sign-up code is spent once verified - back means re-entering
        // the form (signing up again replaces the unfinished account)
        setStep("signup");
        return;
      case "forgotVerify":
      case "resetPassword":
        // a verified recovery code is one-time too - back to sign-in
        setStep("signin");
        return;
      case "schoolType":
      case "nsmqCampus":
        // back from School Type goes to the photo step
        setStep("photo");
        return;
      case "campus":
        setStep("schoolType");
        return;
      case "programme":
        setStep("schoolType");
        return;
      case "grade":
        setStep("programme");
        return;
      case "finish":
        setStep("grade");
        return;
      default:
        return;
    }
  }

  const resendLabel =
    resend.isRunning && resend.secondsLeft > 0
      ? `Resend code in ${formatCountdown(resend.secondsLeft)}`
      : "Send a new code";

  const nextConfig = (() => {
    const pct = (s: Step) => `Next (${PROGRESS[s]}%)`;
    switch (step) {
      case "choice":
        return {
          show: true,
          enabled: !!selectedType,
          label: pct("choice"),
          onClick: () => selectedType && pickContactMethod(selectedType),
        };
      case "phone":
      case "email":
        return {
          show: true,
          enabled:
            !loading && !rateLimit.limited && contactValue.trim().length > 0,
          label: rateLimit.label ?? (loading ? "Checking…" : pct(step)),
          onClick: submitContact,
        };
      case "signup":
        return {
          show: true,
          enabled: !loading && !rateLimit.limited && !nicknameTaken,
          label: rateLimit.label ?? (loading ? "Creating…" : pct("signup")),
          onClick: submitSignup,
        };
      case "signin":
        // signing in isn't a step in the linear onboarding sequence - it's a
        // gate a returning user passes through, so it gets no percentage
        return {
          show: true,
          enabled: !loading && !rateLimit.limited && signinPassword.length > 0,
          label: rateLimit.label ?? (loading ? "Signing in…" : "Sign In"),
          onClick: submitSignin,
        };
      case "resetPassword":
        return {
          show: true,
          enabled:
            !loading && newPassword.length > 0 && confirmNewPassword.length > 0,
          label: loading ? "Saving…" : "Save password",
          onClick: submitResetPassword,
        };
      case "photo":
        return {
          show: true,
          enabled: !loading && !rateLimit.limited && !!photo,
          label: rateLimit.label ?? (loading ? "One sec…" : pct("photo")),
          onClick: () => savePhoto(false),
        };
      case "schoolType":
        return {
          show: true,
          enabled: !!card,
          label: pct("schoolType"),
          onClick: () => {
            setCampusQuery("");
            setCampusPage({ items: [], page: 0, total: 0 });
            setStep("campus");
          },
        };
      case "finish":
        return {
          show: true,
          enabled: !loading,
          label: loading ? "Finishing…" : "Finish (100%)",
          onClick: finish,
        };
      default:
        return { show: false, enabled: false, label: "", onClick: () => {} };
    }
  })();

  const warmBg =
    "radial-gradient(118% 86% at 50% 16%, #733730 0%, #572621 42%, #3b1a17 74%, #2b1210 100%)";

  if (!sessionChecked) {
    return (
      <div className="text-txt flex h-screen">
        <PhotoTestimonialPanel className="h-full w-[40%]" />
        <div
          className="flex flex-1 items-center justify-center"
          style={{ background: warmBg }}
        >
          <Spinner className="text-gold size-8" />
        </div>
      </div>
    );
  }

  const wide = step === "campus" || step === "nsmqCampus";

  return (
    <div className="text-txt flex h-screen">
      <PhotoTestimonialPanel className="h-full w-[40%]" />

      <div
        className={`relative flex flex-1 flex-col overflow-y-auto px-8 sm:px-16 ${
          step === "photo" ? "py-4" : "py-10"
        }`}
        style={{ background: warmBg }}
      >
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Logo variant="light" className="h-6 w-auto sm:h-6" />
          <div className="land-pill whitespace-nowrap">
            Locking in for&nbsp;<b>NSMQ 2026</b>
          </div>
        </div>

        <div
          className={`mx-auto flex w-full flex-1 flex-col justify-center ${
            wide ? "max-w-none" : "max-w-md"
          } ${step === "photo" ? "py-4" : "py-10"}`}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              {step === "choice" && (
                <div className="text-center">
                  <h1 className="text-3xl font-extrabold tracking-tight">
                    Phone or Email?
                  </h1>
                  <p className="mt-2 text-white/60">
                    We&apos;ll use this to get you started.
                  </p>
                  <RadioGroup
                    variant="card"
                    aria-label="Phone or email"
                    options={CONTACT_OPTIONS}
                    value={selectedType ?? ""}
                    onValueChange={(v) => setSelectedType(v as ContactType)}
                    className={pickCardGroupClass}
                  />
                </div>
              )}

              {(step === "phone" || step === "email") && (
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight">
                    {step === "phone"
                      ? "Drop Your Phone Number"
                      : "Drop Your Email"}
                  </h1>
                  <p className="text-muted mt-2">
                    We&apos;ll see if you&apos;re already locked in or just
                    getting started.
                  </p>
                  <form
                    className="mt-6 flex flex-col gap-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitContact();
                    }}
                  >
                    {step === "phone" ? (
                      <div className="flex gap-3">
                        <Field label="Ghana" className="w-auto shrink-0">
                          <div className="relative">
                            <GhanaFlag className="pointer-events-none absolute top-1/2 left-3.5 h-3.5 w-auto -translate-y-1/2 rounded-[2px]" />
                            <Input
                              readOnly
                              tabIndex={-1}
                              value="+233"
                              className={`${inputClass} w-28 pl-11`}
                            />
                          </div>
                        </Field>
                        <div className="flex-1">
                          <Field
                            label="Phone number"
                            error={error?.fieldError("contact")}
                          >
                            <Input
                              className={inputClass}
                              type="tel"
                              inputMode="numeric"
                              autoComplete="tel-national"
                              name="phone"
                              maxLength={10}
                              placeholder="24 123 4567"
                              value={contactValue}
                              onChange={(e) =>
                                setContactValue(
                                  e.target.value.replace(/\D/g, ""),
                                )
                              }
                            />
                          </Field>
                        </div>
                      </div>
                    ) : (
                      <Field label="Email" error={error?.fieldError("contact")}>
                        <Input
                          className={inputClass}
                          type="email"
                          autoComplete="email"
                          name="email"
                          placeholder="you@example.com"
                          value={contactValue}
                          onChange={(e) => setContactValue(e.target.value)}
                        />
                      </Field>
                    )}
                    <ApiErrorText error={formLevelError(error, ["contact"])} />
                  </form>
                </div>
              )}

              {step === "signup" && (
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight">
                    Create your LOCK IN
                  </h1>
                  <p className="text-muted mt-2">
                    You&apos;re using{" "}
                    <strong className="text-txt">{contactValue}</strong> for
                    this account.
                  </p>
                  <form
                    className="mt-6 flex flex-col gap-5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitSignup();
                    }}
                  >
                    <Field
                      label="Your name"
                      error={error?.fieldError("fullName")}
                    >
                      <Input
                        className={inputClass}
                        placeholder="What's your name?"
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(smartName(e.target.value))}
                      />
                    </Field>
                    <Field
                      label="Nickname"
                      error={nicknameTaken ?? error?.fieldError("nickname")}
                    >
                      <Input
                        className={inputClass}
                        placeholder="What should we call you?"
                        value={nickname}
                        onChange={(e) =>
                          setNickname(sanitizeNickname(e.target.value))
                        }
                      />
                    </Field>
                    <Field label="Gender" error={error?.fieldError("gender")}>
                      <ToggleGroup
                        type="single"
                        fullWidth
                        aria-label="Gender"
                        options={GENDER_OPTIONS}
                        value={gender}
                        // a single toggle group lets you click the active
                        // option off again - keep the old "always one
                        // picked once chosen" behaviour
                        onValueChange={(v) => {
                          if (v) setGender(v as Gender);
                        }}
                        className="border-line border bg-white/5"
                      />
                    </Field>
                    <Field
                      label="Date of birth"
                      error={error?.fieldError("dateOfBirth")}
                    >
                      <div className="flex gap-2">
                        <Select
                          className={`${inputClass} min-w-0 flex-[2]`}
                          aria-label="Day"
                          placeholder="Day"
                          value={dobDay}
                          onValueChange={setDobDay}
                          options={DAY_OPTIONS}
                        />
                        <Select
                          className={`${inputClass} min-w-0 flex-[5]`}
                          aria-label="Month"
                          placeholder="Month"
                          value={dobMonth}
                          onValueChange={setDobMonth}
                          options={MONTH_OPTIONS}
                        />
                        <Select
                          className={`${inputClass} min-w-0 flex-[3]`}
                          aria-label="Year"
                          placeholder="Year"
                          value={dobYear}
                          onValueChange={setDobYear}
                          options={YEAR_OPTIONS}
                        />
                      </div>
                    </Field>
                    <Field
                      label="Password"
                      error={error?.fieldError("password")}
                    >
                      <PasswordInput
                        className={inputClass}
                        autoComplete="new-password"
                        placeholder="Create a password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        showStrength
                        rules={PASSWORD_RULES}
                      />
                    </Field>
                    <ApiErrorText
                      error={formLevelError(error, SIGNUP_FIELDS)}
                    />
                  </form>
                </div>
              )}

              {(step === "verify" || step === "forgotVerify") && (
                <div className="text-center">
                  <h1 className="text-3xl font-extrabold tracking-tight">
                    {step === "verify"
                      ? "Enter Verification Code"
                      : "Enter account recovery code"}
                  </h1>
                  <p className="text-muted mt-2">
                    {step === "verify"
                      ? "A 6-digit verification code was just sent to"
                      : SENT_COPY}
                    <br />
                    <strong className="text-txt">{contactValue}</strong>
                  </p>
                  {/* autoFocus: land on the first box the moment this step
                      is reached — the whole point of a 6-digit code is
                      typing it immediately, no click required */}
                  <OtpInput
                    id={OTP_INPUT_ID}
                    length={OTP_LENGTH}
                    autoFocus
                    disabled={loading}
                    aria-label={
                      step === "verify" ? "Verification code" : "Recovery code"
                    }
                    value={otp}
                    onChange={setOtp}
                    onComplete={handleOtpComplete}
                    className={otpClass}
                  />
                  <ApiErrorText
                    error={formLevelError(error, ["code"])}
                    className="mt-4"
                  />
                  {error?.fieldError("code") && (
                    <p className="text-no mt-4 text-sm">
                      {error.fieldError("code")}
                    </p>
                  )}
                  <Button
                    variant="link"
                    onClick={() =>
                      resendCode(step === "verify" ? "SIGN_UP" : "RECOVERY")
                    }
                    disabled={
                      (resend.isRunning && resend.secondsLeft > 0) || loading
                    }
                    className={resendClass}
                  >
                    {resendLabel}
                  </Button>
                </div>
              )}

              {step === "signin" && (
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight">
                    Hello, {signinNickname || nickname || "there"}
                  </h1>
                  <p className="text-muted mt-2">
                    You&apos;re signing in with{" "}
                    <strong className="text-txt">{contactValue}</strong>
                  </p>
                  <form
                    className="mt-6 flex flex-col gap-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitSignin();
                    }}
                  >
                    <Field
                      label="Password"
                      error={error?.fieldError("password")}
                    >
                      <Input
                        className={inputClass}
                        type="password"
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        value={signinPassword}
                        onChange={(e) => setSigninPassword(e.target.value)}
                      />
                    </Field>
                    <div className="-mt-2 flex justify-end">
                      <Button
                        variant="link"
                        onClick={submitForgotPassword}
                        disabled={loading || rateLimit.limited}
                        className="text-muted hover:text-txt h-auto px-0 text-xs font-semibold hover:no-underline disabled:opacity-60"
                      >
                        Forgot your password?
                      </Button>
                    </div>
                    <ApiErrorText error={formLevelError(error, ["password"])} />
                  </form>
                </div>
              )}

              {step === "resetPassword" && (
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight">
                    Create New Password
                  </h1>
                  <p className="text-muted mt-2">
                    Set new password for your account{" "}
                    <strong className="text-txt">{contactValue}</strong>
                  </p>
                  <form
                    className="mt-6 flex flex-col gap-5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitResetPassword();
                    }}
                  >
                    <Field
                      label="New password"
                      error={error?.fieldError("password")}
                    >
                      <PasswordInput
                        className={inputClass}
                        autoComplete="new-password"
                        placeholder="Create a new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        showStrength
                        rules={PASSWORD_RULES}
                      />
                    </Field>
                    <Field label="Confirm password">
                      <PasswordInput
                        className={inputClass}
                        autoComplete="new-password"
                        placeholder="Re-enter your new password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                      />
                    </Field>
                    <ApiErrorText error={formLevelError(error, ["password"])} />
                  </form>
                </div>
              )}

              {step === "photo" && (
                <div className="flex flex-col items-center text-center">
                  <h1
                    className="font-extrabold tracking-tight"
                    style={{ fontSize: "clamp(1.5rem, 4vw, 2.25rem)" }}
                  >
                    Add A Photo
                  </h1>
                  <p
                    className="text-muted mt-1"
                    style={{ fontSize: "clamp(0.9rem, 1.5vw, 1.05rem)" }}
                  >
                    A quick photo so we know it&apos;s you,{" "}
                    <strong className="text-txt">
                      {profile?.nickname || nickname || "there"}
                    </strong>
                    .
                  </p>

                  {/* pick → crop (round) → preview; uploaded on Next. The
                      cropped image is what's sent, 5 MB at most. */}
                  <PhotoUpload
                    className="mt-6"
                    shape="round"
                    aspect={1}
                    maxSizeMB={5}
                    accept="image/jpeg,image/png,image/webp"
                    label="Upload a photo"
                    value={photo?.previewUrl ?? null}
                    disabled={loading}
                    loading={loading}
                    onChange={(next) => {
                      setError(null);
                      setPhoto((prev) => {
                        if (prev) URL.revokeObjectURL(prev.previewUrl);
                        return next;
                      });
                    }}
                    onRemove={() => {
                      setPhoto((prev) => {
                        if (prev) URL.revokeObjectURL(prev.previewUrl);
                        return null;
                      });
                    }}
                  />

                  <ApiErrorText error={error} className="mt-4 min-h-[18px]" />

                  <Button
                    variant="link"
                    onClick={() => savePhoto(true)}
                    disabled={loading}
                    className="text-muted hover:text-txt mt-2 h-auto px-0 text-sm font-semibold disabled:opacity-60"
                  >
                    Skip for now
                  </Button>
                </div>
              )}

              {step === "schoolType" && (
                <div className="text-center">
                  <h1 className="text-3xl font-extrabold tracking-tight">
                    Where do you study?
                  </h1>
                  <p className="mt-2 text-white/60">
                    Pick your kind of school.
                  </p>
                  {cards.length === 0 ? (
                    <Spinner className="text-gold mx-auto mt-8 size-8" />
                  ) : (
                    <RadioGroup
                      variant="card"
                      aria-label="School type"
                      options={cards.map((c) => ({
                        value: c,
                        label: (
                          <span className="py-4 font-bold">
                            {CARD_LABEL[c]}
                          </span>
                        ),
                      }))}
                      value={card}
                      onValueChange={(v) => setCard(v as CampusCard)}
                      className={pickCardGroupClass}
                    />
                  )}
                  <ApiErrorText error={error} className="mt-4" />
                </div>
              )}

              {step === "campus" && (
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight">
                    Which school do you go to?
                  </h1>
                  <Input
                    size="sm"
                    className={`${inputClass} mt-4`}
                    aria-label="Search your school"
                    placeholder="Search your school"
                    value={campusQuery}
                    onChange={(e) => setCampusQuery(e.target.value)}
                  />
                  <div className="mt-4">
                    {!campusesLoading && campusPage.items.length === 0 && (
                      <p className="text-muted py-6 text-center">
                        No schools found.
                      </p>
                    )}
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      {campusPage.items.map((c) => (
                        <ImageCard
                          key={c.id}
                          asChild
                          image={c.logo?.url}
                          title={c.fullName}
                          subtitle={c.nicknames[0] ?? c.motto ?? undefined}
                          badge={
                            c.lockedIn > 0
                              ? `${c.lockedIn} locked in`
                              : undefined
                          }
                          className="border-gold border-[1.65px] text-white"
                        >
                          <button
                            type="button"
                            onClick={() => pickCampus(c)}
                            disabled={!!pickingId}
                          >
                            {pickingId === c.id && (
                              <div className="absolute inset-0 z-[7] flex items-center justify-center bg-black/50">
                                <Spinner className="text-gold size-8" />
                              </div>
                            )}
                          </button>
                        </ImageCard>
                      ))}
                    </div>
                    {campusesLoading && (
                      <p className="text-muted py-6 text-center">Searching…</p>
                    )}
                    {!campusesLoading &&
                      campusPage.items.length < campusPage.total && (
                        <div className="mt-6 flex justify-center">
                          <Button
                            variant="outline"
                            className={backClass}
                            onClick={() => loadCampuses(campusPage.page + 1)}
                          >
                            Show more schools
                          </Button>
                        </div>
                      )}
                  </div>
                  <ApiErrorText error={error} className="mt-4" />
                </div>
              )}

              {step === "programme" && (
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight">
                    What do you study?
                  </h1>
                  {programmes?.fromCatalogue && (
                    <p className="text-muted mt-2">
                      Your school hasn&apos;t listed its programmes yet, so
                      here&apos;s every programme we know.
                    </p>
                  )}
                  <Input
                    size="sm"
                    className={`${inputClass} mt-4`}
                    aria-label="Search programmes"
                    placeholder="Search programmes"
                    value={programmeQuery}
                    onChange={(e) => setProgrammeQuery(e.target.value)}
                  />
                  <div className="mt-4 flex flex-col gap-2">
                    {!programmes && (
                      <Spinner className="text-gold mx-auto size-8" />
                    )}
                    {programmes?.items.length === 0 && (
                      <p className="text-muted py-6 text-center">
                        No programmes found.
                      </p>
                    )}
                    {programmes?.items.map((p) => (
                      <button
                        key={p.programmeId}
                        type="button"
                        className={pickCardClass}
                        disabled={!!pickingId}
                        onClick={() => pickProgramme(p)}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="font-bold">{p.fullName}</span>
                          {pickingId === p.programmeId && (
                            <Spinner className="text-gold size-5" />
                          )}
                        </span>
                        {p.nicknames.length > 0 && (
                          <span className="text-muted text-xs">
                            {p.nicknames.join(" · ")}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <ApiErrorText error={error} className="mt-4" />
                </div>
              )}

              {step === "grade" && (
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight">
                    Which year are you in?
                  </h1>
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    {!profile && (
                      <Spinner className="text-gold col-span-2 mx-auto size-8" />
                    )}
                    {profile?.grades.map((g) => (
                      <button
                        key={g}
                        type="button"
                        className={cn(
                          pickCardClass,
                          "text-center font-bold",
                          profile.grade === g && "border-gold",
                        )}
                        disabled={!!pickingId}
                        onClick={() => pickGrade(g)}
                      >
                        {pickingId === g ? (
                          <Spinner className="text-gold mx-auto size-5" />
                        ) : (
                          gradeLabel(g)
                        )}
                      </button>
                    ))}
                  </div>
                  <ApiErrorText error={error} className="mt-4" />
                </div>
              )}

              {step === "finish" && (
                <div className="text-center">
                  <h1 className="text-3xl font-extrabold tracking-tight">
                    You&apos;re all set
                  </h1>
                  {profile && (
                    <div className="mt-4 flex flex-col gap-1">
                      <p className="font-bold">{profile.campus?.fullName}</p>
                      {profile.programme && (
                        <p className="text-muted">
                          {profile.programme.fullName}
                        </p>
                      )}
                      {(profile.classOf || profile.gradeLabel) && (
                        <p className="text-muted text-sm">
                          {[profile.classOf, profile.gradeLabel]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                  )}
                  <ApiErrorText error={error} className="mt-4" />
                </div>
              )}

              {step === "nsmqCampus" && (
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight">
                    Which school are you competing for?
                  </h1>
                  <p className="text-muted mt-2">
                    Search for your school&apos;s NSMQ team.
                  </p>
                  <Input
                    size="sm"
                    className={`${inputClass} mt-4`}
                    aria-label="Search your school"
                    placeholder="Search your school"
                    value={teamQuery}
                    onChange={(e) => setTeamQuery(e.target.value)}
                  />
                  <div className="mt-4">
                    {campusesLoading && (
                      <p className="text-muted py-6 text-center">Searching…</p>
                    )}
                    {!campusesLoading && teamCampuses.length === 0 && (
                      <p className="text-muted py-6 text-center">
                        No schools found.
                      </p>
                    )}
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      {teamCampuses.map((c) => (
                        <ImageCard
                          key={c.id}
                          asChild
                          title={c.fullName}
                          subtitle={c.type}
                          className="border-gold border-[1.65px] text-white"
                        >
                          <button
                            type="button"
                            onClick={() => pickTeam(c)}
                            disabled={!!pickingId}
                          >
                            {pickingId === c.id && (
                              <div className="absolute inset-0 z-[7] flex items-center justify-center bg-black/50">
                                <Spinner className="text-gold size-8" />
                              </div>
                            )}
                          </button>
                        </ImageCard>
                      ))}
                    </div>
                  </div>
                  <ApiErrorText error={error} className="mt-4" />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
          <p className="text-xs text-white/50">
            Designed with clinical experts and NSMQ alumni, just for you.
          </p>
          <div className="flex items-center gap-3">
            {step === "choice" ? (
              <Button asChild variant="outline" className={backClass}>
                <Link href="/">Back</Link>
              </Button>
            ) : (
              <Button variant="outline" onClick={goBack} className={backClass}>
                Back
              </Button>
            )}
            {nextConfig.show && (
              <Button
                disabled={!nextConfig.enabled}
                onClick={nextConfig.onClick}
                className="hover:bg-gold-light font-semibold disabled:bg-white/10 disabled:text-white/40 disabled:opacity-100"
              >
                {nextConfig.label}
              </Button>
            )}
          </div>
        </div>
      </div>

      <CodeGateModal
        open={codeModalOpen}
        campusName={selectedTeam?.fullName}
        length={ACCESS_CODE_LENGTH}
        code={code}
        codeState={rateLimit.limited ? "bad" : codeState}
        codeMessage={rateLimit.label ?? codeMessage}
        assentText={assentText}
        disabled={rateLimit.limited}
        traceId={codeTraceId}
        onCodeChange={handleCodeChange}
        onComplete={(fullCode) => completeCode(fullCode)}
        // there's no "unselect" in v2 - picking another school re-PUTs it
        onClose={() => setCodeModalOpen(false)}
      />
    </div>
  );
}
