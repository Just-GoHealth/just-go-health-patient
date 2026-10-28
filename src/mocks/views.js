/**
 * Serializers: stored mock records → the exact JSON shapes in V2-API-CONTRACT.md
 * (record component names as keys, nulls sent as null). Plus the access rules
 * (a campus or result a provider can't see answers 404, never 403).
 */
import { initials, notFound } from "./core.js";

export const byId = (list, id) => list.find((x) => x.id === id);
export const accountOf = (db, id) => byId(db.accounts, id);
export const providerAccount = (db, providerId) =>
  db.accounts.find((a) => a.providerId === providerId);
export const curatorAccounts = (db) =>
  db.accounts.filter((a) => a.role === "CURATOR" && a.claimed);
export const campusTypeOf = (db, campus) =>
  db.campusTypes.find((t) => t.code === campus.type);
export const versionOf = (db, code) =>
  db.versions.find((v) => v.code === code) ?? notFound("that version");

// ---------- Auth ----------

export function me(db, acc) {
  if (acc.role === "PATIENT") {
    const p = acc.patient;
    return {
      accountId: acc.id,
      role: "PATIENT",
      contact: acc.contact,
      next: patientNext(p),
      profile: {
        fullName: p.fullName,
        initials: initials(p.fullName),
        nickname: p.nickname,
        onboarded: p.onboarded,
      },
    };
  }
  if (acc.role === "PROVIDER") {
    const p = byId(db.providers, acc.providerId);
    return {
      accountId: acc.id,
      role: "PROVIDER",
      contact: acc.contact,
      next: providerNext(p.status),
      profile: {
        providerId: p.id,
        title: p.title,
        fullName: p.fullName,
        initials: initials(p.fullName),
        status: p.status,
        submittedAt: p.submittedAt,
      },
    };
  }
  return {
    accountId: acc.id,
    role: "CURATOR",
    contact: acc.contact,
    next: "HOME",
    profile: {
      fullName: acc.curator.fullName,
      initials: initials(acc.curator.fullName),
    },
  };
}

// ---------- Patients ----------

export const GRADES = {
  HIGH_SCHOOL: ["SHS_1", "SHS_2", "SHS_3"],
  COLLEGE: ["YEAR_1", "YEAR_2", "YEAR_3", "YEAR_4"],
};
export const gradeLabel = (g) =>
  g.startsWith("SHS") ? `SHS ${g.slice(4)}` : `Year ${g.slice(5)}`;

export function ageOn(dob, now = new Date()) {
  const d = new Date(`${dob}T00:00:00Z`);
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age -= 1;
  return age;
}

export function patientNext(p) {
  if (p.onboarded) return "HOME";
  if (!p.photo && !p.photoSkipped) return "PHOTO";
  if (!p.campusId) return "SCHOOL_TYPE";
  if (!p.programmeId) return "PROGRAMME";
  if (!p.grade) return "GRADE";
  return "FINISH";
}

export const offeringOf = (db, campusId, programmeId) =>
  db.offerings.find(
    (o) => o.campusId === campusId && o.programmeId === programmeId,
  );

function graduationYear(db, p) {
  if (!p.grade) return null;
  const n = Number(p.grade.split("_")[1]);
  const total = p.grade.startsWith("SHS")
    ? 3
    : (offeringOf(db, p.campusId, p.programmeId)?.yearsTo ?? 4);
  return new Date().getUTCFullYear() + Math.max(0, total - n) + 1;
}

export function patientHome(db, acc) {
  const p = acc.patient;
  const campus = p.campusId ? byId(db.campuses, p.campusId) : null;
  const type = campus ? campusTypeOf(db, campus) : null;
  const programme = p.programmeId ? byId(db.programmes, p.programmeId) : null;
  const year = graduationYear(db, p);
  return {
    accountId: acc.id,
    fullName: p.fullName,
    initials: initials(p.fullName),
    nickname: p.nickname,
    handle: `@${p.nickname}`,
    age: ageOn(p.dateOfBirth),
    gender: p.gender,
    dateOfBirth: p.dateOfBirth,
    contactKind: acc.contact.includes("@") ? "EMAIL" : "PHONE",
    contact: acc.contact,
    photo: p.photo,
    photoSkipped: p.photoSkipped,
    campus: campus
      ? {
          id: campus.id,
          fullName: campus.fullName,
          type: campus.type,
          card: type.card,
        }
      : null,
    programme: programme
      ? { id: programme.id, fullName: programme.fullName }
      : null,
    grade: p.grade,
    gradeLabel: p.grade ? gradeLabel(p.grade) : null,
    graduationYear: year,
    classOf: year ? `Class of ${year}` : null,
    grades: type ? GRADES[type.card] : [],
    next: patientNext(p),
    onboarded: p.onboarded,
  };
}

// ---------- Providers ----------

export const providerNext = (status) =>
  ({
    DRAFT: "PROFILE_SETUP",
    PENDING: "PENDING",
    REJECTED: "REJECTED",
    APPROVED: "HOME",
  })[status];

export function missingFields(p) {
  const missing = [];
  if (!p.title) missing.push("title");
  if (!p.fullName) missing.push("fullName");
  if (!p.phone) missing.push("phone");
  if (!p.roleCategoryIds.length) missing.push("roleCategoryIds");
  if (!p.photo) missing.push("photo");
  return missing;
}

export const roleGroups = (db, ids) =>
  ids
    .map((id) => byId(db.roleCategories, id))
    .filter(Boolean)
    .map((c) => ({ id: c.id, name: c.name }));

export const providerName = (p) =>
  [p.title, p.fullName].filter(Boolean).join(" ");

export function providerProfile(db, p) {
  const acc = providerAccount(db, p.id);
  return {
    id: p.id,
    title: p.title,
    fullName: p.fullName,
    initials: initials(p.fullName),
    nicknames: p.nicknames,
    email: p.email,
    phone: p.phone,
    photo: p.photo,
    slogan: p.slogan,
    clinicianNotes: p.clinicianNotes,
    bio: p.bio,
    clinical: p.clinical,
    status: p.status,
    next: providerNext(p.status),
    submittedAt: p.submittedAt,
    decidedAt: p.decidedAt,
    roleGroups: roleGroups(db, p.roleCategoryIds),
    missing: missingFields(p),
    hasAccount: !!acc,
    claimed: !!acc?.claimed,
    studioCreated: p.studioCreated,
    version: p.version,
  };
}

export const providerSummary = (db, p) => ({
  id: p.id,
  title: p.title,
  fullName: p.fullName,
  initials: initials(p.fullName),
  photo: p.photo,
  status: p.status,
  clinical: p.clinical,
  roleGroups: roleGroups(db, p.roleCategoryIds),
});

export function roleCategoryView(db, c) {
  return {
    id: c.id,
    name: c.name,
    dormant: c.dormant,
    roles: c.roles
      .map((link) => {
        const role = byId(db.roles, link.roleId);
        return role
          ? {
              id: role.id,
              name: role.name,
              emoji: role.emoji,
              active: link.active,
            }
          : null;
      })
      .filter(Boolean),
    version: c.version,
  };
}

// ---------- Campuses ----------

export function campusCard(db, c) {
  return {
    id: c.id,
    fullName: c.fullName,
    nicknames: c.nicknames,
    motto: c.motto,
    type: c.type,
    card: campusTypeOf(db, c).card,
    logo: c.logo,
    lockedIn: db.accounts.filter(
      (a) => a.patient?.campusId === c.id && a.patient.onboarded,
    ).length,
  };
}

export function campusDetail(db, c) {
  const type = campusTypeOf(db, c);
  const location = byId(db.locations, c.locationId);
  return {
    id: c.id,
    fullName: c.fullName,
    nicknames: c.nicknames,
    motto: c.motto,
    type: c.type,
    typeLabel: type.label,
    card: type.card,
    location: location ? { id: location.id, name: location.name } : null,
    logo: c.logo,
    banner: c.banner,
    defaultGraduationMonth: c.defaultGraduationMonth,
    sites: c.sites,
    archived: c.archived,
    version: c.version,
  };
}

export const catalogueProgramme = (p) => ({
  id: p.id,
  fullName: p.fullName,
  nicknames: p.nicknames,
  bio: p.bio,
  cover: p.cover,
  defaultYears: p.defaultYears,
  version: p.version,
});

export function offeredProgramme(db, programme, offering, campus) {
  return {
    programmeId: programme.id,
    fullName: programme.fullName,
    nicknames: programme.nicknames.map((n) => n.name),
    bio: programme.bio,
    cover: programme.cover,
    yearsFrom: offering?.yearsFrom ?? 1,
    yearsTo: offering?.yearsTo ?? programme.defaultYears,
    graduationMonth:
      offering?.graduationMonth ?? campus?.defaultGraduationMonth ?? 7,
    graduationMonthOverride: offering?.graduationMonth ?? null,
    nicknameChoices: programme.nicknames.map((n) => ({
      id: n.id,
      label: n.name,
      on: !!offering?.nicknameIds.includes(n.id),
    })),
    tags: db.tags.map((t) => ({
      tagId: t.id,
      title: t.title,
      options: t.options.map((o) => ({
        id: o.id,
        label: o.label,
        on: !!offering?.tagOptions[t.id]?.includes(o.id),
      })),
    })),
  };
}

export function campusProviderView(db, link) {
  const p = byId(db.providers, link.providerId);
  const category = link.roleCategoryId
    ? byId(db.roleCategories, link.roleCategoryId)
    : null;
  return {
    providerId: p.id,
    title: p.title,
    fullName: p.fullName,
    initials: initials(p.fullName),
    photo: p.photo,
    roleCategoryId: link.roleCategoryId ?? null,
    roleCategory: category?.name ?? null,
    nsmqCounsellor: link.nsmqCounsellor,
    mainHost: link.mainHost,
    broughtByCampusHostId: link.broughtByCampusHostId ?? null,
    attachedAt: link.attachedAt,
  };
}

export const attachedCampusIds = (db, providerId) =>
  db.campusProviders
    .filter((l) => l.providerId === providerId)
    .map((l) => l.campusId);

// ---------- Join requests ----------

export function joinRequestView(db, r) {
  const p = byId(db.providers, r.providerId);
  const targetName =
    r.targetType === "CAMPUS"
      ? byId(db.campuses, r.targetId)?.fullName
      : byId(db.hosts, r.targetId)?.fullName;
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    createdAt: r.createdAt,
    decidedAt: r.decidedAt,
    applicant: p ? providerSummary(db, p) : null,
    target:
      r.kind === "PROVIDER_APPLICATION"
        ? null
        : { type: r.targetType, id: r.targetId, name: targetName ?? null },
  };
}

// ---------- Access ----------

/** The campus, when this staff account may see it; 404 otherwise. */
export function assertCampus(db, acc, campusId) {
  const campus = byId(db.campuses, campusId);
  if (!campus) notFound("that campus");
  if (acc.role === "CURATOR") return campus;
  const p = byId(db.providers, acc.providerId);
  if (
    p?.status !== "APPROVED" ||
    !attachedCampusIds(db, p.id).includes(campusId)
  ) {
    notFound("that campus");
  }
  return campus;
}

/** Providers only see accepted results; the curator also sees those awaiting acceptance. */
export const resultsAt = (db, acc, campusId) =>
  db.results.filter(
    (r) => r.campusId === campusId && (acc.role === "CURATOR" || r.acceptedAt),
  );

export function assertResult(db, acc, id) {
  const r = byId(db.results, id);
  if (!r) notFound("that result");
  assertCampus(db, acc, r.campusId);
  if (acc.role !== "CURATOR" && !r.acceptedAt) notFound("that result");
  return r;
}

// ---------- Results ----------

export const isOverdue = (r, now = Date.now()) =>
  !!r.respondBy && !r.treatingStartedAt && Date.parse(r.respondBy) < now;

export const resultItem = (r) => ({
  id: r.id,
  displayName: r.displayName,
  initials: initials(r.displayName),
  age: r.age,
  gender: r.gender,
  yearLabel: r.yearLabel,
  variant: r.variant,
  createdAt: r.createdAt,
  urgent: r.urgent,
  urgentReason: r.urgentReason,
  attention: r.attention,
  awaitingAcceptance: !r.acceptedAt,
  active: r.active,
  lockedIn: r.lockedIn,
  suicidality: r.suicidality,
  lastProviderView: r.lastProviderView,
  seen: r.seen,
  treatingStartedAt: r.treatingStartedAt,
  respondBy: r.respondBy,
  overdue: isOverdue(r),
});

export const resultDetail = (db, r) => ({
  campusId: r.campusId,
  campusName: byId(db.campuses, r.campusId)?.fullName ?? null,
  source: r.source,
  result: resultItem(r),
  outcomes: r.outcomes,
  care: r.care,
});

export const notificationView = (n) => ({
  id: n.id,
  campusId: n.campusId,
  type: n.type,
  title: n.title,
  body: n.body,
  link: n.link,
  data: n.data,
  readAt: n.readAt,
  createdAt: n.createdAt,
});
