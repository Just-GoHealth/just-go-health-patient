/**
 * /auth/* (contract section 2). No SMS or email is ever sent: any 6-digit
 * code verifies (123456 is the one the panel suggests).
 */
import {
  accepted,
  fail,
  invalid,
  newId,
  noContent,
  requireText,
} from "../core.js";
import { me } from "../views.js";

export const CODE = "123456";
const ROLES = ["PATIENT", "PROVIDER", "CURATOR"];
const PURPOSES = ["SIGN_UP", "RECOVERY", "CLAIM"];
const PASSWORD_MESSAGE =
  "Use 6 to 72 characters, with at least one letter and one number";
const NICKNAME = /^[\p{L}\p{M}\p{N}_.'’-]+$/u;
export const GENDERS = ["MALE", "FEMALE"];

export function normaliseContact(raw, role, field = "contact") {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value)
    invalid(
      field,
      role === "PATIENT"
        ? "Enter your email or phone number"
        : "Enter your email",
    );
  if (value.includes("@") || role !== "PATIENT") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      invalid(field, "Enter a valid email address");
    return value.toLowerCase();
  }
  const digits = value.replace(/[\s()-]/g, "");
  let phone = digits;
  if (/^0\d{9}$/.test(digits)) phone = `+233${digits.slice(1)}`;
  else if (/^233\d{9}$/.test(digits)) phone = `+${digits}`;
  if (!/^\+233\d{9}$/.test(phone))
    invalid(field, "Enter a valid Ghana phone number");
  return phone;
}

export function checkPassword(password, field = "password") {
  if (
    typeof password !== "string" ||
    password.length < 6 ||
    !/[A-Za-z]/.test(password) ||
    !/\d/.test(password) ||
    new TextEncoder().encode(password).length > 72
  ) {
    invalid(field, PASSWORD_MESSAGE);
  }
  return password;
}

export function nicknameTaken(db, nickname, selfAccountId) {
  const key = nickname.toLowerCase();
  return (
    db.accounts.some(
      (a) =>
        a.id !== selfAccountId && a.patient?.nickname.toLowerCase() === key,
    ) ||
    Object.values(db.pendingSignUps).some(
      (s) => s.patient?.nickname.toLowerCase() === key,
    )
  );
}

export function checkNickname(db, raw, selfAccountId) {
  const nickname = typeof raw === "string" ? raw.trim() : "";
  if (!nickname) invalid("nickname", "Choose a nickname");
  if (nickname.length > 30) invalid("nickname", "Use 30 characters or fewer");
  if (!NICKNAME.test(nickname))
    invalid("nickname", "Use letters, numbers, _ . ' or - (no spaces)");
  if (nicknameTaken(db, nickname, selfAccountId)) {
    fail(409, "NICKNAME_TAKEN", "That nickname is taken", [
      { field: "nickname", message: "That nickname is taken" },
    ]);
  }
  return nickname;
}

export function checkDob(raw) {
  if (
    typeof raw !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(raw) ||
    Number.isNaN(Date.parse(raw))
  ) {
    invalid("dateOfBirth", "Enter your date of birth");
  }
  const year = Number(raw.slice(0, 4));
  if (year < 1980 || year > 2015)
    invalid("dateOfBirth", "Enter a year between 1980 and 2015");
  return raw;
}

const roleOf = (body) => {
  if (!ROLES.includes(body?.role)) invalid("role", "Unknown role");
  return body.role;
};
const purposeOf = (body) => {
  if (!PURPOSES.includes(body?.purpose)) invalid("purpose", "Unknown purpose");
  return body.purpose;
};
export const findAccount = (db, role, contact) =>
  db.accounts.find((a) => a.role === role && a.contact === contact);

/** Any 6 digits pass; an unknown contact still answers CODE_INCORRECT, as on the backend. */
function checkCode(code, known) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code))
    invalid("code", "Enter the 6-digit code");
  if (!known)
    fail(
      422,
      "CODE_INCORRECT",
      "That code isn't right. Check it and try again.",
    );
}

const contactInUse = (field) =>
  fail(
    409,
    "CONTACT_IN_USE",
    "There's already an account for this. Sign in instead.",
    [
      {
        field,
        message: "There's already an account for this. Sign in instead.",
      },
    ],
  );

function createAccount(db, pending) {
  const acc = {
    id: newId(),
    role: pending.role,
    contact: pending.contact,
    password: pending.password,
    claimed: true,
  };
  if (pending.role === "PATIENT") {
    acc.patient = pending.patient;
  } else {
    const provider = {
      id: newId(),
      title: pending.title,
      fullName: pending.fullName,
      nicknames: [],
      email: pending.contact,
      phone: null,
      photo: null,
      slogan: null,
      clinicianNotes: null,
      bio: null,
      clinical: false,
      status: "DRAFT",
      submittedAt: null,
      decidedAt: null,
      roleCategoryIds: [],
      studioCreated: false,
      version: 1,
    };
    db.providers.push(provider);
    acc.providerId = provider.id;
  }
  db.accounts.push(acc);
  return acc;
}

export function register(route) {
  route(
    "GET",
    "/auth/csrf",
    (ctx) => {
      ctx.setCsrf();
      return noContent();
    },
    "public",
  );

  route(
    "POST",
    "/auth/lookup",
    ({ db, body }) => {
      const role = roleOf(body);
      const acc = findAccount(db, role, normaliseContact(body.contact, role));
      return {
        exists: !!acc,
        claimed: !!acc?.claimed,
        nickname: acc?.patient?.nickname ?? null,
      };
    },
    "public",
  );

  route(
    "POST",
    "/auth/patient/sign-up",
    ({ db, body }) => {
      const contact = normaliseContact(body?.contact, "PATIENT");
      checkPassword(body.password);
      const fullName = requireText(body, "fullName", 100);
      const nickname = checkNickname(db, body.nickname);
      if (!GENDERS.includes(body.gender)) invalid("gender", "Choose one");
      const dateOfBirth = checkDob(body.dateOfBirth);
      if (findAccount(db, "PATIENT", contact)) contactInUse("contact");
      db.pendingSignUps[`PATIENT:${contact}`] = {
        role: "PATIENT",
        contact,
        password: body.password,
        patient: {
          fullName,
          nickname,
          gender: body.gender,
          dateOfBirth,
          photo: null,
          photoSkipped: false,
          campusId: null,
          programmeId: null,
          grade: null,
          onboarded: false,
        },
      };
      return accepted();
    },
    "public",
  );

  route(
    "POST",
    "/auth/provider/sign-up",
    ({ db, body }) => {
      const contact = normaliseContact(body?.email, "PROVIDER", "email");
      checkPassword(body.password);
      const title = requireText(body, "title", 30);
      const fullName = requireText(body, "fullName", 100);
      if (findAccount(db, "PROVIDER", contact)) contactInUse("email");
      db.pendingSignUps[`PROVIDER:${contact}`] = {
        role: "PROVIDER",
        contact,
        password: body.password,
        title,
        fullName,
      };
      return accepted();
    },
    "public",
  );

  route(
    "POST",
    "/auth/verify",
    (ctx) => {
      const { db, body } = ctx;
      const role = roleOf(body);
      const contact = normaliseContact(body.contact, role);
      const purpose = purposeOf(body);

      if (purpose === "SIGN_UP") {
        const key = `${role}:${contact}`;
        const pending = db.pendingSignUps[key];
        checkCode(body.code, !!pending);
        delete db.pendingSignUps[key];
        const acc = createAccount(db, pending);
        ctx.signIn(acc.id);
        return { me: me(db, acc), grant: null };
      }

      const acc = findAccount(db, role, contact);
      checkCode(
        body.code,
        !!acc && (purpose === "RECOVERY" ? acc.claimed : !acc.claimed),
      );
      const grant = newId();
      db.grants[grant] = acc.id;
      return { me: null, grant };
    },
    "public",
  );

  route(
    "POST",
    "/auth/codes",
    ({ body }) => {
      normaliseContact(body?.contact, roleOf(body));
      purposeOf(body);
      return accepted();
    },
    "public",
  );

  route(
    "POST",
    "/auth/sign-in",
    (ctx) => {
      const { db, body } = ctx;
      const role = roleOf(body);
      const acc = findAccount(db, role, normaliseContact(body.contact, role));
      if (!acc || !acc.claimed || acc.password !== body.password) {
        fail(
          401,
          "INCORRECT_PASSWORD",
          "That password isn't right. Try again or reset it.",
        );
      }
      ctx.signIn(acc.id);
      return me(db, acc);
    },
    "public",
  );

  route(
    "POST",
    "/auth/recovery",
    ({ body }) => {
      normaliseContact(body?.contact, roleOf(body));
      return accepted();
    },
    "public",
  );

  route(
    "POST",
    "/auth/claim",
    ({ db, body }) => {
      const role = roleOf(body);
      const email = normaliseContact(
        body.email,
        role === "PATIENT" ? "PROVIDER" : role,
        "email",
      );
      if (findAccount(db, role, email)?.claimed) {
        fail(
          409,
          "ALREADY_CLAIMED",
          "This account is already set up. Sign in instead.",
        );
      }
      return accepted();
    },
    "public",
  );

  route(
    "POST",
    "/auth/password",
    (ctx) => {
      const { db, body } = ctx;
      const accountId = db.grants[body?.grant];
      const acc = accountId && db.accounts.find((a) => a.id === accountId);
      if (!acc)
        fail(422, "GRANT_EXPIRED", "This link has expired. Start again.");
      checkPassword(body.password);
      acc.password = body.password;
      acc.claimed = true;
      delete db.grants[body.grant];
      ctx.signIn(acc.id);
      return me(db, acc);
    },
    "public",
  );

  route(
    "POST",
    "/auth/refresh",
    (ctx) => {
      if (!ctx.account)
        fail(401, "NOT_SIGNED_IN", "Please sign in to continue.");
      return noContent();
    },
    "public",
  );

  route(
    "POST",
    "/auth/sign-out",
    (ctx) => {
      ctx.signOut();
      return noContent();
    },
    "public",
  );

  route("GET", "/auth/me", ({ db, account }) => me(db, account), "any");

  route(
    "GET",
    "/patients/nickname-available",
    ({ db, query, account }) => {
      const nickname = String(query.nickname ?? "").trim();
      return {
        available: !!nickname && !nicknameTaken(db, nickname, account?.id),
      };
    },
    "public",
  );
}
