/**
 * The catalogue: campus types, campuses (public list, curator Studios and the
 * Campus hub), programmes, tags, locations, role groups and roles, the care
 * catalogue and the audit log.
 */
import {
  checkVersion,
  created,
  ensureUnique,
  fail,
  imageFromUpload,
  invalid,
  matchesQ,
  newId,
  noContent,
  notFound,
  optionalText,
  pageOf,
  requireText,
} from "../core.js";
import { notifyProvider } from "../events.js";
import { outcomeCare } from "../nsmq-engine.js";
import {
  byId,
  campusCard,
  campusDetail,
  campusProviderView,
  campusTypeOf,
  catalogueProgramme,
  offeredProgramme,
  offeringOf,
  roleCategoryView,
} from "../views.js";

const campusOf = (db, id) => byId(db.campuses, id) ?? notFound("that campus");
const programmeOf = (db, id) =>
  byId(db.programmes, id) ?? notFound("that programme");
const campusNames = (c) => [c.fullName, ...c.nicknames];
const programmeNames = (p) => [p.fullName, ...p.nicknames.map((n) => n.name)];

function checkMonth(value, field = "defaultGraduationMonth") {
  if (value == null || value === 0) return null;
  if (!Number.isInteger(value) || value < 1 || value > 12)
    invalid(field, "Choose a month");
  return value;
}

function applySetup(db, offering, setup = {}) {
  if (setup.yearsFrom != null) offering.yearsFrom = setup.yearsFrom;
  if (setup.yearsTo != null) offering.yearsTo = setup.yearsTo;
  if (setup.graduationMonth !== undefined)
    offering.graduationMonth = checkMonth(
      setup.graduationMonth,
      "graduationMonth",
    );
  if (setup.nicknameIds != null) offering.nicknameIds = setup.nicknameIds;
  if (setup.tags != null) {
    for (const t of setup.tags) {
      if (!byId(db.tags, t.tagId)) invalid("tags", "Unknown tag");
      offering.tagOptions[t.tagId] = t.optionIds ?? [];
    }
  }
}

/** Care outcome → how many students reached it (ACCOUNT = NSMQ runs, QUICK_SCREEN = Quick Screen). */
function careAction(db, o) {
  const source = o.app === "ACCOUNT" ? "TRIAGE_RUN" : "QUICK_SCREEN";
  const students = new Set(
    db.results
      .filter(
        (r) =>
          r.source === source &&
          r.outcomes.some(
            (x) => x.sectionCode === o.sectionCode && x.band === o.band,
          ),
      )
      .map((r) => r.patientAccountId),
  ).size;
  return {
    id: o.id,
    app: o.app,
    sectionCode: o.sectionCode,
    sectionTitle: o.sectionTitle,
    band: o.band,
    label: o.label,
    students,
    treatments: outcomeCare(db, o).treatments,
  };
}

const treatmentView = (t) => ({
  id: t.id,
  name: t.name,
  defaultRank: t.defaultRank,
  photo: t.photo,
  version: t.version,
});

export function register(route) {
  // ---------- Campus types and the public campus list ----------
  route("GET", "/campus-types", ({ db }) => db.campusTypes, "public");

  route(
    "GET",
    "/campuses",
    ({ db, query }) => {
      const archived = query.archived === "true";
      const list = db.campuses
        .filter((c) => c.archived === archived)
        .filter((c) => !query.type || c.type === query.type)
        .filter((c) => !query.card || campusTypeOf(db, c).card === query.card)
        .filter((c) => matchesQ(campusNames(c), query.q))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
      return pageOf(list, query, (c) => campusCard(db, c));
    },
    "public",
  );

  route(
    "GET",
    "/campuses/:id/programmes",
    ({ db, params, query }) => {
      const campus = campusOf(db, params.id);
      const offered = db.offerings.filter((o) => o.campusId === campus.id);
      const fromCatalogue = offered.length === 0;
      const items = (
        fromCatalogue
          ? db.programmes
          : offered.map((o) => byId(db.programmes, o.programmeId))
      )
        .filter((p) => p && matchesQ(programmeNames(p), query.q))
        .sort((a, b) => a.fullName.localeCompare(b.fullName))
        .map((p) =>
          offeredProgramme(db, p, offeringOf(db, campus.id, p.id), campus),
        );
      return { fromCatalogue, items };
    },
    "public",
  );

  // ---------- Curator: campuses ----------
  route(
    "GET",
    "/campuses/:id",
    ({ db, params }) => campusDetail(db, campusOf(db, params.id)),
    "any",
  );

  route(
    "POST",
    "/campuses",
    ({ db, body = {} }) => {
      const fullName = requireText(body, "fullName", 100);
      const nicknames = (body.nicknames ?? [])
        .map((n) => String(n).trim())
        .filter(Boolean);
      ensureUnique(db.campuses, [fullName], campusNames, "fullName");
      ensureUnique(db.campuses, nicknames, campusNames, "nicknames");
      if (!db.campusTypes.some((t) => t.code === body.type))
        invalid("type", "Choose a campus type");
      if (!byId(db.locations, body.locationId))
        invalid("locationId", "Choose a location");
      const campus = {
        id: newId(),
        fullName,
        nicknames,
        motto: body.motto?.trim() || null,
        type: body.type,
        locationId: body.locationId,
        logo: null,
        banner: null,
        defaultGraduationMonth: checkMonth(body.defaultGraduationMonth),
        sites: [],
        archived: false,
        version: 1,
      };
      db.campuses.push(campus);
      return created(campusDetail(db, campus));
    },
    "CURATOR",
  );

  route(
    "PATCH",
    "/campuses/:id",
    ({ db, params, body = {} }) => {
      const campus = campusOf(db, params.id);
      checkVersion(campus, body);
      if (body.fullName !== undefined) {
        const fullName = requireText(body, "fullName", 100);
        ensureUnique(db.campuses, [fullName], campusNames, "fullName", campus);
        campus.fullName = fullName;
      }
      if (body.nicknames !== undefined) {
        const nicknames = body.nicknames
          .map((n) => String(n).trim())
          .filter(Boolean);
        ensureUnique(db.campuses, nicknames, campusNames, "nicknames", campus);
        campus.nicknames = nicknames;
      }
      const motto = optionalText(body, "motto", 200);
      if (motto !== undefined) campus.motto = motto;
      if (body.type !== undefined) {
        if (!db.campusTypes.some((t) => t.code === body.type))
          invalid("type", "Choose a campus type");
        campus.type = body.type;
      }
      if (body.locationId !== undefined) {
        if (!byId(db.locations, body.locationId))
          invalid("locationId", "Choose a location");
        campus.locationId = body.locationId;
      }
      if (body.defaultGraduationMonth !== undefined)
        campus.defaultGraduationMonth = checkMonth(body.defaultGraduationMonth);
      return campusDetail(db, campus);
    },
    "CURATOR",
  );

  for (const [action, archived] of [
    ["archive", true],
    ["restore", false],
  ]) {
    route(
      "POST",
      `/campuses/:id/${action}`,
      ({ db, params }) => {
        const campus = campusOf(db, params.id);
        campus.archived = archived;
        campus.version += 1;
        return campusDetail(db, campus);
      },
      "CURATOR",
    );
  }

  route(
    "PUT",
    "/campuses/:id/sites",
    ({ db, params, body }) => {
      const campus = campusOf(db, params.id);
      if (!Array.isArray(body?.sites))
        invalid("sites", "Send the list of sites");
      campus.sites = body.sites
        .map((name) => String(name).trim())
        .filter(Boolean)
        .map(
          (name) =>
            campus.sites.find((s) => s.name === name) ?? { id: newId(), name },
        );
      campus.version += 1;
      return campusDetail(db, campus);
    },
    "CURATOR",
  );

  for (const field of ["logo", "banner"]) {
    route(
      "PUT",
      `/campuses/:id/${field}`,
      ({ db, params, files }) => {
        const campus = campusOf(db, params.id);
        campus[field] = imageFromUpload(files);
        campus.version += 1;
        return campusDetail(db, campus);
      },
      "CURATOR",
    );
  }

  route(
    "GET",
    "/campuses/:id/hub",
    ({ db, params }) => {
      const campus = campusOf(db, params.id);
      return {
        campus: campusDetail(db, campus),
        counts: {
          programmes: db.offerings.filter((o) => o.campusId === campus.id)
            .length,
          providers: db.campusProviders.filter((l) => l.campusId === campus.id)
            .length,
          hosts: db.campusHosts.filter((h) => h.campusId === campus.id).length,
          patients: db.accounts.filter((a) => a.patient?.campusId === campus.id)
            .length,
          justIn: db.joinRequests.filter(
            (r) => r.targetId === campus.id && r.status === "PENDING",
          ).length,
          awaitingResults: db.results.filter(
            (r) => r.campusId === campus.id && !r.acceptedAt,
          ).length,
        },
      };
    },
    "CURATOR",
  );

  // Programmes offered at a campus
  route(
    "GET",
    "/campuses/:id/programmes/catalogue",
    ({ db, params, query }) => {
      const campus = campusOf(db, params.id);
      const list = db.programmes
        .filter(
          (p) =>
            !offeringOf(db, campus.id, p.id) &&
            matchesQ(programmeNames(p), query.q),
        )
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
      return pageOf(list, query, catalogueProgramme);
    },
    "CURATOR",
  );

  route(
    "POST",
    "/campuses/:id/programmes/:programmeId",
    ({ db, params, body }) => {
      const campus = campusOf(db, params.id);
      const programme = programmeOf(db, params.programmeId);
      if (offeringOf(db, campus.id, programme.id))
        fail(409, "CONFLICT", "This campus already offers that programme.");
      const offering = {
        campusId: campus.id,
        programmeId: programme.id,
        yearsFrom: 1,
        yearsTo: programme.defaultYears,
        graduationMonth: null,
        nicknameIds: programme.nicknames.slice(0, 1).map((n) => n.id),
        tagOptions: {},
      };
      applySetup(db, offering, body ?? {});
      db.offerings.push(offering);
      return created(offeredProgramme(db, programme, offering, campus));
    },
    "CURATOR",
  );

  route(
    "PATCH",
    "/campuses/:id/programmes/:programmeId",
    ({ db, params, body }) => {
      const campus = campusOf(db, params.id);
      const programme = programmeOf(db, params.programmeId);
      const offering =
        offeringOf(db, campus.id, programme.id) ??
        notFound("that programme at this campus");
      applySetup(db, offering, body ?? {});
      return offeredProgramme(db, programme, offering, campus);
    },
    "CURATOR",
  );

  route(
    "DELETE",
    "/campuses/:id/programmes/:programmeId",
    ({ db, params }) => {
      const offering =
        offeringOf(db, params.id, params.programmeId) ??
        notFound("that programme at this campus");
      db.offerings = db.offerings.filter((o) => o !== offering);
      return noContent();
    },
    "CURATOR",
  );

  // Providers serving a campus (adding them is in network.js)
  route(
    "GET",
    "/campuses/:id/providers",
    ({ db, params }) => {
      campusOf(db, params.id);
      return db.campusProviders
        .filter((l) => l.campusId === params.id)
        .sort((a, b) => a.attachedAt.localeCompare(b.attachedAt))
        .map((l) => campusProviderView(db, l));
    },
    "CURATOR",
  );

  route(
    "PATCH",
    "/campuses/:id/providers/:providerId",
    ({ db, params, body = {} }) => {
      const link = db.campusProviders.find(
        (l) => l.campusId === params.id && l.providerId === params.providerId,
      );
      if (!link) notFound("that provider at this campus");
      if (body.roleCategoryId !== undefined) {
        if (
          body.roleCategoryId &&
          !byId(db.roleCategories, body.roleCategoryId)
        )
          invalid("roleCategoryId", "Choose a role group");
        link.roleCategoryId = body.roleCategoryId;
      }
      if (body.nsmqCounsellor != null) {
        // One NSMQ counsellor per campus.
        if (body.nsmqCounsellor) {
          for (const other of db.campusProviders)
            if (other.campusId === params.id) other.nsmqCounsellor = false;
        }
        link.nsmqCounsellor = !!body.nsmqCounsellor;
      }
      return campusProviderView(db, link);
    },
    "CURATOR",
  );

  route(
    "DELETE",
    "/campuses/:id/providers/:providerId",
    ({ db, params }) => {
      const campus = campusOf(db, params.id);
      const before = db.campusProviders.length;
      db.campusProviders = db.campusProviders.filter(
        (l) =>
          !(l.campusId === campus.id && l.providerId === params.providerId),
      );
      if (db.campusProviders.length === before)
        notFound("that provider at this campus");
      notifyProvider(db, params.providerId, {
        type: "PROVIDER_REMOVED",
        title: `You were removed from ${campus.fullName}`,
        body: "You no longer see this school's results.",
        data: { campusId: campus.id, providerId: params.providerId },
      });
      return noContent();
    },
    "CURATOR",
  );

  // Students at a campus
  route(
    "GET",
    "/campuses/:id/patients",
    ({ db, params, query }) => {
      campusOf(db, params.id);
      const list = db.accounts
        .filter(
          (a) =>
            a.patient?.campusId === params.id &&
            matchesQ([a.patient.fullName, a.patient.nickname], query.q),
        )
        .sort((a, b) => a.patient.fullName.localeCompare(b.patient.fullName));
      return pageOf(list, query, (a) => {
        const p = a.patient;
        const words = p.fullName.split(/\s+/);
        return {
          accountId: a.id,
          fullName: p.fullName,
          initials: words
            .slice(0, 2)
            .map((w) => w[0].toUpperCase())
            .join(""),
          nickname: p.nickname,
          photo: p.photo,
          gradeLabel: p.grade
            ? p.grade.startsWith("SHS")
              ? `SHS ${p.grade.slice(4)}`
              : `Year ${p.grade.slice(5)}`
            : null,
          graduationYear: null,
        };
      });
    },
    "CURATOR",
  );

  // ---------- Studios hub counts ----------
  route(
    "GET",
    "/studio/counts",
    ({ db }) => ({
      campuses: db.campuses.filter((c) => !c.archived).length,
      programmes: db.programmes.length,
      tags: db.tags.length,
      providers: db.providers.length,
      locations: db.locations.length,
      hosts: db.hosts.length,
      venues: db.venues.length,
      treatments: db.treatments.length,
      roleCategories: db.roleCategories.length,
    }),
    "CURATOR",
  );

  // ---------- Locations ----------
  route(
    "GET",
    "/locations",
    ({ db }) => [...db.locations].sort((a, b) => a.name.localeCompare(b.name)),
    "CURATOR",
  );

  route(
    "POST",
    "/locations",
    ({ db, body }) => {
      const name = requireText(body, "name", 100);
      ensureUnique(db.locations, [name], (l) => [l.name], "name");
      const location = { id: newId(), name };
      db.locations.push(location);
      return created(location);
    },
    "CURATOR",
  );

  route(
    "PATCH",
    "/locations/:id",
    ({ db, params, body }) => {
      const location =
        byId(db.locations, params.id) ?? notFound("that location");
      const name = requireText(body, "name", 100);
      ensureUnique(db.locations, [name], (l) => [l.name], "name", location);
      location.name = name;
      return location;
    },
    "CURATOR",
  );

  // ---------- Programmes ----------
  route(
    "GET",
    "/programmes",
    ({ db, query }) => {
      const list = db.programmes
        .filter((p) => matchesQ(programmeNames(p), query.q))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
      return pageOf(list, query, catalogueProgramme);
    },
    "CURATOR",
  );

  route(
    "GET",
    "/programmes/:id",
    ({ db, params }) => catalogueProgramme(programmeOf(db, params.id)),
    "CURATOR",
  );

  route(
    "POST",
    "/programmes",
    ({ db, body = {} }) => {
      const fullName = requireText(body, "fullName", 100);
      const nicknames = (body.nicknames ?? [])
        .map((n) => String(n).trim())
        .filter(Boolean);
      ensureUnique(db.programmes, [fullName], programmeNames, "fullName");
      ensureUnique(db.programmes, nicknames, programmeNames, "nicknames");
      const years = body.defaultYears ?? 4;
      if (!Number.isInteger(years) || years < 1 || years > 10)
        invalid("defaultYears", "Use 1 to 10 years");
      const programme = {
        id: newId(),
        fullName,
        nicknames: nicknames.map((name) => ({ id: newId(), name })),
        bio: body.bio?.trim() || null,
        cover: null,
        defaultYears: years,
        version: 1,
      };
      db.programmes.push(programme);
      return created(catalogueProgramme(programme));
    },
    "CURATOR",
  );

  route(
    "PATCH",
    "/programmes/:id",
    ({ db, params, body = {} }) => {
      const programme = programmeOf(db, params.id);
      checkVersion(programme, body);
      if (body.fullName !== undefined) {
        const fullName = requireText(body, "fullName", 100);
        ensureUnique(
          db.programmes,
          [fullName],
          programmeNames,
          "fullName",
          programme,
        );
        programme.fullName = fullName;
      }
      if (body.nicknames !== undefined) {
        const names = body.nicknames
          .map((n) => String(n).trim())
          .filter(Boolean);
        ensureUnique(
          db.programmes,
          names,
          programmeNames,
          "nicknames",
          programme,
        );
        programme.nicknames = names.map(
          (name) =>
            programme.nicknames.find((n) => n.name === name) ?? {
              id: newId(),
              name,
            },
        );
      }
      const bio = optionalText(body, "bio");
      if (bio !== undefined) programme.bio = bio;
      if (body.defaultYears !== undefined)
        programme.defaultYears = body.defaultYears;
      return catalogueProgramme(programme);
    },
    "CURATOR",
  );

  route(
    "PUT",
    "/programmes/:id/cover",
    ({ db, params, files }) => {
      const programme = programmeOf(db, params.id);
      programme.cover = imageFromUpload(files);
      programme.version += 1;
      return catalogueProgramme(programme);
    },
    "CURATOR",
  );

  // ---------- Tags ----------
  route("GET", "/tags", ({ db }) => db.tags, "CURATOR");

  route(
    "GET",
    "/tags/:id",
    ({ db, params }) => byId(db.tags, params.id) ?? notFound("that tag"),
    "CURATOR",
  );

  route(
    "POST",
    "/tags",
    ({ db, body = {} }) => {
      const title = requireText(body, "title", 100);
      ensureUnique(db.tags, [title], (t) => [t.title], "title");
      const tag = {
        id: newId(),
        title,
        options: (body.options ?? [])
          .map((label) => String(label).trim())
          .filter(Boolean)
          .map((label) => ({ id: newId(), label })),
        version: 1,
      };
      db.tags.push(tag);
      return created(tag);
    },
    "CURATOR",
  );

  route(
    "PATCH",
    "/tags/:id",
    ({ db, params, body = {} }) => {
      const tag = byId(db.tags, params.id) ?? notFound("that tag");
      checkVersion(tag, body);
      if (body.title !== undefined) {
        const title = requireText(body, "title", 100);
        ensureUnique(db.tags, [title], (t) => [t.title], "title", tag);
        tag.title = title;
      }
      if (body.options !== undefined) {
        tag.options = body.options
          .filter((o) => String(o.label ?? "").trim())
          .map((o) => ({
            id: o.id && tag.options.some((x) => x.id === o.id) ? o.id : newId(),
            label: String(o.label).trim(),
          }));
      }
      return tag;
    },
    "CURATOR",
  );

  // ---------- Role groups and roles ----------
  route(
    "GET",
    "/role-categories",
    ({ db }) =>
      [...db.roleCategories]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => roleCategoryView(db, c)),
    "public",
  );

  route(
    "POST",
    "/role-categories",
    ({ db, body = {} }) => {
      const name = requireText(body, "name", 60);
      ensureUnique(db.roleCategories, [name], (c) => [c.name], "name");
      const category = {
        id: newId(),
        name,
        dormant: !!body.dormant,
        roles: [],
        version: 1,
      };
      db.roleCategories.push(category);
      return created(roleCategoryView(db, category));
    },
    "CURATOR",
  );

  route(
    "PATCH",
    "/role-categories/:id",
    ({ db, params, body = {} }) => {
      const category =
        byId(db.roleCategories, params.id) ?? notFound("that role group");
      checkVersion(category, body);
      if (body.name !== undefined) {
        const name = requireText(body, "name", 60);
        ensureUnique(
          db.roleCategories,
          [name],
          (c) => [c.name],
          "name",
          category,
        );
        category.name = name;
      }
      if (body.dormant != null) category.dormant = !!body.dormant;
      return roleCategoryView(db, category);
    },
    "CURATOR",
  );

  route(
    "PUT",
    "/role-categories/:id/roles/:roleId",
    ({ db, params, body }) => {
      const category =
        byId(db.roleCategories, params.id) ?? notFound("that role group");
      if (!byId(db.roles, params.roleId)) notFound("that role");
      const link = category.roles.find((r) => r.roleId === params.roleId);
      if (link) link.active = !!body?.active;
      else
        category.roles.push({ roleId: params.roleId, active: !!body?.active });
      category.version += 1;
      return roleCategoryView(db, category);
    },
    "CURATOR",
  );

  route(
    "GET",
    "/roles",
    ({ db }) => [...db.roles].sort((a, b) => a.name.localeCompare(b.name)),
    "CURATOR",
  );

  route(
    "POST",
    "/roles",
    ({ db, body = {} }) => {
      const name = requireText(body, "name", 60);
      ensureUnique(db.roles, [name], (r) => [r.name], "name");
      const role = { id: newId(), name, emoji: body.emoji || "⭐" };
      db.roles.push(role);
      return created(role);
    },
    "CURATOR",
  );

  // ---------- Care catalogue ----------
  route(
    "GET",
    "/care/outcomes",
    ({ db, query }) =>
      db.careOutcomes
        .filter((o) => !query.app || o.app === query.app)
        .filter((o) => matchesQ([o.label, o.sectionTitle, o.band], query.q))
        .map((o) => careAction(db, o))
        .filter((a) => query.all === "true" || a.students > 0),
    "CURATOR",
  );

  route(
    "PUT",
    "/care/outcomes/:id/treatments",
    ({ db, params, body }) => {
      const outcome =
        byId(db.careOutcomes, params.id) ?? notFound("that outcome");
      if (
        !Array.isArray(body) ||
        body.some((x) => !byId(db.treatments, x.treatmentId))
      ) {
        invalid("treatments", "Choose treatments from the list");
      }
      outcome.treatments = body.map((x, i) => ({
        treatmentId: x.treatmentId,
        rank: x.rank ?? i + 1,
      }));
      return careAction(db, outcome);
    },
    "CURATOR",
  );

  route(
    "GET",
    "/care/waiting-room",
    ({ db, query }) =>
      db.careOutcomes
        .filter(
          (o) => (!query.app || o.app === query.app) && o.treatments.length,
        )
        .map((o) => outcomeCare(db, o)),
    "STAFF",
  );

  route(
    "GET",
    "/treatments",
    ({ db }) =>
      [...db.treatments]
        .sort((a, b) => a.defaultRank - b.defaultRank)
        .map(treatmentView),
    "STAFF",
  );

  route(
    "POST",
    "/treatments",
    ({ db, body = {} }) => {
      const name = requireText(body, "name", 100);
      ensureUnique(db.treatments, [name], (t) => [t.name], "name");
      const treatment = {
        id: newId(),
        name,
        defaultRank: body.defaultRank ?? db.treatments.length + 1,
        photo: null,
        version: 1,
      };
      db.treatments.push(treatment);
      return created(treatmentView(treatment));
    },
    "CURATOR",
  );

  route(
    "PATCH",
    "/treatments/:id",
    ({ db, params, body = {} }) => {
      const treatment =
        byId(db.treatments, params.id) ?? notFound("that treatment");
      checkVersion(treatment, body);
      if (body.name !== undefined) {
        const name = requireText(body, "name", 100);
        ensureUnique(db.treatments, [name], (t) => [t.name], "name", treatment);
        treatment.name = name;
      }
      if (body.defaultRank !== undefined)
        treatment.defaultRank = body.defaultRank;
      return treatmentView(treatment);
    },
    "CURATOR",
  );

  route(
    "PUT",
    "/treatments/:id/photo",
    ({ db, params, files }) => {
      const treatment =
        byId(db.treatments, params.id) ?? notFound("that treatment");
      treatment.photo = imageFromUpload(files);
      treatment.version += 1;
      return treatmentView(treatment);
    },
    "CURATOR",
  );

  // ---------- Audit (newest first) ----------
  route(
    "GET",
    "/audit",
    ({ db, query }) => {
      const list = db.audit
        .filter((e) => !query.entityType || e.entityType === query.entityType)
        .filter((e) => !query.entityId || e.entityId === query.entityId)
        .filter((e) => !query.campusId || e.campusId === query.campusId)
        .filter((e) => !query.from || e.occurredAt >= query.from)
        .filter((e) => !query.to || e.occurredAt <= query.to)
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
      return pageOf(list, query, (e) => e);
    },
    "CURATOR",
  );
}
