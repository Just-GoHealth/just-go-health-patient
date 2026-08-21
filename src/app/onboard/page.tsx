"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CustomSelect } from "@/components/onboard/custom-select";
import { PhotoTestimonialPanel } from "@/components/onboard/photo-testimonial-panel";
import {
  ApiError,
  type CampusPickerItem,
  type ContactType,
  checkContact,
  getLockinVersion,
  getVersionCampuses,
  getVersionMembership,
  joinVersionTeam,
  selectVersionCampus,
  sendOtp,
  signin,
  signup,
  verifyOtp,
} from "@/lib/api";

const VERSION_CODE = "nsmq2026";

type Step =
  | "choice"
  | "phone"
  | "email"
  | "signup"
  | "verify"
  | "signin"
  | "campus"
  | "code"
  | "done";

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
  signin: 15,
  campus: 45,
  code: 55,
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
  const [step, setStep] = useState<Step>("choice");
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

  const [otpReference, setOtpReference] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [resendIn, setResendIn] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [campusQuery, setCampusQuery] = useState("");
  const [campuses, setCampuses] = useState<CampusPickerItem[]>([]);
  const [campusesLoading, setCampusesLoading] = useState(false);
  const [selectedCampus, setSelectedCampus] = useState<CampusPickerItem | null>(
    null,
  );

  // access codes are 9 characters, shown grouped 3-3-3 (e.g. "99U-38N-23H")
  const [code, setCode] = useState<string[]>(Array(9).fill(""));
  const [codeState, setCodeState] = useState<"" | "good" | "bad">("");
  const [codeMessage, setCodeMessage] = useState("");
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [assentText, setAssentText] = useState("");
  const [assentTextVersion, setAssentTextVersion] = useState("");
  const [assentChecked, setAssentChecked] = useState(false);

  const [restored, setRestored] = useState(false);

  // the assent wording (and its version) is decided by the backend and can
  // change between contests, so it has to be fetched live rather than
  // hardcoded — a stale local version was why joins were failing.
  // This endpoint requires an authenticated session, so fetch it once the
  // user reaches the code step (they're always signed in by then), not on
  // page load when a fresh visitor has no session yet.
  useEffect(() => {
    if (step !== "code" || assentText) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getLockinVersion(VERSION_CODE);
        if (cancelled) return;
        setAssentText(res.data?.assentText ?? "");
        setAssentTextVersion(res.data?.assentTextVersion ?? "");
      } catch {
        // non-fatal here; completeCode() checks for a missing version below
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, assentText]);

  useEffect(() => {
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
  }, []);

  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    if (!restored) return; // wait for local progress to be restored first
    let cancelled = false;
    (async () => {
      try {
        const res = await getVersionMembership(VERSION_CODE);
        if (cancelled) return;
        if (res.data?.teamId) {
          // already signed in and already joined a team - skip the whole
          // flow (this is where a real dashboard route would take over)
          setStep("done");
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status !== 401 && e.status !== 403) {
          // signed in, but hasn't joined a team for this version yet -
          // resume at the campus picker instead of restarting from scratch
          setStep((s) =>
            s === "campus" || s === "code" || s === "done" ? s : "campus",
          );
        }
        // 401/403 means not signed in - leave them on the restored (or
        // default) step, since there's no session to resume.
      } finally {
        if (!cancelled) setSessionChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restored]);

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

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

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
    if (!/\d/.test(nickname)) {
      setError("Nickname must include at least one number.");
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
      await verifyOtp(otpReference, fullCode);
      setStep("campus");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That code didn't work");
      setOtp(Array(6).fill(""));
      otpRefs.current[0]?.focus();
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
      completeVerify(next.join(""));
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
      if (res.data?.activeVersion?.enrollmentStatus === "JOINED") {
        setStep("done");
      } else {
        setStep("campus");
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function pickCampus(item: CampusPickerItem) {
    setLoading(true);
    setError(null);
    try {
      await selectVersionCampus(VERSION_CODE, item.campusId);
      setSelectedCampus(item);
      setStep("code");
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Couldn't select that school",
      );
    } finally {
      setLoading(false);
    }
  }

  async function completeCode(fullCode: string) {
    if (!selectedCampus) return;
    if (assentText && !assentChecked) {
      setCodeState("bad");
      setCodeMessage("Please read and agree to the terms above first.");
      return;
    }
    setLoading(true);
    try {
      await joinVersionTeam(VERSION_CODE, {
        campusId: selectedCampus.campusId,
        accessCode: fullCode,
        assentAccepted: true,
        assentTextVersion: assentTextVersion,
      });
      setCodeState("good");
      setCodeMessage("Great, you're in!");
      setTimeout(() => setStep("done"), 1100);
    } catch (e) {
      // the API doesn't document specific error codes for this endpoint, so
      // show its actual message rather than guessing what a status code means
      setCodeState("bad");
      setCodeMessage(
        e instanceof ApiError
          ? e.message
          : "That access code didn't work. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleCodeChange(i: number, raw: string) {
    // strips the dashes real codes are formatted with ("99U-38N-23H") so
    // typing or pasting the full thing into any box works
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
        setStep(userId && signinNickname ? "signin" : "signup");
        return;
      case "campus":
        setStep("verify");
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
        className="relative flex flex-1 flex-col overflow-y-auto px-8 py-10 sm:px-16"
        style={{
          background:
            "radial-gradient(118% 86% at 50% 16%, #733730 0%, #572621 42%, #3b1a17 74%, #2b1210 100%)",
        }}
      >
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Image
            src="/images/logo.webp"
            alt="JustGo Health"
            width={140}
            height={28}
            className="h-6 w-auto invert"
          />
          <div className="land-pill whitespace-nowrap">
            Locking in for&nbsp;<b>NSMQ 2026</b>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
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
                              maxLength={10}
                              placeholder="24 123 4567"
                              value={contactValue}
                              onChange={(e) => setContactValue(e.target.value)}
                            />
                          </Field>
                        </div>
                      </div>
                    ) : (
                      <Field label="Email">
                        <input
                          className={inputClass}
                          type="email"
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
                        onChange={(e) => setName(e.target.value)}
                      />
                    </Field>
                    <Field label="Nickname">
                      <input
                        className={inputClass}
                        placeholder="What should we call you?"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                      />
                      <p
                        className={`mt-1 text-xs ${
                          nickname && !/\d/.test(nickname)
                            ? "text-no"
                            : "text-muted"
                        }`}
                      >
                        {/\d/.test(nickname) ? "✓ " : "· "}Must include at least
                        one number
                      </p>
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
                          className="w-24"
                          placeholder="Day"
                          value={dobDay}
                          onChange={setDobDay}
                          options={DAYS}
                        />
                        <CustomSelect
                          className="flex-1"
                          placeholder="Month"
                          value={dobMonth}
                          onChange={setDobMonth}
                          options={MONTHS}
                        />
                        <CustomSelect
                          className="w-28"
                          placeholder="Year"
                          value={dobYear}
                          onChange={setDobYear}
                          options={YEARS}
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
                  <div className="mt-6 flex justify-center gap-2">
                    {otp.map((v, i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          otpRefs.current[i] = el;
                        }}
                        className="border-line text-txt focus:border-gold/60 h-14 w-11 rounded-xl border bg-white/5 text-center text-xl font-bold outline-none"
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
                    Hello, {signinNickname}
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
                    {error && <p className="text-no text-sm">{error}</p>}
                  </form>
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
                    className={`${inputClass} mt-6`}
                    placeholder="Search your school"
                    value={campusQuery}
                    onChange={(e) => setCampusQuery(e.target.value)}
                  />
                  <div className="mt-4 flex max-h-96 flex-col gap-2 overflow-y-auto">
                    {campusesLoading && (
                      <p className="text-muted py-6 text-center">Searching…</p>
                    )}
                    {!campusesLoading && campuses.length === 0 && (
                      <p className="text-muted py-6 text-center">
                        No schools found.
                      </p>
                    )}
                    {campuses.map((c) => (
                      <button
                        key={c.campusId}
                        type="button"
                        onClick={() => pickCampus(c)}
                        disabled={loading}
                        className="border-line hover:border-gold/60 flex items-center justify-between rounded-xl border bg-white/5 px-4 py-3 text-left transition-colors hover:bg-white/10 disabled:opacity-60"
                      >
                        <span>
                          <span className="block font-semibold">
                            {c.fullName ?? c.nickname}
                          </span>
                          {c.whenLabel && (
                            <span className="text-muted text-xs">
                              {c.whenLabel}
                            </span>
                          )}
                        </span>
                        {typeof c.memberCount === "number" && (
                          <span className="text-muted text-xs">
                            {c.memberCount} in
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  {error && <p className="text-no mt-4 text-sm">{error}</p>}
                </div>
              )}

              {step === "code" && (
                <div className="text-center">
                  <h1 className="text-2xl font-extrabold tracking-tight">
                    Join{" "}
                    <em className="text-gold not-italic">
                      {selectedCampus?.fullName}
                    </em>
                  </h1>
                  <div className="bg-gold/60 mx-auto mt-3 h-px w-16" />
                  <p className="text-muted mt-4">
                    The{" "}
                    <strong className="text-txt">
                      {selectedCampus?.fullName}
                    </strong>{" "}
                    NSMQ team is private. To join your team, enter the access
                    code provided by your school.
                  </p>

                  {assentText && (
                    <div className="border-line mt-6 text-left">
                      <div className="border-line max-h-40 overflow-y-auto rounded-xl border bg-white/5 p-4 text-sm whitespace-pre-line text-txt/80">
                        {assentText}
                      </div>
                      <label className="mt-3 flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={assentChecked}
                          onChange={(e) => {
                            setAssentChecked(e.target.checked);
                            setCodeState("");
                            setCodeMessage("");
                          }}
                          className="mt-0.5"
                        />
                        <span className="text-muted">
                          I have read and agree to the terms above.
                        </span>
                      </label>
                    </div>
                  )}

                  <div className="mt-6 flex items-center justify-center gap-[1.5vw] sm:gap-2">
                    {code.map((v, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-[1.5vw] sm:gap-2"
                      >
                        <input
                          ref={(el) => {
                            codeRefs.current[i] = el;
                          }}
                          disabled={!!assentText && !assentChecked}
                          className={`aspect-[4/5] rounded-lg border text-center font-bold uppercase outline-none disabled:opacity-40 ${
                            codeState === "good"
                              ? "border-yes bg-yes/10 text-yes"
                              : codeState === "bad"
                                ? "border-no bg-no/10 text-no"
                                : "border-line text-txt focus:border-gold/60 bg-white/5"
                          }`}
                          style={{
                            width: "clamp(24px, 7vw, 40px)",
                            fontSize: "clamp(13px, 3.6vw, 18px)",
                          }}
                          value={v}
                          onChange={(e) => handleCodeChange(i, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Backspace" && !v && i > 0) {
                              codeRefs.current[i - 1]?.focus();
                            }
                          }}
                        />
                        {(i === 2 || i === 5) && (
                          <span className="text-muted font-bold">-</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {codeMessage && (
                    <p
                      className={`mt-3 text-sm font-medium ${
                        codeState === "good" ? "text-yes" : "text-no"
                      }`}
                    >
                      {codeMessage}
                    </p>
                  )}
                  <p className="text-muted mt-6 text-sm">
                    Need your code?{" "}
                    <strong className="text-txt">Contact your team.</strong>
                  </p>
                  <Image
                    src="/images/access-code-illustration.webp"
                    alt=""
                    width={200}
                    height={280}
                    className="mx-auto mt-6 h-40 w-auto"
                  />
                </div>
              )}

              {step === "done" && (
                <div className="text-center">
                  <h1 className="text-yes text-3xl font-extrabold tracking-tight">
                    You&apos;re in!
                  </h1>
                  <p className="text-muted mt-3">
                    Your battery check comes next — that screen isn&apos;t built
                    yet.
                  </p>
                  <Link href="/" className="land-cta-btn mt-6 inline-flex">
                    Back to JustGo Health
                  </Link>
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
    </div>
  );
}
