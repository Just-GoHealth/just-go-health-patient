"use client";

import Image from "next/image";
import Link from "next/link";
import "./onboard.css";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { CodeGateModal } from "@/components/onboard/code-gate-modal";
import { CustomSelect } from "@/components/onboard/custom-select";
import { PhotoTestimonialPanel } from "@/components/onboard/photo-testimonial-panel";
import {
  ApiError,
  JOIN_ERROR_COPY,
  type CampusPickerItem,
  type ContactType,
  activateEnrollment,
  checkContact,
  deleteVersionCampus,
  forgotPassword,
  getLockinVersion,
  getVersionCampuses,
  getVersionMembership,
  joinVersionTeam,
  selectVersionCampus,
  sendOtp,
  setPassword as setPasswordApi,
  signin,
  signup,
  skipProfilePhoto,
  uploadProfilePhoto,
  verifyOtp,
} from "@/lib/api";

const VERSION_CODE = "nsmq2026";

type Step =
  | "choice"
  | "phone"
  | "email"
  | "signup"
  | "verify"
  | "photo"
  | "signin"
  | "forgotVerify"
  | "resetPassword"
  | "campus"
  | "code"
  | "done";

// dev-only shortcut so later steps (photo, campus, code) can be reviewed
// without a real OTP — never active in a production build. Steps that call
// real backend endpoints on submit still do (and will fail without a real
// session); this only gets you to the screen to look at it.
const DEV_JUMP_ENABLED = process.env.NODE_ENV !== "production";
const DEV_JUMP_STEPS: Step[] = ["photo", "campus", "code"];

const DEV_MOCK_CAMPUSES: CampusPickerItem[] = [
  {
    campusId: -1,
    fullName: "Presbyterian Boys Senior High School",
    nickname: "Presec Legon",
    teamId: -1,
    memberCount: 87,
    whenLabel: "Tomorrow · 9am",
    state: "tomorrow",
  },
  {
    campusId: -2,
    fullName: "Mfantsipim School",
    nickname: "Mfantsipim",
    teamId: -2,
    memberCount: 64,
    whenLabel: "Today · 3pm",
    state: "today",
  },
  {
    campusId: -3,
    fullName: "Wesley Girls High School",
    nickname: "Wesley Girls",
    teamId: -3,
    memberCount: 52,
    whenLabel: "August 19 · Out",
    state: "out",
  },
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
// full names crowd the narrow Day/Month/Year row on mobile - shown there
// instead of MONTHS, same underlying value either way
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

// title-cases as you type ("john kwame" -> "John Kwame") and strips anything
// that isn't a letter, space, apostrophe or hyphen - a real name, not a handle
function smartName(raw: string): string {
  let v = raw.replace(/[^a-zA-ZÀ-ɏ' -]/g, "");
  v = v.replace(/\s{2,}/g, " ").replace(/^\s+/, "");
  v = v.replace(
    /(^\s*[a-zA-ZÀ-ɏ])|(\s+[a-zA-ZÀ-ɏ])/g,
    (m) => m.toUpperCase(),
  );
  return v;
}

// nicknames are letters, numbers, and underscores only - no spaces or
// punctuation, so they're safe to use as a handle-like display name
function sanitizeNickname(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_]/g, "");
}

// no real crest/banner from the backend for this campus - a plain warm
// gradient in the app's own palette, not a fabricated crest
const CAMPUS_FALLBACK_BG =
  "radial-gradient(120% 160% at 50% 0%, #43302a 0%, #2b1f1c 55%, #1a1412 100%)";

// colors ported 1:1 from the legacy prototype's .sc-when / .st-today /
// .st-tomorrow / .st-out rules - "today" reads warm/urgent, "out" reads
// muted/closed, per the same three states the real API sends
function campusPillStyle(state: string | undefined): CSSProperties {
  if (state === "today") {
    return {
      background: "linear-gradient(135deg,#fff2cf,#ffd98a 46%,#e0a63c)",
      color: "#3a2703",
      borderColor: "rgba(255,255,255,.5)",
    };
  }
  if (state === "out") {
    return {
      background:
        "radial-gradient(120% 160% at 50% 0%,#733730 0%,#572621 48%,#3b1a17 100%)",
      color: "#f0d7b4",
      borderColor: "rgba(232,212,173,.38)",
    };
  }
  // tomorrow / future share the mock's default gold treatment
  return {
    background: "linear-gradient(135deg,#f6e7c4,#e8d4ad 48%,#b8935a)",
    color: "#2a2007",
    borderColor: "rgba(255,255,255,.5)",
  };
}

function campusDotStyle(state: string | undefined): CSSProperties {
  if (state === "today") {
    return {
      background: "#d8341f",
      boxShadow: "0 0 9px rgba(216,52,31,.85)",
      animation: "campus-live 1.15s ease-in-out infinite",
    };
  }
  if (state === "out") {
    return { background: "#ed4b58", boxShadow: "0 0 8px rgba(237,75,88,.6)" };
  }
  return { background: "#1e8f57", boxShadow: "0 0 8px rgba(30,143,87,.7)" };
}

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 40 }, (_, i) =>
  String(CURRENT_YEAR - 10 - i),
);

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-muted text-xs font-bold tracking-[0.15em] uppercase">
        {label}
      </div>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-line bg-white/5 px-4 py-3 text-base text-txt outline-none placeholder:text-muted focus:border-gold/60";

const PROGRESS: Record<Step, number> = {
  choice: 4,
  phone: 8,
  email: 8,
  signup: 20,
  verify: 30,
  photo: 52,
  signin: 15,
  forgotVerify: 15,
  resetPassword: 15,
  campus: 65,
  code: 80,
  done: 100,
};

const STORAGE_KEY = "onboard_progress_v1";

type SavedProgress = {
  step?: Step;
  contactType?: ContactType;
  selectedType?: ContactType | null;
  contactValue?: string;
  userId?: string;
  signinNickname?: string;
  name?: string;
  nickname?: string;
  gender?: string;
  dobDay?: string;
  dobMonth?: string;
  dobYear?: string;
  otpReference?: string;
  selectedCampus?: CampusPickerItem | null;
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
  const devJumpParam = searchParams.get("devstep");
  const devJumpStep =
    DEV_JUMP_ENABLED && DEV_JUMP_STEPS.includes(devJumpParam as Step)
      ? (devJumpParam as Step)
      : null;
  // "code" isn't a real step (it's a modal over "campus") — devstep=code
  // lands on campus with the modal pre-opened, handled below
  const [step, setStep] = useState<Step>(
    devJumpStep === "code" ? "campus" : (devJumpStep ?? "choice"),
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [contactType, setContactType] = useState<ContactType>("PHONE");
  const [selectedType, setSelectedType] = useState<ContactType | null>(null);
  const [contactValue, setContactValue] = useState("");
  const [userId, setUserId] = useState("");
  const [signinNickname, setSigninNickname] = useState("");

  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [gender, setGender] = useState("");
  const [dobDay, setDobDay] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobYear, setDobYear] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [signinPassword, setSigninPassword] = useState("");

  const [passwordResetToken, setPasswordResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const [otpReference, setOtpReference] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [resendIn, setResendIn] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoZoom, setPhotoZoom] = useState(1);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const [campusQuery, setCampusQuery] = useState("");
  const [campuses, setCampuses] = useState<CampusPickerItem[]>(
    devJumpStep === "campus" ? DEV_MOCK_CAMPUSES : [],
  );
  const [campusesLoading, setCampusesLoading] = useState(false);
  const [selectedCampus, setSelectedCampus] = useState<CampusPickerItem | null>(
    devJumpStep === "code" ? DEV_MOCK_CAMPUSES[0] : null,
  );

  // the access-code gate is a modal over the campus grid, not its own step
  const [codeModalOpen, setCodeModalOpen] = useState(devJumpStep === "code");
  // which card is mid-selection right now - shows a spinner on that one
  // specifically while pickCampus()'s PUT is in flight
  const [pickingCampusId, setPickingCampusId] = useState<number | null>(null);
  // 9 characters, no dashes - the integration guide documents 8, but real
  // codes issued to schools are 9 (confirmed against an actual code)
  const [code, setCode] = useState<string[]>(Array(9).fill(""));
  const [codeState, setCodeState] = useState<"" | "good" | "bad">("");
  const [codeMessage, setCodeMessage] = useState("");
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [assentTextVersion, setAssentTextVersion] = useState("");

  const [restored, setRestored] = useState(false);

  // the assent version is decided by the backend and can change between
  // contests, so it has to be fetched live rather than hardcoded — a stale
  // local version was why joins were failing. The agreement itself isn't
  // shown to the student here (that's not how the mock does it) — the code
  // step just needs the current version so the join can auto-accept it.
  useEffect(() => {
    if (step !== "code" || assentTextVersion) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getLockinVersion(VERSION_CODE);
        if (cancelled) return;
        setAssentTextVersion(res.data?.assentTextVersion ?? "");
      } catch {
        // non-fatal here; a join attempt will surface the real error if the
        // version really is required and missing
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, assentTextVersion]);

  useEffect(() => {
    if (devJumpStep) {
      const raf = requestAnimationFrame(() => setRestored(true));
      return () => cancelAnimationFrame(raf);
    }
    const raf = requestAnimationFrame(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved: SavedProgress = JSON.parse(raw);
          if (saved.step) setStep(saved.step);
          if (saved.contactType) setContactType(saved.contactType);
          if (saved.selectedType) setSelectedType(saved.selectedType);
          if (saved.contactValue) setContactValue(saved.contactValue);
          if (saved.userId) setUserId(saved.userId);
          if (saved.signinNickname) setSigninNickname(saved.signinNickname);
          if (saved.name) setName(saved.name);
          if (saved.nickname) setNickname(saved.nickname);
          if (saved.gender) setGender(saved.gender);
          if (saved.dobDay) setDobDay(saved.dobDay);
          if (saved.dobMonth) setDobMonth(saved.dobMonth);
          if (saved.dobYear) setDobYear(saved.dobYear);
          if (saved.otpReference) setOtpReference(saved.otpReference);
          if (saved.selectedCampus) setSelectedCampus(saved.selectedCampus);
        }
      } catch {
        // ignore corrupt/unavailable storage
      }
      setRestored(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [devJumpStep]);

  // the single source of truth for "given the server's nextStep, where does
  // this patient go" — used after verify/sign-in/join so a returning, fully
  // joined patient lands on their check or home instead of being walked
  // through campus + access code again just because they signed in again
  const routeByNextStep = useCallback(
    async (nextStep: string | undefined, fallback: Step) => {
      switch (nextStep) {
        case "VERIFY_OTP":
          setStep("verify");
          return;
        case "PROFILE_PHOTO":
          setStep("photo");
          return;
        case "TEAM_PICKER":
          setStep("campus");
          return;
        case "ACCESS_CODE":
          // the code gate is a modal over the campus grid — if we still
          // know which campus they picked (restored from this browser),
          // reopen it directly; otherwise land on the grid to pick again
          setStep("campus");
          if (selectedCampus) setCodeModalOpen(true);
          return;
        case "SCREENING":
          router.push("/screening");
          return;
        case "HOME":
          router.push("/home");
          return;
        default:
          setStep(fallback);
      }
    },
    [router, selectedCampus],
  );

  const [sessionChecked, setSessionChecked] = useState(!!devJumpStep);

  useEffect(() => {
    // dev-jump already forced the destination step deliberately — don't let
    // a real (likely unauthenticated) session check second-guess it
    if (!restored || devJumpStep) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getVersionMembership(VERSION_CODE);
        if (cancelled) return;
        if (res.data?.teamId) {
          // already signed in and already joined a team - skip the whole
          // flow and go straight to whatever's actually next for them
          await routeByNextStep(res.data?.nextStep, "done");
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status !== 401 && e.status !== 403) {
          // signed in, but hasn't joined a team for this version yet -
          // resume at the campus picker instead of restarting from scratch
          setStep((s) =>
            s === "campus" || s === "code" || s === "done" ? s : "campus",
          );
        } else {
          // 401/403 means not signed in - if the restored step needs a
          // session (photo/campus/code/done all call authenticated
          // endpoints), send them to sign in instead of letting them hit a
          // 403 further down the flow. routeByNextStep already resumes them
          // at the right step once they're back in.
          setStep((s) =>
            s === "photo" || s === "campus" || s === "code" || s === "done"
              ? "signin"
              : s,
          );
        }
      } finally {
        if (!cancelled) setSessionChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restored, routeByNextStep, devJumpStep]);

  useEffect(() => {
    if (!restored) return; // don't overwrite saved progress with initial state
    try {
      const toSave: SavedProgress = {
        step,
        contactType,
        selectedType,
        contactValue,
        userId,
        signinNickname,
        name,
        nickname,
        gender,
        dobDay,
        dobMonth,
        dobYear,
        otpReference,
        selectedCampus,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // ignore unavailable storage (e.g. private browsing)
    }
  }, [
    restored,
    step,
    contactType,
    selectedType,
    contactValue,
    userId,
    signinNickname,
    name,
    nickname,
    gender,
    dobDay,
    dobMonth,
    dobYear,
    otpReference,
    selectedCampus,
  ]);

  useEffect(() => {
    if (step === "done") {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  }, [step]);

  // "done" isn't a real destination — membership.nextStep decides whether
  // this patient owes a screening or lands on the day view, for both a
  // fresh join and a returning session that resolved straight to "done"
  useEffect(() => {
    if (step !== "done") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getVersionMembership(VERSION_CODE);
        if (cancelled) return;
        if (res.data?.screeningDue || res.data?.nextStep === "SCREENING") {
          router.push("/screening");
        } else {
          router.push("/home");
        }
      } catch {
        if (!cancelled) router.push("/home");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, router]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // land on the first OTP box the moment this step is reached — the whole
  // point of a 6-digit code is typing it immediately, no click required
  useEffect(() => {
    if (step !== "verify") return;
    const raf = requestAnimationFrame(() => otpRefs.current[0]?.focus());
    return () => cancelAnimationFrame(raf);
  }, [step]);

  useEffect(() => {
    if (step !== "campus") return;
    let cancelled = false;
    const t = setTimeout(() => {
      setCampusesLoading(true);
      getVersionCampuses(VERSION_CODE, campusQuery || undefined)
        .then((res) => {
          if (!cancelled) setCampuses(res.data ?? []);
        })
        .catch((e) => {
          if (!cancelled)
            setError(e instanceof Error ? e.message : "Search failed");
        })
        .finally(() => {
          if (!cancelled) setCampusesLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [step, campusQuery]);

  function pickContactMethod(type: ContactType) {
    setContactType(type);
    setContactValue("");
    setError(null);
    setStep(type === "PHONE" ? "phone" : "email");
  }

  async function submitContact() {
    const value =
      contactType === "PHONE"
        ? `+233${contactValue.replace(/\D/g, "").replace(/^0+/, "")}`
        : contactValue.trim();
    if (!contactValue.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await checkContact(contactType, value);
      setContactValue(value);
      if (res.data?.exists) {
        // always go through sign-in rather than guessing from locally-cached
        // userId/otpReference - that shortcut used to resend an OTP for
        // whatever account matched local state, which broke the moment that
        // account got verified elsewhere in the meantime ("Account is
        // already verified. Please sign in."). Sign-in's own nextStep
        // handling already covers both real outcomes correctly: an
        // unverified account gets a *fresh* otpReference and lands on
        // "verify" (see submitSignin), and a verified, already-enrolled
        // account is routed straight past onboarding via routeByNextStep.
        setUserId(res.data.userId ?? "");
        setSigninNickname(res.data.nickname ?? "there");
        setStep("signin");
      } else {
        setStep("signup");
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const passwordRules = {
    length: password.length >= 6,
    letter: /[A-Za-z]/.test(password),
    number: /[0-9]/.test(password),
  };

  async function submitSignup() {
    if (
      !name.trim() ||
      !nickname.trim() ||
      !gender ||
      !dobDay ||
      !dobMonth ||
      !dobYear
    ) {
      setError("Please fill in every field.");
      return;
    }
    if (
      !passwordRules.length ||
      !passwordRules.letter ||
      !passwordRules.number
    ) {
      setError("Password needs 6+ characters, a letter, and a number.");
      return;
    }
    const monthIndex = MONTHS.indexOf(dobMonth) + 1;
    const dateOfBirth = `${dobYear}-${String(monthIndex).padStart(2, "0")}-${dobDay.padStart(2, "0")}`;

    setLoading(true);
    setError(null);
    try {
      const res = await signup({
        contactType,
        contact: contactValue,
        name: name.trim(),
        nickname: nickname.trim(),
        gender,
        dateOfBirth,
        password,
        versionCode: VERSION_CODE,
      });
      setUserId(res.data?.userId ?? "");
      if (res.data?.otpReference) {
        setOtpReference(res.data.otpReference);
        setResendIn(57);
        setStep("verify");
      } else if (res.data?.userId) {
        const otpRes = await sendOtp(res.data.userId);
        setOtpReference(otpRes.data?.otpReference ?? "");
        setResendIn(otpRes.data?.expiresInSeconds ?? 57);
        setStep("verify");
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function resendOtp() {
    if (resendIn > 0 || !userId) return;
    setLoading(true);
    try {
      const res = await sendOtp(userId);
      setOtpReference(res.data?.otpReference ?? otpReference);
      setResendIn(res.data?.expiresInSeconds ?? 57);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't resend the code");
    } finally {
      setLoading(false);
    }
  }

  async function completeVerify(fullCode: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await verifyOtp(otpReference, fullCode);
      await routeByNextStep(res.data?.nextStep, "campus");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That code didn't work");
      setOtp(Array(6).fill(""));
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  // recovery: "Forgot your password?" on the sign-in step
  async function submitForgotPassword() {
    setLoading(true);
    setError(null);
    try {
      const res = await forgotPassword(contactValue);
      setOtpReference(res.data?.otpReference ?? "");
      setOtp(Array(6).fill(""));
      setResendIn(57);
      setStep("forgotVerify");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // recovery resend can't reuse resendOtp() - that re-sends via userId, which
  // this (possibly signed-out) flow never has. Re-request a recovery OTP
  // against the contact instead.
  async function resendForgotOtp() {
    if (resendIn > 0) return;
    setLoading(true);
    try {
      const res = await forgotPassword(contactValue);
      setOtpReference(res.data?.otpReference ?? otpReference);
      setResendIn(57);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't resend the code");
    } finally {
      setLoading(false);
    }
  }

  // reuses the same OTP-verify endpoint as completeVerify, but a recovery
  // otpReference returns only a passwordResetToken - no cookies, no
  // nextStep routing, since this account isn't being signed in here.
  async function completeForgotVerify(fullCode: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await verifyOtp(otpReference, fullCode);
      if (res.data?.passwordResetToken) {
        setPasswordResetToken(res.data.passwordResetToken);
        setStep("resetPassword");
      } else {
        setError("That code didn't work");
        setOtp(Array(6).fill(""));
        otpRefs.current[0]?.focus();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That code didn't work");
      setOtp(Array(6).fill(""));
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  const newPasswordRules = {
    length: newPassword.length >= 6,
    letter: /[A-Za-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
  };

  async function submitResetPassword() {
    if (
      !newPasswordRules.length ||
      !newPasswordRules.letter ||
      !newPasswordRules.number
    ) {
      setError("Password needs 6+ characters, a letter, and a number.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await setPasswordApi(passwordResetToken, newPassword, confirmNewPassword);
      setSigninPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordResetToken("");
      setStep("signin");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(i: number, raw: string) {
    const v = raw.replace(/\D/g, "").slice(0, 1);
    const next = [...otp];
    next[i] = v;
    setOtp(next);
    if (v && i < otp.length - 1) otpRefs.current[i + 1]?.focus();
    if (next.every((c) => c) && next.join("").length === otp.length) {
      if (step === "forgotVerify") {
        completeForgotVerify(next.join(""));
      } else {
        completeVerify(next.join(""));
      }
    }
  }

  function pickPhoto() {
    photoInputRef.current?.click();
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoFile(file);
    setPhotoZoom(1);
    setPhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  // crops the preview to a square at the chosen zoom, matching what's shown
  // in the circular frame, rather than uploading the original untouched file
  function cropPhotoToBlob(img: HTMLImageElement, zoom: number): Promise<Blob | null> {
    const size = 480;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.resolve(null);
    const side = Math.min(img.naturalWidth, img.naturalHeight) / zoom;
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  }

  async function submitPhoto() {
    // dev-jump previews this screen with no real session — the real
    // skip/upload endpoints would just 401, so simulate success and move on
    if (devJumpStep) {
      setStep("campus");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (!photoFile || !photoPreviewUrl) {
        const res = await skipProfilePhoto();
        await routeByNextStep(res.data?.nextStep, "campus");
        return;
      }
      const img = document.createElement("img");
      const loaded = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Couldn't read that photo"));
      });
      img.src = photoPreviewUrl;
      await loaded;
      const blob = await cropPhotoToBlob(img, photoZoom);
      if (!blob) throw new Error("Couldn't process that photo");
      const res = await uploadProfilePhoto(blob);
      await routeByNextStep(res.data?.nextStep, "campus");
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        // session died between the earlier check and this submit - send
        // them to sign in instead of surfacing a raw 403; routeByNextStep
        // (via the "done" effect / a future session check) resumes them
        // back at photo once they're re-authenticated
        setStep("signin");
        return;
      }
      setError(e instanceof ApiError ? e.message : "Couldn't upload that photo");
    } finally {
      setLoading(false);
    }
  }

  async function submitSignin() {
    if (!signinPassword) return;
    setLoading(true);
    setError(null);
    try {
      const res = await signin(contactValue, signinPassword, VERSION_CODE);
      if (!res.data?.accessToken && res.data?.otpReference) {
        setUserId(res.data.userId ?? "");
        setOtpReference(res.data.otpReference);
        setResendIn(57);
        setStep("verify");
        return;
      }
      await routeByNextStep(
        res.data?.nextStep ?? res.data?.activeVersion?.nextStep,
        "campus",
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function pickCampus(item: CampusPickerItem) {
    // shows a spinner on this specific card while the PUT below is in
    // flight - the modal can't open before it resolves, since the join-code
    // submit that follows needs the campus already selected server-side
    setPickingCampusId(item.campusId);
    // dev-jump previews this screen with no real session — skip the real
    // PUT, which would just 401, and open the code modal directly
    if (devJumpStep) {
      setSelectedCampus(item);
      setCodeModalOpen(true);
      setPickingCampusId(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await selectVersionCampus(VERSION_CODE, item.campusId);
      setSelectedCampus(item);
      setCodeModalOpen(true);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        setStep("signin");
        return;
      }
      setError(
        e instanceof ApiError ? e.message : "Couldn't select that school",
      );
    } finally {
      setLoading(false);
      setPickingCampusId(null);
    }
  }

  // per the guide: DELETE the recorded campus choice when they back out of
  // the code modal, so nextStep doesn't keep resuming at ACCESS_CODE for a
  // school they backed away from browsing
  async function backOutOfCodeModal() {
    setCodeModalOpen(false);
    if (devJumpStep) {
      setSelectedCampus(null);
      return;
    }
    try {
      await deleteVersionCampus(VERSION_CODE);
    } catch {
      // best-effort - if this fails the server still has the old campus
      // recorded, but picking a school again on the next visit re-PUTs it
    } finally {
      setSelectedCampus(null);
    }
  }

  async function completeCode(
    fullCode: string,
    retried = false,
    versionOverride?: string,
  ) {
    if (!selectedCampus) return;
    // dev-jump previews this screen against a fake campus with no real
    // session — no real code could ever validate, so simulate success
    if (devJumpStep) {
      setCodeState("good");
      setCodeMessage("Great, you're in! (dev preview)");
      setTimeout(() => {
        setCodeModalOpen(false);
        setStep("done");
      }, 1100);
      return;
    }
    setLoading(true);
    try {
      const res = await joinVersionTeam(VERSION_CODE, {
        campusId: selectedCampus.campusId,
        accessCode: fullCode,
        assentAccepted: true,
        assentTextVersion: versionOverride ?? assentTextVersion,
      });
      setCodeState("good");
      // a retried request after a timeout can land on a membership that's
      // already active — the guide is explicit that this counts as success
      setCodeMessage(
        res.data?.alreadyJoined
          ? "You're already on this team!"
          : "Great, you're in!",
      );
      setTimeout(() => {
        setCodeModalOpen(false);
        routeByNextStep(res.data?.nextStep, "done");
      }, 1100);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        setCodeModalOpen(false);
        setStep("signin");
        return;
      }
      const code = e instanceof ApiError ? e.code : undefined;

      // the assent version changed server-side since it was fetched — the
      // agreement isn't shown to the student here, so refetch the current
      // version and retry silently once rather than surfacing this at all
      if ((code === "ASSENT_REQUIRED" || code === "ASSENT_STALE") && !retried) {
        try {
          const v = await getLockinVersion(VERSION_CODE);
          const fresh = v.data?.assentTextVersion ?? "";
          setAssentTextVersion(fresh);
          await completeCode(fullCode, true, fresh);
          return;
        } catch {
          // fall through to the generic error below
        }
      }

      // this version isn't the patient's active enrolment (e.g. resumed on a
      // different device) — activate it once, then retry the same join
      if (code === "NO_ACTIVE_ENROLLMENT" && !retried) {
        try {
          await activateEnrollment(VERSION_CODE);
          await completeCode(fullCode, true);
          return;
        } catch {
          // fall through to the generic error below
        }
      }

      setCodeState("bad");
      setCodeMessage(
        (code && JOIN_ERROR_COPY[code]) ||
          (e instanceof ApiError
            ? e.message
            : "That access code didn't work. Please try again."),
      );
    } finally {
      setLoading(false);
    }
  }

  function handleCodeChange(i: number, raw: string) {
    // strips anything that isn't alphanumeric so pasting a full code (in
    // case a school hands it out with separators) into any box still works
    const cleaned = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const next = [...code];

    if (!cleaned) {
      next[i] = "";
      setCode(next);
      setCodeState("");
      setCodeMessage("");
      return;
    }

    let idx = i;
    for (const ch of cleaned) {
      if (idx >= next.length) break;
      next[idx] = ch;
      idx++;
    }
    setCode(next);
    setCodeState("");
    setCodeMessage("");
    codeRefs.current[Math.min(idx, next.length - 1)]?.focus();
    if (next.every((c) => c)) completeCode(next.join(""));
  }

  function goBack() {
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
      case "photo":
        // once the OTP is verified it's consumed server-side - "photo" can
        // never step back into "verify" to re-enter a burned code
        setStep(userId && signinNickname ? "signin" : "signup");
        return;
      case "forgotVerify":
      case "resetPassword":
        // same for recovery: a verified recovery OTP is one-time too -
        // "resetPassword" skips straight back to "signin", never back
        // through "forgotVerify"
        setStep("signin");
        return;
      case "campus":
        setStep("photo");
        return;
      case "code":
        setStep("campus");
        return;
      default:
        return;
    }
  }

  const nextConfig = (() => {
    switch (step) {
      case "choice":
        return {
          show: true,
          enabled: !!selectedType,
          label: `Next (${PROGRESS.choice}%)`,
          onClick: () => selectedType && pickContactMethod(selectedType),
        };
      case "phone":
      case "email":
        return {
          show: true,
          enabled: !loading && contactValue.trim().length > 0,
          label: loading ? "Checking…" : `Next (${PROGRESS[step]}%)`,
          onClick: submitContact,
        };
      case "signup":
        return {
          show: true,
          enabled: !loading,
          label: loading ? "Creating…" : `Next (${PROGRESS.signup}%)`,
          onClick: submitSignup,
        };
      case "signin":
        // signing in isn't a step in the linear onboarding sequence - it's a
        // gate a returning user passes through, so it gets no percentage.
        // Wherever they land after (done, or resuming at campus/code)
        // already reflects their real progress.
        return {
          show: true,
          enabled: !loading && signinPassword.length > 0,
          label: loading ? "Signing in…" : "Sign In",
          onClick: submitSignin,
        };
      case "resetPassword":
        // recovery, like sign-in, isn't part of the linear sequence - no
        // percentage on this button either.
        return {
          show: true,
          enabled:
            !loading &&
            newPassword.length > 0 &&
            confirmNewPassword.length > 0,
          label: loading ? "Saving…" : "Save password",
          onClick: submitResetPassword,
        };
      case "photo":
        // matches the mock: always "Next" — skipping when no photo was
        // chosen is silent, never called out on the button itself
        return {
          show: true,
          enabled: !loading,
          label: loading ? "One sec…" : `Next (${PROGRESS.photo}%)`,
          onClick: submitPhoto,
        };
      default:
        return { show: false, enabled: false, label: "", onClick: () => {} };
    }
  })();

  const showFooter = step !== "done";

  if (!sessionChecked) {
    return (
      <div className="text-txt flex h-screen">
        <PhotoTestimonialPanel className="h-full w-[40%]" />
        <div
          className="flex flex-1 items-center justify-center"
          style={{
            background:
              "radial-gradient(118% 86% at 50% 16%, #733730 0%, #572621 42%, #3b1a17 74%, #2b1210 100%)",
          }}
        >
          <div className="border-gold size-8 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="text-txt flex h-screen">
      <PhotoTestimonialPanel className="h-full w-[40%]" />

      <div
        className={`relative flex flex-1 flex-col overflow-y-auto px-8 sm:px-16 ${
          step === "photo" ? "py-4" : "py-10"
        }`}
        style={{
          background:
            "radial-gradient(118% 86% at 50% 16%, #733730 0%, #572621 42%, #3b1a17 74%, #2b1210 100%)",
        }}
      >
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Image
            src="/images/logo.webp"
            alt="JustGo Health"
            width={384}
            height={67}
            className="h-6 w-auto invert"
          />
          <div className="land-pill whitespace-nowrap">
            Locking in for&nbsp;<b>NSMQ 2026</b>
          </div>
        </div>

        <div
          className={`mx-auto flex w-full flex-1 flex-col justify-center ${
            step === "campus" ? "max-w-none" : "max-w-md"
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
                  <div className="mt-8 grid grid-cols-2 gap-4">
                    {(["PHONE", "EMAIL"] as ContactType[]).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setSelectedType(type)}
                        className={`flex flex-col items-center gap-3 rounded-2xl border py-10 font-bold transition-colors ${
                          selectedType === type
                            ? "border-yes bg-yes/10"
                            : "hover:border-gold/60 border-white/10 bg-black/20 hover:bg-black/30"
                        }`}
                      >
                        <span className="text-gold">
                          {type === "PHONE" ? "☎" : "✉"}
                        </span>
                        {type}
                      </button>
                    ))}
                  </div>
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
                        <Field label="Ghana">
                          <div
                            className={`${inputClass} flex items-center gap-2`}
                          >
                            🇬🇭 +233
                          </div>
                        </Field>
                        <div className="flex-1">
                          <Field label="Phone number">
                            <input
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
                      <Field label="Email">
                        <input
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
                    {error && <p className="text-no text-sm">{error}</p>}
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
                    <Field label="Your name">
                      <input
                        className={inputClass}
                        placeholder="What's your name?"
                        value={name}
                        onChange={(e) => setName(smartName(e.target.value))}
                      />
                    </Field>
                    <Field label="Nickname">
                      <input
                        className={inputClass}
                        placeholder="What should we call you?"
                        value={nickname}
                        onChange={(e) =>
                          setNickname(sanitizeNickname(e.target.value))
                        }
                      />
                    </Field>
                    <Field label="Gender">
                      <div className="flex gap-3">
                        {["Male", "Female"].map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setGender(g)}
                            className={`flex-1 rounded-xl border px-4 py-3 font-medium transition-colors ${
                              gender === g
                                ? "border-yes bg-yes/15 text-yes"
                                : "border-line text-txt bg-white/5"
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="Date of birth">
                      <div className="flex gap-2">
                        <CustomSelect
                          className="min-w-0 flex-[2]"
                          placeholder="Day"
                          value={dobDay}
                          onChange={setDobDay}
                          options={DAYS}
                        />
                        <CustomSelect
                          className="min-w-0 flex-[5]"
                          placeholder="Month"
                          value={dobMonth}
                          onChange={setDobMonth}
                          options={MONTHS}
                          mobileLabels={MONTHS_SHORT}
                        />
                        <CustomSelect
                          className="min-w-0 flex-[3]"
                          placeholder="Year"
                          value={dobYear}
                          onChange={setDobYear}
                          options={YEARS}
                          defaultScrollValue="2005"
                        />
                      </div>
                    </Field>
                    <Field label="Password">
                      <div className="relative">
                        <input
                          className={inputClass}
                          type={showPassword ? "text" : "password"}
                          placeholder="Create a password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((s) => !s)}
                          className="text-muted absolute top-1/2 right-3 -translate-y-1/2 text-xs font-bold"
                        >
                          {showPassword ? "HIDE" : "SHOW"}
                        </button>
                      </div>
                      <ul className="mt-1 flex flex-wrap gap-3 text-xs">
                        {[
                          ["length", "6+ characters"],
                          ["letter", "One letter"],
                          ["number", "One number"],
                        ].map(([key, label]) => (
                          <li
                            key={key}
                            className={
                              passwordRules[key as keyof typeof passwordRules]
                                ? "text-yes"
                                : "text-muted"
                            }
                          >
                            {passwordRules[key as keyof typeof passwordRules]
                              ? "✓ "
                              : "· "}
                            {label}
                          </li>
                        ))}
                      </ul>
                    </Field>
                    {error && <p className="text-no text-sm">{error}</p>}
                  </form>
                </div>
              )}

              {step === "verify" && (
                <div className="text-center">
                  <h1 className="text-3xl font-extrabold tracking-tight">
                    Enter Verification Code
                  </h1>
                  <p className="text-muted mt-2">
                    A 6-digit verification code was just sent to
                    <br />
                    <strong className="text-txt">{contactValue}</strong>
                  </p>
                  <div className="mt-6 flex justify-center gap-[1.5vw] sm:gap-2">
                    {otp.map((v, i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          otpRefs.current[i] = el;
                        }}
                        className="border-line text-txt focus:border-gold/60 aspect-[4/5] rounded-xl border bg-white/5 text-center font-bold outline-none"
                        style={{
                          width: "clamp(32px, 11vw, 44px)",
                          fontSize: "clamp(16px, 4.5vw, 20px)",
                        }}
                        maxLength={1}
                        inputMode="numeric"
                        value={v}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace" && !v && i > 0) {
                            otpRefs.current[i - 1]?.focus();
                          }
                        }}
                      />
                    ))}
                  </div>
                  {error && <p className="text-no mt-4 text-sm">{error}</p>}
                  <button
                    type="button"
                    onClick={resendOtp}
                    disabled={resendIn > 0 || loading}
                    className="text-muted mt-6 text-sm font-medium disabled:opacity-60"
                  >
                    {resendIn > 0
                      ? `Resend code in 0:${String(resendIn).padStart(2, "0")}`
                      : "Resend code"}
                  </button>
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
                    <Field label="Password">
                      <input
                        className={inputClass}
                        type="password"
                        placeholder="Enter your password"
                        value={signinPassword}
                        onChange={(e) => setSigninPassword(e.target.value)}
                      />
                    </Field>
                    <div className="-mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={submitForgotPassword}
                        disabled={loading}
                        className="text-muted hover:text-txt text-xs font-semibold disabled:opacity-60"
                      >
                        Forgot your password?
                      </button>
                    </div>
                    {error && <p className="text-no text-sm">{error}</p>}
                  </form>
                </div>
              )}

              {step === "forgotVerify" && (
                <div className="text-center">
                  <h1 className="text-3xl font-extrabold tracking-tight">
                    Enter account recovery code
                  </h1>
                  <p className="text-muted mt-2">
                    A 6-digit recovery code was just sent to
                    <br />
                    <strong className="text-txt">{contactValue}</strong>
                  </p>
                  <div className="mt-6 flex justify-center gap-[1.5vw] sm:gap-2">
                    {otp.map((v, i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          otpRefs.current[i] = el;
                        }}
                        className="border-line text-txt focus:border-gold/60 aspect-[4/5] rounded-xl border bg-white/5 text-center font-bold outline-none"
                        style={{
                          width: "clamp(32px, 11vw, 44px)",
                          fontSize: "clamp(16px, 4.5vw, 20px)",
                        }}
                        maxLength={1}
                        inputMode="numeric"
                        value={v}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace" && !v && i > 0) {
                            otpRefs.current[i - 1]?.focus();
                          }
                        }}
                      />
                    ))}
                  </div>
                  {error && <p className="text-no mt-4 text-sm">{error}</p>}
                  <button
                    type="button"
                    onClick={resendForgotOtp}
                    disabled={resendIn > 0 || loading}
                    className="text-muted mt-6 text-sm font-medium disabled:opacity-60"
                  >
                    {resendIn > 0
                      ? `Resend code in 0:${String(resendIn).padStart(2, "0")}`
                      : "Resend code"}
                  </button>
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
                    <Field label="New password">
                      <div className="relative">
                        <input
                          className={inputClass}
                          type={showNewPassword ? "text" : "password"}
                          placeholder="Create a new password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((s) => !s)}
                          className="text-muted absolute top-1/2 right-3 -translate-y-1/2 text-xs font-bold"
                        >
                          {showNewPassword ? "HIDE" : "SHOW"}
                        </button>
                      </div>
                      <ul className="mt-1 flex flex-wrap gap-3 text-xs">
                        {[
                          ["length", "6+ characters"],
                          ["letter", "One letter"],
                          ["number", "One number"],
                        ].map(([key, label]) => (
                          <li
                            key={key}
                            className={
                              newPasswordRules[
                                key as keyof typeof newPasswordRules
                              ]
                                ? "text-yes"
                                : "text-muted"
                            }
                          >
                            {newPasswordRules[
                              key as keyof typeof newPasswordRules
                            ]
                              ? "✓ "
                              : "· "}
                            {label}
                          </li>
                        ))}
                      </ul>
                    </Field>
                    <Field label="Confirm password">
                      <div className="relative">
                        <input
                          className={inputClass}
                          type={showConfirmNewPassword ? "text" : "password"}
                          placeholder="Re-enter your new password"
                          value={confirmNewPassword}
                          onChange={(e) =>
                            setConfirmNewPassword(e.target.value)
                          }
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmNewPassword((s) => !s)}
                          className="text-muted absolute top-1/2 right-3 -translate-y-1/2 text-xs font-bold"
                        >
                          {showConfirmNewPassword ? "HIDE" : "SHOW"}
                        </button>
                      </div>
                    </Field>
                    {error && <p className="text-no text-sm">{error}</p>}
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
                    <strong className="text-txt">{nickname || "there"}</strong>
                    .
                  </p>

                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />

                  <div className="mt-4 flex flex-col items-center gap-[14px]">
                    <button
                      type="button"
                      onClick={pickPhoto}
                      className={`photo-circle${photoPreviewUrl ? " filled" : ""}`}
                    >
                      {photoPreviewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- object URL preview, not a static/remote asset
                        <img
                          src={photoPreviewUrl}
                          alt=""
                          className="photo-img"
                          style={{ transform: `scale(${photoZoom})` }}
                        />
                      ) : (
                        <span className="photo-empty">
                          <span className="photo-empty-icon">+</span>
                          <span className="photo-empty-text">
                            Upload a photo
                          </span>
                        </span>
                      )}
                    </button>

                    <div className={`zoom-row${photoPreviewUrl ? " on" : ""}`}>
                      <button
                        type="button"
                        className="zoom-sign"
                        disabled={!photoPreviewUrl}
                        onClick={() =>
                          setPhotoZoom((z) => Math.max(1, z - 0.1))
                        }
                      >
                        −
                      </button>
                      <input
                        type="range"
                        className="zoom-slider"
                        min={1}
                        max={2.5}
                        step={0.05}
                        value={photoZoom}
                        disabled={!photoPreviewUrl}
                        onChange={(e) => setPhotoZoom(Number(e.target.value))}
                      />
                      <button
                        type="button"
                        className="zoom-sign"
                        disabled={!photoPreviewUrl}
                        onClick={() =>
                          setPhotoZoom((z) => Math.min(2.5, z + 0.1))
                        }
                      >
                        +
                      </button>
                    </div>

                    <p className="text-no min-h-[18px] text-sm">
                      {error}
                    </p>

                    {photoPreviewUrl && (
                      <button
                        type="button"
                        onClick={pickPhoto}
                        className="replace-btn"
                      >
                        Choose a different photo
                      </button>
                    )}
                  </div>
                </div>
              )}

              {step === "campus" && (
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight">
                    Which school are you competing for?
                  </h1>
                  <p className="text-muted mt-2">
                    Search for your school&apos;s NSMQ team.
                  </p>
                  <input
                    className="border-line focus:border-gold/60 text-txt placeholder:text-muted mt-4 w-full rounded-xl border bg-white/5 px-4 py-2 text-sm outline-none"
                    placeholder="Search your school"
                    value={campusQuery}
                    onChange={(e) => setCampusQuery(e.target.value)}
                  />
                  <div className="mt-4">
                    {campusesLoading && (
                      <p className="text-muted py-6 text-center">Searching…</p>
                    )}
                    {!campusesLoading && campuses.length === 0 && (
                      <p className="text-muted py-6 text-center">
                        No schools found.
                      </p>
                    )}
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      {campuses.map((c) => {
                        const bgUrl = c.logo ?? c.bannerPhoto;
                        return (
                        <button
                          key={c.campusId}
                          type="button"
                          onClick={() => pickCampus(c)}
                          disabled={loading}
                          className="border-gold group relative aspect-square overflow-hidden rounded-2xl border-[1.65px] text-left text-white shadow-[0_8px_22px_rgba(0,0,0,.45)] transition-transform duration-150 hover:-translate-y-1 hover:scale-[1.03] disabled:pointer-events-none disabled:opacity-60"
                        >
                          <div
                            className="absolute inset-0 bg-[#222] bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.09]"
                            style={
                              bgUrl
                                ? { backgroundImage: `url('${bgUrl}')` }
                                : { background: CAMPUS_FALLBACK_BG }
                            }
                          />
                          <div
                            className="absolute inset-0"
                            style={{
                              background:
                                "linear-gradient(180deg, rgba(0,0,0,.15), rgba(0,0,0,.78) 75%)",
                            }}
                          />
                          {c.state === "out" && (
                            <div
                              className="absolute inset-0 z-[2]"
                              style={{
                                background:
                                  "linear-gradient(180deg, rgba(43,18,16,.28), rgba(43,18,16,.52))",
                              }}
                            />
                          )}

                          {/* a shared flex row, not two independently-positioned
                              pills - so a long whenLabel shrinks/truncates
                              instead of overlapping the member-count pill */}
                          <div className="absolute inset-x-3 top-3 z-[6] flex items-start justify-between gap-2">
                            {typeof c.memberCount === "number" &&
                            c.memberCount > 0 ? (
                              <div
                                className="inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-extrabold"
                                style={{
                                  background: "#c9f0dd",
                                  color: "#0c3d26",
                                  borderColor: "rgba(30,143,87,.45)",
                                }}
                              >
                                <span style={{ filter: "saturate(0) brightness(.35)" }}>
                                  ⭐
                                </span>
                                <span>{c.memberCount}</span>
                              </div>
                            ) : (
                              <span />
                            )}

                            {c.whenLabel && (
                              <div
                                className="inline-flex min-w-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-extrabold"
                                style={campusPillStyle(c.state)}
                              >
                                <span
                                  className="size-[5px] shrink-0 rounded-full"
                                  style={campusDotStyle(c.state)}
                                />
                                <span className="truncate">{c.whenLabel}</span>
                              </div>
                            )}
                          </div>

                          <div className="absolute right-0 bottom-[18px] left-0 z-[2] px-4">
                            <div
                              className={`text-xl font-bold ${c.state === "out" ? "opacity-90" : ""}`}
                            >
                              {c.fullName ?? c.nickname}
                            </div>
                            {c.fullName && c.nickname && c.nickname !== c.fullName && (
                              <div className="text-sm text-white/70 italic">
                                {c.nickname}
                              </div>
                            )}
                          </div>

                          {pickingCampusId === c.campusId && (
                            <div className="absolute inset-0 z-[7] flex items-center justify-center bg-black/50">
                              <div className="border-gold size-8 animate-spin rounded-full border-2 border-t-transparent" />
                            </div>
                          )}
                        </button>
                        );
                      })}
                    </div>
                  </div>
                  {error && <p className="text-no mt-4 text-sm">{error}</p>}
                </div>
              )}


              {step === "done" && (
                <div className="text-center">
                  <h1 className="text-yes text-3xl font-extrabold tracking-tight">
                    You&apos;re in!
                  </h1>
                  <p className="text-muted mt-3">Taking you there now…</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {showFooter && (
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
            <p className="text-xs text-white/50">
              Designed with clinical experts and NSMQ alumni, just for you.
            </p>
            <div className="flex items-center gap-3">
              {step === "choice" ? (
                <Link
                  href="/"
                  className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white/70 transition-colors hover:border-white/30 hover:text-white"
                >
                  Back
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={goBack}
                  className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white/70 transition-colors hover:border-white/30 hover:text-white"
                >
                  Back
                </button>
              )}
              {nextConfig.show && (
                <button
                  type="button"
                  disabled={!nextConfig.enabled}
                  onClick={nextConfig.onClick}
                  className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                    nextConfig.enabled
                      ? "bg-gold hover:bg-gold-light text-[#161207]"
                      : "bg-white/10 text-white/40"
                  }`}
                >
                  {nextConfig.label}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <CodeGateModal
        open={codeModalOpen}
        campusName={selectedCampus?.fullName ?? selectedCampus?.nickname}
        code={code}
        codeState={codeState}
        codeMessage={codeMessage}
        codeRefs={codeRefs}
        onCodeChange={handleCodeChange}
        onClose={backOutOfCodeModal}
      />
    </div>
  );
}
