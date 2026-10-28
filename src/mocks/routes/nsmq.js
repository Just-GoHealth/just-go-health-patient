/**
 * NSMQ: versions (public reads), the student's enrollments and check-in runs
 * (contract 3b), and the curator's versions, teams, access codes and fixtures.
 */
import {
  DAY,
  Reply,
  checkVersion,
  created,
  fail,
  invalid,
  iso,
  matchesQ,
  nameTaken,
  newId,
  noContent,
  notFound,
} from "../core.js";
import { byId, versionOf } from "../views.js";
import {
  INSTRUMENTS,
  answerRun,
  careForRun,
  createRun,
  dueFor,
  enrollmentView,
  expireIfClosed,
  isWorkableCode,
  latestRun,
  randomAccessCode,
  statusView,
  studentRun,
  submitRun,
  teamFor,
  teamView,
  versionView,
} from "../nsmq-engine.js";

const VERSION_STATUSES = ["OPENS_SOON", "LIVE", "CLOSED", "INVITE_ONLY"];
const TEAM_STATUSES = ["REGISTERED", "ACTIVE", "ELIMINATED", "CHAMPION"];

const fixtureView = (f) => ({
  id: f.id,
  teamId: f.teamId,
  roundName: f.roundName,
  kickoffAt: f.kickoffAt,
  timezone: f.timezone,
  venue: f.venue,
  position: f.position,
  status: f.status,
  outcome: f.outcome,
  version: f.version,
});
const codeView = (c) => ({
  id: c.id,
  code: c.code,
  seatLabel: c.seatLabel,
  batchId: c.batchId,
  status: c.status,
  expiresAt: c.expiresAt,
  redeemedAt: c.redeemedAt,
});

function enrollmentOf(db, account, code) {
  const e = db.enrollments.find(
    (x) => x.accountId === account.id && x.versionCode === code,
  );
  if (!e) notFound("your enrollment");
  return e;
}

function ownRun(db, account, id) {
  const run = db.runs.find((r) => r.id === id && r.accountId === account.id);
  if (!run) notFound("that check-in");
  return expireIfClosed(run);
}

function openRun(run) {
  if (run.status === "SUBMITTED")
    fail(409, "RUN_SUBMITTED", "This check-in is already submitted.");
  if (run.status === "EXPIRED")
    fail(422, "RUN_CLOSED", "This check-in has closed.");
  return run;
}

const teamOf = (db, id) => byId(db.teams, id) ?? notFound("that team");
const fixtureOf = (db, id) => byId(db.fixtures, id) ?? notFound("that fixture");

function checkKickoff(value, field = "kickoffAt") {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value)))
    invalid(field, "Enter a date and time");
  return new Date(value).toISOString();
}

function newFixture(db, team, row, kickoffAt) {
  const fixture = {
    id: newId(),
    teamId: team.id,
    roundName: row.roundName.trim(),
    kickoffAt,
    timezone: row.timezone ?? "Africa/Accra",
    venue: row.venue ?? null,
    position:
      row.position ??
      db.fixtures.filter((f) => f.teamId === team.id).length + 1,
    status: "SCHEDULED",
    outcome: "PENDING",
    eliminatedAt: null,
    version: 1,
  };
  db.fixtures.push(fixture);
  return fixture;
}

export function register(route) {
  // ---------- Versions ----------
  route(
    "GET",
    "/versions",
    ({ db }) => db.versions.map(versionView),
    "CURATOR",
  );

  route(
    "POST",
    "/versions",
    ({ db, body = {} }) => {
      const code = String(body.code ?? "").trim();
      if (!/^[A-Za-z0-9_-]{2,40}$/.test(code))
        invalid("code", "Use 2 to 40 letters, numbers, - or _");
      if (db.versions.some((v) => v.code.toLowerCase() === code.toLowerCase()))
        nameTaken("code");
      if (!body.label?.trim()) invalid("label", "Enter a label");
      if (!VERSION_STATUSES.includes(body.status))
        invalid("status", "Choose a status");
      const v = {
        code,
        label: body.label.trim(),
        description: body.description ?? null,
        status: body.status,
        startsAt: body.startsAt ?? null,
        endsAt: body.endsAt ?? null,
        d1Hours: body.d1Hours ?? 24,
        t3Hours: body.t3Hours ?? 3,
        assentText: body.assentText ?? null,
        assentVersion: body.assentText ? 1 : 0,
        campusTypes: body.campusTypes ?? ["SHS"],
        version: 1,
      };
      db.versions.push(v);
      return created(versionView(v));
    },
    "CURATOR",
  );

  route(
    "GET",
    "/versions/:code",
    ({ db, params }) => versionView(versionOf(db, params.code)),
    "public",
  );

  route(
    "PATCH",
    "/versions/:code",
    ({ db, params, body = {} }) => {
      const v = versionOf(db, params.code);
      checkVersion(v, body);
      if (body.status !== undefined && !VERSION_STATUSES.includes(body.status))
        invalid("status", "Choose a status");
      // Changing the wording makes students accept it again before their next run.
      if (body.assentText !== undefined && body.assentText !== v.assentText)
        v.assentVersion += 1;
      for (const key of [
        "label",
        "description",
        "status",
        "startsAt",
        "endsAt",
        "d1Hours",
        "t3Hours",
        "assentText",
        "campusTypes",
      ]) {
        if (body[key] !== undefined) v[key] = body[key];
      }
      return versionView(v);
    },
    "CURATOR",
  );

  route(
    "GET",
    "/versions/:code/campuses",
    ({ db, params, query }) => {
      const v = versionOf(db, params.code);
      return db.teams
        .filter((t) => t.versionCode === v.code)
        .map((t) => byId(db.campuses, t.campusId))
        .filter(
          (c) =>
            c && !c.archived && matchesQ([c.fullName, ...c.nicknames], query.q),
        )
        .sort((a, b) => a.fullName.localeCompare(b.fullName))
        .map((c) => ({ id: c.id, fullName: c.fullName, type: c.type }));
    },
    "public",
  );

  // ---------- The student's enrollments ----------
  route(
    "GET",
    "/me/enrollments",
    ({ db, account }) =>
      db.enrollments
        .filter((e) => e.accountId === account.id)
        .map((e) => enrollmentView(db, e)),
    "PATIENT",
  );

  route(
    "POST",
    "/me/enrollments/:code",
    ({ db, account, params }) => {
      const v = versionOf(db, params.code);
      if (v.status === "CLOSED")
        fail(422, "VERSION_CLOSED", `${v.label} has closed.`);
      let e = db.enrollments.find(
        (x) => x.accountId === account.id && x.versionCode === v.code,
      );
      if (!e) {
        e = {
          accountId: account.id,
          versionCode: v.code,
          status: "ACTIVE",
          selectedCampusId: null,
          teamId: null,
          assentVersion: 0,
        };
        db.enrollments.push(e);
      }
      // The newest enrollment is the active one; the others are suspended.
      for (const other of db.enrollments) {
        if (other.accountId === account.id)
          other.status = other === e ? "ACTIVE" : "SUSPENDED";
      }
      return enrollmentView(db, e);
    },
    "PATIENT",
  );

  route(
    "PUT",
    "/me/enrollments/:code/campus",
    ({ db, account, params, body }) => {
      const e = enrollmentOf(db, account, params.code);
      if (!body?.campusId || !teamFor(db, e.versionCode, body.campusId)) {
        fail(422, "CAMPUS_NOT_ELIGIBLE", "That school isn't taking part.");
      }
      e.selectedCampusId = body.campusId;
      return enrollmentView(db, e);
    },
    "PATIENT",
  );

  route(
    "POST",
    "/me/enrollments/:code/join",
    ({ db, account, params, body = {} }) => {
      const v = versionOf(db, params.code);
      const e = enrollmentOf(db, account, v.code);
      if (v.status !== "LIVE")
        fail(422, "VERSION_CLOSED", `${v.label} isn't open for joining.`);
      if (e.teamId) fail(409, "ALREADY_ON_TEAM", "You're already on a team.");
      const code = typeof body.code === "string" ? body.code.trim() : "";
      if (!code) invalid("code", "Enter your access code");
      if (code.length > 40) invalid("code", "Use 40 characters or fewer");
      const team = teamFor(db, v.code, body.campusId ?? e.selectedCampusId);
      if (!team)
        fail(422, "CAMPUS_NOT_ELIGIBLE", "That school isn't taking part.");
      if (!body.assent)
        fail(
          422,
          "ASSENT_REQUIRED",
          "Please read and accept the agreement first.",
        );
      const issued = db.codes.find(
        (c) =>
          c.teamId === team.id &&
          c.status === "ISSUED" &&
          c.code.toUpperCase() === code.toUpperCase(),
      );
      // Any 9 digits work, so testers never need a real code; letters fail.
      if (!issued && !isWorkableCode(code)) {
        fail(
          422,
          "CODE_INVALID",
          "That access code isn't valid for this school.",
        );
      }
      if (issued)
        Object.assign(issued, { status: "REDEEMED", redeemedAt: iso() });
      Object.assign(e, {
        teamId: team.id,
        selectedCampusId: team.campusId,
        assentVersion: v.assentVersion,
      });
      if (team.status === "REGISTERED") team.status = "ACTIVE";
      // Joining a team onboards the student at that school.
      const p = account.patient;
      if (!p.onboarded) {
        p.campusId = team.campusId;
        p.onboarded = true;
      }
      return statusView(db, e);
    },
    "PATIENT",
  );

  route(
    "POST",
    "/me/enrollments/:code/assent",
    ({ db, account, params }) => {
      const e = enrollmentOf(db, account, params.code);
      e.assentVersion = versionOf(db, e.versionCode).assentVersion;
      return statusView(db, e);
    },
    "PATIENT",
  );

  route(
    "GET",
    "/me/enrollments/:code/status",
    ({ db, account, params }) =>
      statusView(db, enrollmentOf(db, account, params.code)),
    "PATIENT",
  );

  // ---------- The student's runs ----------
  route(
    "POST",
    "/me/runs",
    ({ db, account, body = {} }) => {
      const v = versionOf(db, body.versionCode);
      const e = enrollmentOf(db, account, v.code);
      if (!e.teamId) fail(422, "NOT_ON_TEAM", "Join your school's team first.");
      if ((e.assentVersion ?? 0) < v.assentVersion)
        fail(
          422,
          "ASSENT_REQUIRED",
          "Please accept the updated agreement first.",
        );
      const due = dueFor(db, e).filter(
        (d) => !body.kind || d.kind === body.kind,
      );
      if (!due.length)
        fail(422, "NOTHING_DUE", "There's no check-in due right now.");
      const d = due[0];
      const latest = latestRun(db, account.id, d.obligationKey);
      if (latest && latest.status !== "EXPIRED") return studentRun(latest);
      const run = createRun(db, {
        accountId: account.id,
        versionCode: v.code,
        kind: d.kind,
        obligationKey: d.obligationKey,
        campusId: byId(db.teams, e.teamId).campusId,
        attempt: (latest?.attempt ?? 0) + 1,
        closesAt: d.until,
      });
      return studentRun(run);
    },
    "PATIENT",
  );

  route(
    "GET",
    "/me/runs",
    ({ db, account }) =>
      db.runs
        .filter((r) => r.accountId === account.id)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .map(studentRun),
    "PATIENT",
  );

  route(
    "GET",
    "/me/runs/:id",
    ({ db, account, params }) => studentRun(ownRun(db, account, params.id)),
    "PATIENT",
  );

  route(
    "PUT",
    "/me/runs/:id/answers/:itemCode",
    ({ db, account, params, body }) => {
      const run = openRun(ownRun(db, account, params.id));
      if (!INSTRUMENTS[run.kind].items.some((i) => i.code === params.itemCode))
        notFound("that question");
      if (!answerRun(run, params.itemCode, body?.optionId))
        invalid("optionId", "Choose an answer");
      return studentRun(run);
    },
    "PATIENT",
  );

  route(
    "POST",
    "/me/runs/:id/submit",
    ({ db, account, params }) => {
      const run = openRun(ownRun(db, account, params.id));
      const missing = INSTRUMENTS[run.kind].items.filter(
        (i) => !run.answers.some((a) => a.itemCode === i.code),
      );
      if (missing.length) {
        fail(
          422,
          "ANSWERS_MISSING",
          "Answer every question before you submit.",
          missing.map((i) => ({
            field: i.code,
            message: "Answer this question",
          })),
        );
      }
      return studentRun(submitRun(db, run));
    },
    "PATIENT",
  );

  route(
    "POST",
    "/me/runs/:id/retake",
    ({ db, account, params }) => {
      const run = ownRun(db, account, params.id);
      const window = dueFor(
        db,
        enrollmentOf(db, account, run.versionCode),
      ).find((d) => d.obligationKey === run.obligationKey);
      if (!window) fail(422, "RUN_CLOSED", "This check-in has closed.");
      const latest = latestRun(db, account.id, run.obligationKey);
      if (latest.status === "IN_PROGRESS") return studentRun(latest);
      return studentRun(
        createRun(db, {
          accountId: account.id,
          versionCode: run.versionCode,
          kind: run.kind,
          obligationKey: run.obligationKey,
          campusId: run.campusId,
          attempt: latest.attempt + 1,
          closesAt: window.until,
        }),
      );
    },
    "PATIENT",
  );

  route(
    "POST",
    "/me/runs/:id/care-ack",
    ({ db, account, params }) => {
      const run = ownRun(db, account, params.id);
      run.careAck = true;
      return studentRun(run);
    },
    "PATIENT",
  );

  route(
    "GET",
    "/me/runs/:id/care",
    ({ db, account, params }) => careForRun(db, ownRun(db, account, params.id)),
    "PATIENT",
  );

  // ---------- Curator: teams ----------
  route(
    "GET",
    "/versions/:code/teams",
    ({ db, params }) => {
      const v = versionOf(db, params.code);
      return db.teams
        .filter((t) => t.versionCode === v.code)
        .map((t) => teamView(db, t))
        .sort((a, b) => a.campusName.localeCompare(b.campusName));
    },
    "CURATOR",
  );

  route(
    "GET",
    "/versions/:code/board",
    ({ db, params }) => {
      const v = versionOf(db, params.code);
      const board = Object.fromEntries(TEAM_STATUSES.map((s) => [s, []]));
      for (const t of db.teams.filter((x) => x.versionCode === v.code))
        board[t.status].push(teamView(db, t));
      return board;
    },
    "CURATOR",
  );

  route(
    "POST",
    "/versions/:code/teams",
    ({ db, params, body }) => {
      const v = versionOf(db, params.code);
      const added = [];
      const skipped = [];
      for (const campusId of body?.campusIds ?? []) {
        const campus = byId(db.campuses, campusId);
        if (!campus) skipped.push({ campusId, reason: "UNKNOWN_CAMPUS" });
        else if (!v.campusTypes.includes(campus.type))
          skipped.push({ campusId, reason: "NOT_ELIGIBLE" });
        else if (teamFor(db, v.code, campusId))
          skipped.push({ campusId, reason: "ALREADY_TAGGED" });
        else {
          const team = {
            id: newId(),
            versionCode: v.code,
            campusId,
            status: "REGISTERED",
            coordinatorName: null,
            coordinatorContact: null,
            seatCapacity: null,
          };
          db.teams.push(team);
          added.push(teamView(db, team));
        }
      }
      return { added, skipped };
    },
    "CURATOR",
  );

  route(
    "DELETE",
    "/versions/:code/teams/:campusId",
    ({ db, params }) => {
      const team =
        teamFor(db, params.code, params.campusId) ?? notFound("that team");
      if (db.enrollments.some((e) => e.teamId === team.id)) {
        fail(
          409,
          "TEAM_HAS_MEMBERS",
          "Students have already joined this team.",
        );
      }
      db.teams = db.teams.filter((t) => t !== team);
      return noContent();
    },
    "CURATOR",
  );

  route(
    "PATCH",
    "/teams/:id",
    ({ db, params, body = {} }) => {
      const team = teamOf(db, params.id);
      if (body.status != null) {
        if (!TEAM_STATUSES.includes(body.status))
          invalid("status", "Choose a status");
        team.status = body.status;
      }
      for (const key of [
        "coordinatorName",
        "coordinatorContact",
        "seatCapacity",
      ]) {
        if (body[key] != null) team[key] = body[key];
      }
      return teamView(db, team);
    },
    "CURATOR",
  );

  // ---------- Curator: access codes ----------
  route(
    "GET",
    "/teams/:id/codes",
    ({ db, params }) => {
      const team = teamOf(db, params.id);
      return db.codes.filter((c) => c.teamId === team.id).map(codeView);
    },
    "CURATOR",
  );

  route(
    "POST",
    "/teams/:id/codes",
    ({ db, params, body = {} }) => {
      const team = teamOf(db, params.id);
      const count = Number(body.count);
      if (!Number.isInteger(count) || count < 1 || count > 200)
        invalid("count", "Mint between 1 and 200 codes");
      const used = db.codes.filter(
        (c) =>
          c.teamId === team.id &&
          (c.status === "ISSUED" || c.status === "REDEEMED"),
      ).length;
      if (team.seatCapacity && used + count > team.seatCapacity) {
        fail(
          422,
          "CAPACITY_REACHED",
          `This team has ${team.seatCapacity} seats and ${used} codes already.`,
        );
      }
      const batchId = newId();
      const minted = Array.from({ length: count }, (_, i) => ({
        id: newId(),
        teamId: team.id,
        code: randomAccessCode(),
        seatLabel: body.seatLabels?.[i] ?? null,
        batchId,
        status: "ISSUED",
        expiresAt: iso(Date.now() + 60 * DAY),
        redeemedAt: null,
      }));
      db.codes.push(...minted);
      return created(minted.map(codeView));
    },
    "CURATOR",
  );

  route(
    "GET",
    "/teams/:id/codes/export",
    ({ db, params }) => {
      const team = teamOf(db, params.id);
      const school = byId(db.campuses, team.campusId).fullName;
      const rows = db.codes
        .filter((c) => c.teamId === team.id && c.status === "ISSUED")
        .map((c) =>
          [
            c.seatLabel ?? "",
            c.code,
            c.expiresAt ?? "",
            school,
            team.versionCode,
          ]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(","),
        );
      return new Reply(
        200,
        ["seat,code,expires,school,version", ...rows].join("\n") + "\n",
        {
          "Content-Type": "text/csv; charset=utf-8",
        },
      );
    },
    "CURATOR",
  );

  route(
    "POST",
    "/codes/:id/revoke",
    ({ db, params }) => {
      const code = byId(db.codes, params.id) ?? notFound("that code");
      if (code.status !== "ISSUED")
        invalid("code", "Only an unused code can be revoked");
      code.status = "REVOKED";
      return codeView(code);
    },
    "CURATOR",
  );

  // ---------- Curator: fixtures ----------
  route(
    "GET",
    "/teams/:id/fixtures",
    ({ db, params }) => {
      const team = teamOf(db, params.id);
      return db.fixtures
        .filter((f) => f.teamId === team.id)
        .sort(
          (a, b) =>
            a.position - b.position || a.kickoffAt.localeCompare(b.kickoffAt),
        )
        .map(fixtureView);
    },
    "CURATOR",
  );

  route(
    "POST",
    "/teams/:id/fixtures",
    ({ db, params, body = {} }) => {
      const team = teamOf(db, params.id);
      if (!body.roundName?.trim()) invalid("roundName", "Enter the round");
      return created(
        fixtureView(newFixture(db, team, body, checkKickoff(body.kickoffAt))),
      );
    },
    "CURATOR",
  );

  route(
    "PATCH",
    "/fixtures/:id",
    ({ db, params, body = {} }) => {
      const f = fixtureOf(db, params.id);
      checkVersion(f, body);
      if (body.kickoffAt !== undefined)
        f.kickoffAt = checkKickoff(body.kickoffAt);
      for (const key of ["roundName", "timezone", "venue", "position"]) {
        if (body[key] !== undefined) f[key] = body[key];
      }
      return fixtureView(f);
    },
    "CURATOR",
  );

  route(
    "PUT",
    "/fixtures/:id/outcome",
    ({ db, params, body }) => {
      const f = fixtureOf(db, params.id);
      const team = teamOf(db, f.teamId);
      const outcome = body?.outcome;
      if (!["PENDING", "ADVANCED", "ELIMINATED"].includes(outcome))
        invalid("outcome", "Choose an outcome");
      f.outcome = outcome;
      f.version += 1;
      if (outcome === "PENDING") {
        f.status = "SCHEDULED";
        f.eliminatedAt = null;
        if (team.status === "ELIMINATED") team.status = "ACTIVE";
      } else {
        f.status = "COMPLETED";
        // ELIMINATED opens the T+ check-in for the team's students.
        f.eliminatedAt = outcome === "ELIMINATED" ? iso() : null;
        if (outcome === "ELIMINATED") team.status = "ELIMINATED";
      }
      return fixtureView(f);
    },
    "CURATOR",
  );

  route(
    "POST",
    "/fixtures/:id/cancel",
    ({ db, params }) => {
      const f = fixtureOf(db, params.id);
      f.status = "CANCELLED";
      f.version += 1;
      return fixtureView(f);
    },
    "CURATOR",
  );

  route(
    "DELETE",
    "/fixtures/:id",
    ({ db, params }) => {
      const f = fixtureOf(db, params.id);
      db.fixtures = db.fixtures.filter((x) => x !== f);
      return noContent();
    },
    "CURATOR",
  );

  route(
    "POST",
    "/versions/:code/fixtures/import",
    ({ db, params, body }) => {
      const v = versionOf(db, params.code);
      if (!Array.isArray(body) || !body.length)
        invalid("rows", "Add at least one row");
      // All or nothing: check every row before creating any.
      const rows = body.map((row, i) => {
        const team = teamFor(db, v.code, row.campusId);
        if (!team)
          invalid(`[${i}].campusId`, "That school has no team in this version");
        if (!row.roundName?.trim())
          invalid(`[${i}].roundName`, "Enter the round");
        return {
          team,
          row,
          kickoffAt: checkKickoff(row.kickoffAt, `[${i}].kickoffAt`),
        };
      });
      return created(
        rows.map(({ team, row, kickoffAt }) =>
          fixtureView(
            newFixture(db, team, { ...row, position: undefined }, kickoffAt),
          ),
        ),
      );
    },
    "CURATOR",
  );
}
