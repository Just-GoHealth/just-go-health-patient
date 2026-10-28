/**
 * NSMQ check-ins: the three questionnaires, when each one is due, scoring and
 * triage, and what a submitted run creates (a campus result, a care case and
 * the alerts). The scoring is a stand-in for the real TriageEngine, simple
 * enough to steer: answer the safety question "Yes" for a 911, pick the
 * worst answers for NOW, and calm answers for ASAP.
 */
import { HOUR, initials, iso, newId, sid } from "./core.js";
import { notifyCampusProviders, notifyCurators } from "./events.js";
import { accountOf, ageOn, byId, gradeLabel, versionOf } from "./views.js";

export const BANDS = ["Perfect", "Good", "Average", "Poor", "Very Poor"];
/** The patient app's access-code boxes take exactly this many characters. */
export const ACCESS_CODE_LENGTH = 9;
/** In the mock any 9 digits join the picked school's team (letters are refused). */
export const isWorkableCode = (code) => /^\d{9}$/.test(code);
/** A random 9-digit access code, e.g. "482913057". */
export const randomAccessCode = (random = Math.random) =>
  String(Math.floor(100_000_000 + random() * 900_000_000));

// ---------- Questionnaires ----------

function item(
  inst,
  sectionCode,
  code,
  name,
  prompt,
  helpText,
  options,
  cssrs = false,
) {
  return {
    id: sid(`item:${inst}:${code}`),
    code,
    name,
    sectionCode,
    prompt,
    helpText,
    position: 0,
    reversed: false,
    cssrs,
    options: options.map(
      (
        [emoji, label, description, safetyEffect = "NONE", score = null],
        i,
      ) => ({
        id: sid(`opt:${inst}:${code}:${i}`),
        label,
        description,
        emoji,
        score: score ?? i,
        position: i,
        safetyEffect,
      }),
    ),
  };
}

const safety = (inst, sectionCode, timeframe) =>
  item(
    inst,
    sectionCode,
    "SAFETY",
    "Safety",
    `${timeframe}, have you had thoughts of hurting yourself?`,
    "Your answer only goes to your school's counsellor, so they can support you.",
    [
      ["🙂", "No", "I haven't had thoughts like that.", "NONE", 0],
      ["💬", "Yes", "I've had thoughts like that.", "EMERGENCY", 0],
    ],
    true,
  );

function instrument(code, title, sections, items) {
  items.forEach((it, i) => (it.position = i));
  return {
    id: sid(`instrument:${code}`),
    code,
    revision: 1,
    title,
    sections: sections.map(
      ([sectionCode, sectionTitle, timeLabel], position) => ({
        code: sectionCode,
        parentCode: null,
        title: sectionTitle,
        timeLabel,
        position,
        maxScore: items
          .filter((it) => it.sectionCode === sectionCode && !it.cssrs)
          .reduce(
            (t, it) => t + Math.max(...it.options.map((o) => o.score)),
            0,
          ),
      }),
    ),
    items,
  };
}

export const INSTRUMENTS = {
  D1: instrument(
    "NSMQ_D1",
    "D-1 · one day before the contest",
    [
      ["GMH", "General Mental Health", "Past two weeks"],
      ["ENERGY", "Energy & Recovery", "Right now"],
      ["MINDSET", "Mindset & Pressure", "Going into the contest"],
    ],
    [
      item(
        "D1",
        "GMH",
        "MOOD",
        "Mood",
        "Over the past two weeks, how has your mood been?",
        "Think about most days, not just today.",
        [
          ["😄", "Great", "I've felt good most days."],
          ["🙂", "Okay", "Some ups and downs."],
          ["😟", "Low", "I've felt down a lot."],
          [
            "😢",
            "Very low",
            "I've felt down almost every day.",
            "GMH_VERY_POOR",
          ],
        ],
      ),
      item(
        "D1",
        "GMH",
        "NERVES",
        "Nerves",
        "How often have you felt nervous or on edge?",
        "Over the past two weeks.",
        [
          ["😌", "Rarely", "I've mostly felt calm."],
          ["😐", "Sometimes", "A few days here and there."],
          ["😟", "Often", "More days than not."],
          ["😰", "Nearly every day", "It's hard to switch off."],
        ],
      ),
      safety("D1", "GMH", "In the past two weeks"),
      item(
        "D1",
        "ENERGY",
        "BURNOUT",
        "Burnout",
        "How mentally exhausted do you feel from preparing for NSMQ?",
        "How tired your mind feels after all the studying, not whether you slept enough last night.",
        [
          ["🙂", "Not exhausted at all", "I still feel mentally fresh."],
          ["😐", "A little exhausted", "I feel a bit worn down some days."],
          ["😩", "Very exhausted", "Most days I feel drained from prepping."],
          ["😵", "Extremely exhausted", "I feel completely burned out."],
        ],
      ),
      item(
        "D1",
        "ENERGY",
        "NEED_FOR_REST",
        "Need for Rest",
        "How much do you feel you need a proper break right now?",
        "Not a nap: a real day or two off from quiz prep.",
        [
          ["🙂", "Not really", "I feel fine continuing as is."],
          ["😐", "A little", "A short break would help."],
          ["😩", "A lot", "I really need to slow down soon."],
          ["😵", "Desperately", "I can't keep going like this."],
        ],
      ),
      item(
        "D1",
        "MINDSET",
        "PERFORMANCE_WORRY",
        "Performance Worry",
        "How much do you worry about how you'll perform in the contest?",
        "Think about the thoughts that show up when you imagine being on stage.",
        [
          ["😌", "Barely at all", "I feel calm about it."],
          ["😐", "Some worry", "It crosses my mind sometimes."],
          ["😟", "A lot of worry", "I think about it often."],
          ["😰", "Constant worry", "It's hard to think about anything else."],
        ],
      ),
      item(
        "D1",
        "MINDSET",
        "CONFIDENCE",
        "Confidence",
        "How confident do you feel about your team's chances?",
        "Your gut read on how prepared your team is right now.",
        [
          ["😄", "Very confident", "I feel great about our chances."],
          ["🙂", "Fairly confident", "I feel mostly good about it."],
          ["😟", "Not very confident", "I have real doubts."],
          ["😣", "Not confident at all", "I don't feel prepared."],
        ],
      ),
    ],
  ),
  T3: instrument(
    "NSMQ_T3",
    "T-3 · the last three hours before kickoff",
    [
      ["MINDSET", "Mindset & Pressure", "Right now"],
      ["BODY", "Body & Energy", "Right now"],
    ],
    [
      item(
        "T3",
        "MINDSET",
        "STAGE_NERVES",
        "Stage Nerves",
        "How nervous do you feel about going on stage?",
        "Right now, a few hours before kickoff.",
        [
          ["😌", "Calm", "Ready to go."],
          ["😐", "A bit nervous", "Normal butterflies."],
          ["😟", "Very nervous", "It's distracting me."],
          ["😰", "Overwhelmed", "I can't settle at all."],
        ],
      ),
      item(
        "T3",
        "MINDSET",
        "FOCUS",
        "Focus",
        "How easy is it to focus right now?",
        "On revision or on the contest ahead.",
        [
          ["🎯", "Easy", "My head is clear."],
          ["🙂", "Mostly easy", "A few stray thoughts."],
          ["😕", "Hard", "My mind keeps wandering."],
          ["🌀", "Very hard", "I can't focus at all."],
        ],
      ),
      safety("T3", "MINDSET", "Since yesterday"),
      item(
        "T3",
        "BODY",
        "SLEEP_LAST_NIGHT",
        "Sleep",
        "How well did you sleep last night?",
        "",
        [
          ["😴", "Very well", "I woke up rested."],
          ["🙂", "Okay", "Good enough."],
          ["🥱", "Badly", "I kept waking up."],
          ["😵", "Hardly at all", "I barely slept."],
        ],
      ),
      item(
        "T3",
        "BODY",
        "BODY_TENSION",
        "Body Tension",
        "How tense does your body feel?",
        "Shoulders, stomach, hands.",
        [
          ["🧘", "Relaxed", "No tension."],
          ["😐", "A little tense", "Nothing major."],
          ["😣", "Tense", "I can feel it a lot."],
          ["🥵", "Very tense", "My body feels on alarm."],
        ],
      ),
    ],
  ),
  TPLUS: instrument(
    "NSMQ_TPLUS",
    "T+ · after the contest",
    [["RECOVERY", "After the Contest", "Since the contest"]],
    [
      item(
        "TPLUS",
        "RECOVERY",
        "DISAPPOINTMENT",
        "Disappointment",
        "How are you feeling about how the contest went?",
        "Whatever the result, your feelings are valid.",
        [
          ["😊", "At peace", "I'm okay with how it went."],
          ["😐", "A bit down", "It stings a little."],
          ["😞", "Very down", "It's weighing on me."],
          ["😭", "Crushed", "I can't stop thinking about it."],
        ],
      ),
      item(
        "TPLUS",
        "RECOVERY",
        "SUPPORT",
        "Support",
        "Do you have someone to talk to about it?",
        "",
        [
          ["🤝", "Yes, plenty", "Friends, family, teachers."],
          ["🙂", "One or two people", "Enough for now."],
          ["😕", "Not really", "I'm mostly on my own."],
          ["😶", "No one", "I don't feel I can talk to anyone."],
        ],
      ),
      item(
        "TPLUS",
        "RECOVERY",
        "SLEEP_AFTER",
        "Sleep",
        "How have you been sleeping since the contest?",
        "",
        [
          ["😴", "Well", "Normal sleep."],
          ["🙂", "Mostly fine", "A night or two off."],
          ["🥱", "Poorly", "Most nights are hard."],
          ["😵", "Very poorly", "I'm barely sleeping."],
        ],
      ),
      safety("TPLUS", "RECOVERY", "Since the contest"),
    ],
  ),
};

// ---------- Teams and windows ----------

export const teamFor = (db, versionCode, campusId) =>
  db.teams.find(
    (t) => t.versionCode === versionCode && t.campusId === campusId,
  );

export function nextKickoff(db, teamId, now = Date.now()) {
  const next = db.fixtures
    .filter(
      (f) =>
        f.teamId === teamId &&
        f.status === "SCHEDULED" &&
        Date.parse(f.kickoffAt) > now,
    )
    .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))[0];
  return next?.kickoffAt ?? null;
}

export function expireIfClosed(run, now = Date.now()) {
  if (
    run.status === "IN_PROGRESS" &&
    run.closesAt &&
    Date.parse(run.closesAt) <= now
  ) {
    run.status = "EXPIRED";
  }
  return run;
}

export function latestRun(db, accountId, obligationKey) {
  return db.runs
    .filter(
      (r) => r.accountId === accountId && r.obligationKey === obligationKey,
    )
    .map((r) => expireIfClosed(r))
    .sort((a, b) => b.attempt - a.attempt)[0];
}

/** The check-ins open now for this enrollment (D-1, T-3 before a fixture; T+ after elimination). */
export function dueFor(db, enrollment, now = Date.now()) {
  const team = enrollment.teamId ? byId(db.teams, enrollment.teamId) : null;
  if (!team) return [];
  const version = versionOf(db, enrollment.versionCode);
  const due = [];
  for (const f of db.fixtures.filter((x) => x.teamId === team.id)) {
    const kickoff = Date.parse(f.kickoffAt);
    if (f.status === "SCHEDULED") {
      const d1From = kickoff - version.d1Hours * HOUR;
      const t3From = kickoff - version.t3Hours * HOUR;
      if (now >= d1From && now < t3From)
        due.push({ kind: "D1", f, from: d1From, until: t3From });
      else if (now >= t3From && now < kickoff)
        due.push({ kind: "T3", f, from: t3From, until: kickoff });
    } else if (f.outcome === "ELIMINATED" && f.eliminatedAt) {
      const from = Date.parse(f.eliminatedAt);
      const until = from + 48 * HOUR;
      if (now >= from && now < until)
        due.push({ kind: "TPLUS", f, from, until });
    }
  }
  return due.map(({ kind, f, from, until }) => {
    const obligationKey = `${kind}:FIXTURE:${f.id}`;
    const run = latestRun(db, enrollment.accountId, obligationKey);
    return {
      kind,
      obligationKey,
      from: iso(from),
      until: iso(until),
      runId: run?.id ?? null,
      runStatus: run?.status ?? null,
    };
  });
}

/**
 * Mock panel control: moves every live NSMQ 2026 team's fixture so that
 * one check-in is due now ("D1", "T3", "TPLUS") or none is ("NONE").
 */
export function setDue(db, kind, now = Date.now()) {
  db.dueMode = kind;
  for (const team of db.teams.filter(
    (t) => t.versionCode === "nsmq2026" && t.status !== "CHAMPION",
  )) {
    let f = db.fixtures.find((x) => x.teamId === team.id && x.position === 1);
    if (!f) {
      f = {
        id: newId(),
        teamId: team.id,
        roundName: "One-eighth stage",
        timezone: "Africa/Accra",
        venue: "Accra International Conference Centre",
        position: 1,
        version: 1,
      };
      db.fixtures.push(f);
    }
    if (kind === "TPLUS") {
      Object.assign(f, {
        kickoffAt: iso(now - 2 * HOUR),
        status: "COMPLETED",
        outcome: "ELIMINATED",
        eliminatedAt: iso(now - 5 * 60_000),
      });
      team.status = "ELIMINATED";
    } else {
      const hoursAhead = { D1: 20, T3: 2, NONE: 5 * 24 }[kind];
      Object.assign(f, {
        kickoffAt: iso(now + hoursAhead * HOUR),
        status: "SCHEDULED",
        outcome: "PENDING",
        eliminatedAt: null,
      });
      team.status = db.enrollments.some((e) => e.teamId === team.id)
        ? "ACTIVE"
        : "REGISTERED";
    }
    f.version += 1;
  }
}

export const versionView = (v) => ({
  code: v.code,
  label: v.label,
  description: v.description,
  status: v.status,
  joinable: v.status === "LIVE",
  startsAt: v.startsAt,
  endsAt: v.endsAt,
  d1Hours: v.d1Hours,
  t3Hours: v.t3Hours,
  assentText: v.assentText,
  assentVersion: v.assentVersion,
  campusTypes: v.campusTypes,
  version: v.version,
});

export function enrollmentView(db, e) {
  const v = versionOf(db, e.versionCode);
  return {
    versionCode: v.code,
    versionLabel: v.label,
    status: e.status,
    selectedCampusId: e.selectedCampusId,
    teamId: e.teamId,
    joinable: v.status === "LIVE",
  };
}

export function statusView(db, e) {
  const v = versionOf(db, e.versionCode);
  const team = e.teamId ? byId(db.teams, e.teamId) : null;
  const campus = team ? byId(db.campuses, team.campusId) : null;
  return {
    versionCode: v.code,
    versionLabel: v.label,
    open: v.status === "LIVE",
    teamId: team?.id ?? null,
    campusId: campus?.id ?? null,
    campusName: campus?.fullName ?? null,
    teamStatus: team?.status ?? null,
    assentNeeded: !!team && (e.assentVersion ?? 0) < v.assentVersion,
    assentText: v.assentText,
    assentVersion: v.assentVersion,
    nextKickoff: team ? nextKickoff(db, team.id) : null,
    due: dueFor(db, e),
  };
}

export function teamView(db, t) {
  return {
    id: t.id,
    campusId: t.campusId,
    campusName: byId(db.campuses, t.campusId)?.fullName ?? "Campus",
    status: t.status,
    coordinatorName: t.coordinatorName,
    coordinatorContact: t.coordinatorContact,
    seatCapacity: t.seatCapacity,
    members: db.enrollments.filter((e) => e.teamId === t.id).length,
    nextKickoff: nextKickoff(db, t.id),
  };
}

// ---------- Runs ----------

export function createRun(
  db,
  {
    accountId,
    versionCode,
    kind,
    obligationKey,
    campusId,
    attempt,
    closesAt,
    at = Date.now(),
  },
) {
  const run = {
    id: newId(),
    accountId,
    versionCode,
    kind,
    obligationKey,
    attempt,
    status: "IN_PROGRESS",
    startedAt: iso(at),
    submittedAt: null,
    closesAt,
    campusId,
    answers: [],
    sections: [],
    tag: null,
    tagReason: null,
    load: null,
    loadMax: null,
    peak: null,
    cross: null,
    respondBy: null,
    resultId: null,
    careAck: false,
  };
  db.runs.push(run);
  return run;
}

export function answerRun(run, itemCode, optionId) {
  const items = INSTRUMENTS[run.kind].items;
  const it = items.find((x) => x.code === itemCode);
  const option = it?.options.find((o) => o.id === optionId);
  if (!it || !option) return null;
  run.answers = run.answers
    .filter((a) => a.itemCode !== itemCode)
    .concat({
      itemCode,
      optionId,
      optionLabel: option.label,
      score: option.score,
      safetyEffect: option.safetyEffect,
    })
    .sort(
      (a, b) =>
        items.findIndex((x) => x.code === a.itemCode) -
        items.findIndex((x) => x.code === b.itemCode),
    );
  return option;
}

const publicAnswers = (run) =>
  run.answers.map(({ itemCode, optionId, optionLabel }) => ({
    itemCode,
    optionId,
    optionLabel,
  }));

export function carePrompt(tag) {
  if (tag === "911") {
    return {
      urgency: "NOW",
      message:
        "Please talk to someone right now. Your school's counsellor will reach out very soon. If you feel unsafe, tell an adult near you straight away.",
    };
  }
  if (tag === "NOW") {
    return {
      urgency: "SOON",
      message:
        "Let's get you some support. A counsellor will check in with you before your next contest.",
    };
  }
  return {
    urgency: "ROUTINE",
    message:
      "Thanks for checking in. If you'd like to talk, support is here this week.",
  };
}

/** What a student sees: never the tag. The questionnaire only while IN_PROGRESS. */
export function studentRun(run) {
  expireIfClosed(run);
  const submitted = run.status === "SUBMITTED";
  return {
    id: run.id,
    versionCode: run.versionCode,
    kind: run.kind,
    attempt: run.attempt,
    status: run.status,
    startedAt: run.startedAt,
    submittedAt: run.submittedAt,
    closesAt: run.closesAt,
    questionnaire: run.status === "IN_PROGRESS" ? INSTRUMENTS[run.kind] : null,
    answers: publicAnswers(run),
    sections: submitted ? run.sections : [],
    care: submitted ? carePrompt(run.tag) : null,
    careAcknowledged: run.careAck,
  };
}

export function staffRun(db, run) {
  expireIfClosed(run);
  return {
    id: run.id,
    accountId: run.accountId,
    studentName: accountOf(db, run.accountId)?.patient?.fullName ?? null,
    campusId: run.campusId,
    kind: run.kind,
    attempt: run.attempt,
    status: run.status,
    tag: run.tag,
    tagReason: run.tagReason,
    load: run.load,
    loadMax: run.loadMax,
    peak: run.peak,
    cross: run.cross,
    engineRevision: run.status === "SUBMITTED" ? "mock-1" : null,
    historical: false,
    untagged: false,
    submittedAt: run.submittedAt,
    respondBy: run.respondBy,
    sections: run.sections,
    answers: publicAnswers(run),
    resultId: run.resultId,
  };
}

function scoreRun(db, run) {
  const inst = INSTRUMENTS[run.kind];
  const sections = inst.sections.map((s) => {
    const answers = inst.items
      .filter((it) => it.sectionCode === s.code && !it.cssrs)
      .map((it) => run.answers.find((a) => a.itemCode === it.code));
    const score = answers.reduce((t, a) => t + (a?.score ?? 0), 0);
    const ratio = s.maxScore ? score / s.maxScore : 0;
    let level =
      ratio <= 0.15
        ? 0
        : ratio <= 0.35
          ? 1
          : ratio <= 0.6
            ? 2
            : ratio <= 0.85
              ? 3
              : 4;
    if (answers.some((a) => a?.safetyEffect === "GMH_VERY_POOR")) level = 4;
    return {
      code: s.code,
      title: s.title,
      score,
      maxScore: s.maxScore,
      level,
      band: BANDS[level],
      carried: false,
    };
  });

  // T-3 carries General Mental Health from the student's latest D-1 for the same fixture.
  let carriedEmergency = false;
  if (run.kind === "T3") {
    const fixtureId = run.obligationKey.split(":FIXTURE:")[1];
    const d1 = db.runs
      .filter(
        (r) =>
          r.accountId === run.accountId &&
          r.obligationKey === `D1:FIXTURE:${fixtureId}` &&
          r.status === "SUBMITTED",
      )
      .sort((a, b) => b.attempt - a.attempt)[0];
    const gmh = d1?.sections.find((s) => s.code === "GMH");
    if (gmh) {
      sections.unshift({ ...gmh, carried: true });
      carriedEmergency = d1.answers.some((a) => a.safetyEffect === "EMERGENCY");
    }
  }

  const emergency =
    carriedEmergency || run.answers.some((a) => a.safetyEffect === "EMERGENCY");
  const peak = Math.max(...sections.map((s) => s.level));
  const worst = sections.reduce(
    (w, s) => (s.level > w.level ? s : w),
    sections[0],
  );
  const tag = emergency ? "911" : peak >= 3 ? "NOW" : "ASAP";
  const reason = emergency
    ? "Safety answer: thoughts of self-harm"
    : peak >= 3
      ? `${worst.title}: ${worst.band}`
      : "No section worse than Average";
  const own = sections.filter((s) => !s.carried);
  const mind = sections.some(
    (s) => ["GMH", "MINDSET", "RECOVERY"].includes(s.code) && s.level >= 3,
  );
  const body = sections.some(
    (s) => ["ENERGY", "BODY"].includes(s.code) && s.level >= 3,
  );
  return {
    sections,
    tag,
    reason,
    load: own.reduce((t, s) => t + s.score, 0),
    loadMax: own.reduce((t, s) => t + s.maxScore, 0),
    peak,
    cross: mind && body ? "FULL" : mind ? "MIND" : body ? "BODY" : "NONE",
  };
}

const RESPOND_HOURS = { 911: 1, NOW: 24, ASAP: 72 };

/**
 * Scores the run and records what follows: the campus result (a 911 is
 * accepted at once; anything else waits for the curator, as on the real
 * backend), the care case, and the URGENT_RESULT / NOW_RESULT alerts.
 */
export function submitRun(db, run, at = Date.now()) {
  const outcome = scoreRun(db, run);
  const respondBy = at + RESPOND_HOURS[outcome.tag] * HOUR;
  const acc = accountOf(db, run.accountId);
  const p = acc.patient;
  const campus = byId(db.campuses, run.campusId);

  // A retake replaces the earlier result for the same check-in.
  for (const prev of db.runs) {
    if (
      prev !== run &&
      prev.accountId === run.accountId &&
      prev.obligationKey === run.obligationKey &&
      prev.resultId
    ) {
      const old = byId(db.results, prev.resultId);
      if (old) old.active = false;
    }
  }

  const urgent = outcome.tag === "911";
  const safetyAnswer = run.answers.find((a) => a.itemCode === "SAFETY");
  const result = {
    id: newId(),
    source: "TRIAGE_RUN",
    sourceId: run.id,
    campusId: run.campusId,
    patientAccountId: acc.id,
    displayName: p.fullName,
    age: ageOn(p.dateOfBirth),
    gender: p.gender,
    yearLabel: p.grade ? gradeLabel(p.grade) : null,
    variant: run.kind,
    createdAt: iso(at),
    urgent,
    urgentReason: urgent ? `911: ${outcome.reason}` : null,
    attention: urgent || outcome.tag === "NOW",
    acceptedAt: urgent ? iso(at) : null,
    active: true,
    lockedIn: null,
    suicidality: safetyAnswer ? safetyAnswer.optionLabel : null,
    lastProviderView: null,
    seen: false,
    treatingStartedAt: null,
    respondBy: iso(respondBy),
    outcomes: [
      {
        sectionCode: "TAG",
        sectionTitle: "Triage",
        parentCode: null,
        score: outcome.load,
        maxScore: outcome.loadMax,
        band: outcome.tag,
        colour: null,
      },
      ...outcome.sections.map((s) => ({
        sectionCode: s.code,
        sectionTitle: s.title,
        parentCode: null,
        score: s.score,
        maxScore: s.maxScore,
        band: s.band,
        colour: null,
      })),
    ],
    care: [],
    comments: [],
  };
  db.results.push(result);

  Object.assign(run, {
    status: "SUBMITTED",
    submittedAt: iso(at),
    sections: outcome.sections,
    tag: outcome.tag,
    tagReason: outcome.reason,
    load: outcome.load,
    loadMax: outcome.loadMax,
    peak: outcome.peak,
    cross: outcome.cross,
    respondBy: iso(respondBy),
    resultId: result.id,
  });

  updateCareCase(db, run, at);

  const where = campus?.fullName ?? "a campus";
  if (urgent) {
    notifyCampusProviders(db, run.campusId, {
      type: "URGENT_RESULT",
      title: `Urgent result at ${where}`,
      body: `${p.fullName} needs a response within the hour.`,
      link: `/results/${result.id}`,
      data: { resultId: result.id, campusId: run.campusId },
      at: iso(at),
    });
  }
  if (outcome.tag === "NOW") {
    notifyCurators(db, {
      campusId: run.campusId,
      type: "NOW_RESULT",
      title: `NOW result at ${where}`,
      body: `A NOW result at ${where} is waiting for acceptance.`,
      link: `/results/${result.id}`,
      data: { resultId: result.id, campusId: run.campusId },
      at: iso(at),
    });
  }
  return run;
}

/** One case per student per version. A standing 911 never drops on its own. */
function updateCareCase(db, run, at) {
  let c = db.careCases.find(
    (x) => x.accountId === run.accountId && x.versionCode === run.versionCode,
  );
  const standing911 = c && c.effectiveTag === "911" && !c.clearedAt;
  if (standing911 && run.tag !== "911") return;
  if (!c) {
    c = {
      id: newId(),
      accountId: run.accountId,
      versionCode: run.versionCode,
      clearances: [],
    };
    db.careCases.push(c);
  }
  Object.assign(c, {
    campusId: run.campusId,
    effectiveTag: run.tag,
    sourceRunId: run.id,
    tagReason: run.tagReason,
    submittedAt: run.submittedAt,
    respondBy: run.respondBy,
    clearedAt: null,
    updatedAt: iso(at),
  });
}

export function careCaseView(db, c) {
  const name = accountOf(db, c.accountId)?.patient?.fullName ?? null;
  return {
    id: c.id,
    accountId: c.accountId,
    studentName: name,
    initials: initials(name ?? "Student"),
    campusId: c.campusId,
    effectiveTag: c.effectiveTag,
    sourceRunId: c.sourceRunId,
    tagReason: c.tagReason,
    submittedAt: c.submittedAt,
    respondBy: c.respondBy,
    clearedAt: c.clearedAt,
    updatedAt: c.updatedAt,
  };
}

// ---------- Care (the Waiting Room) ----------

export function outcomeCare(db, o) {
  return {
    outcomeId: o.id,
    sectionCode: o.sectionCode,
    sectionTitle: o.sectionTitle,
    band: o.band,
    label: o.label,
    treatments: [...o.treatments]
      .sort((a, b) => a.rank - b.rank)
      .map((link) => {
        const t = byId(db.treatments, link.treatmentId);
        return t
          ? { id: t.id, name: t.name, rank: link.rank, photo: t.photo }
          : null;
      })
      .filter(Boolean),
  };
}

/** Never 404s: empty lists when nothing is linked. */
export function careForRun(db, run) {
  if (run.status !== "SUBMITTED") return { first: [], outcomes: [] };
  const outcomes = run.sections
    .flatMap((s) =>
      db.careOutcomes.filter(
        (o) =>
          o.app === "ACCOUNT" && o.sectionCode === s.code && o.band === s.band,
      ),
    )
    .map((o) => outcomeCare(db, o))
    .filter((o) => o.treatments.length);
  const seen = new Set();
  const first = [];
  for (const o of outcomes) {
    const top = o.treatments[0];
    if (top && !seen.has(top.id)) {
      seen.add(top.id);
      first.push(top);
    }
  }
  return { first, outcomes };
}
