/** Patient profile and onboarding (contract 3a). Every /patients/me* call answers PatientHome. */
import {
  fail,
  imageFromUpload,
  invalid,
  notFound,
  requireText,
} from "../core.js";
import {
  GRADES,
  byId,
  campusTypeOf,
  patientHome,
  patientNext,
} from "../views.js";
import { GENDERS, checkDob, checkNickname } from "./auth.js";

export function register(route) {
  const home = ({ db, account }) => patientHome(db, account);

  route("GET", "/patients/me", home, "PATIENT");

  route(
    "PATCH",
    "/patients/me",
    (ctx) => {
      const { db, account, body = {} } = ctx;
      const p = account.patient;
      if (body.fullName !== undefined)
        p.fullName = requireText(body, "fullName", 100);
      if (body.nickname !== undefined)
        p.nickname = checkNickname(db, body.nickname, account.id);
      if (body.gender !== undefined) {
        if (!GENDERS.includes(body.gender)) invalid("gender", "Choose one");
        p.gender = body.gender;
      }
      if (body.dateOfBirth !== undefined)
        p.dateOfBirth = checkDob(body.dateOfBirth);
      return home(ctx);
    },
    "PATIENT",
  );

  route(
    "PUT",
    "/patients/me/photo",
    (ctx) => {
      ctx.account.patient.photo = imageFromUpload(ctx.files);
      return home(ctx);
    },
    "PATIENT",
  );

  route(
    "POST",
    "/patients/me/photo/skip",
    (ctx) => {
      ctx.account.patient.photoSkipped = true;
      return home(ctx);
    },
    "PATIENT",
  );

  route(
    "PUT",
    "/patients/me/campus",
    (ctx) => {
      const { db, account, body } = ctx;
      const p = account.patient;
      if (p.onboarded)
        fail(
          422,
          "CAMPUS_LOCKED",
          "Your school is already set. Ask your school to move you.",
        );
      const campus = byId(db.campuses, body?.campusId);
      if (!campus || campus.archived) invalid("campusId", "Choose your school");
      p.campusId = campus.id;
      p.programmeId = null;
      p.grade = null;
      return home(ctx);
    },
    "PATIENT",
  );

  route(
    "PUT",
    "/patients/me/programme",
    (ctx) => {
      const { db, account, body } = ctx;
      const p = account.patient;
      if (!p.campusId) fail(422, "STEP_NOT_READY", "Pick your school first.");
      const programme = byId(db.programmes, body?.programmeId);
      if (!programme) invalid("programmeId", "Choose your programme");
      p.programmeId = programme.id;
      return home(ctx);
    },
    "PATIENT",
  );

  route(
    "PUT",
    "/patients/me/grade",
    (ctx) => {
      const { db, account, body } = ctx;
      const p = account.patient;
      if (!p.campusId) fail(422, "STEP_NOT_READY", "Pick your school first.");
      const allowed =
        GRADES[campusTypeOf(db, byId(db.campuses, p.campusId)).card];
      if (!allowed.includes(body?.grade)) invalid("grade", "Choose your year");
      p.grade = body.grade;
      return home(ctx);
    },
    "PATIENT",
  );

  route(
    "POST",
    "/patients/me/onboarding/finish",
    (ctx) => {
      const p = ctx.account.patient;
      const next = patientNext(p);
      if (next !== "FINISH" && next !== "HOME") {
        fail(422, "ONBOARDING_INCOMPLETE", "Finish the earlier steps first.", [
          { field: "next", message: next },
        ]);
      }
      p.onboarded = true;
      return home(ctx);
    },
    "PATIENT",
  );

  // Curator: move a student to another campus (past results keep theirs).
  route(
    "PUT",
    "/patients/:accountId/campus",
    ({ db, params, body }) => {
      const acc = db.accounts.find(
        (a) => a.id === params.accountId && a.patient,
      );
      if (!acc) notFound("that student");
      const campus = byId(db.campuses, body?.campusId);
      if (!campus) invalid("campusId", "Choose a campus");
      acc.patient.campusId = campus.id;
      acc.patient.programmeId = null;
      return patientHome(db, acc);
    },
    "CURATOR",
  );
}
