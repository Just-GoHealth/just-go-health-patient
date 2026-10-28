/**
 * Providers (contract 4a, 4b): the provider's own profile, application and join
 * requests; and the curator's Studios records plus the Just In approval queue.
 */
import {
  checkVersion,
  created,
  ensureUnique,
  fail,
  imageFromUpload,
  invalid,
  iso,
  matchesQ,
  newId,
  notFound,
  optionalText,
  pageOf,
  requireText,
} from "../core.js";
import {
  emitJustIn,
  emitProviderStatus,
  notifyCurators,
  notifyProvider,
} from "../events.js";
import {
  attachedCampusIds,
  byId,
  joinRequestView,
  missingFields,
  providerAccount,
  providerName,
  providerProfile,
  providerSummary,
} from "../views.js";

const STATUSES = ["DRAFT", "PENDING", "APPROVED", "REJECTED"];

export function normalisePhone(raw, field = "phone") {
  const value = String(raw).replace(/[\s()-]/g, "");
  if (value.length > 30) invalid(field, "Use 30 characters or fewer");
  const phone = /^0\d{9}$/.test(value) ? `+233${value.slice(1)}` : value;
  if (!/^\+[1-9]\d{7,14}$/.test(phone))
    invalid(field, "Enter a valid phone number, e.g. 024 123 4567");
  return phone;
}

function roleCategoryIds(db, ids) {
  if (!Array.isArray(ids) || ids.some((id) => !byId(db.roleCategories, id))) {
    invalid("roleCategoryIds", "Choose your specialties");
  }
  return [...new Set(ids)];
}

const ownProvider = ({ db, account }) =>
  byId(db.providers, account.providerId) ?? notFound("your profile");
const providerOf = (db, id) =>
  byId(db.providers, id) ?? notFound("that provider");

/** The last required field filled (or a resubmit): → PENDING, and the curator hears about it. */
function submitApplication(db, p) {
  p.status = "PENDING";
  p.submittedAt = iso();
  p.decidedAt = null;
  db.joinRequests.push({
    id: newId(),
    kind: "PROVIDER_APPLICATION",
    status: "PENDING",
    createdAt: iso(),
    decidedAt: null,
    providerId: p.id,
    targetType: null,
    targetId: null,
  });
  notifyCurators(db, {
    type: "PROVIDER_APPLICATION",
    title: "New provider application",
    body: `${providerName(p)} applied to join JustGo Health.`,
    data: { providerId: p.id },
  });
  emitJustIn(db, null);
}

function applyStudioFields(db, p, body) {
  if (body.title !== undefined) {
    const title = body.title == null ? null : String(body.title).trim() || null;
    if (title && title.length > 30)
      invalid("title", "Use 30 characters or fewer");
    p.title = title;
  }
  if (body.fullName !== undefined)
    p.fullName = requireText(body, "fullName", 100);
  if (body.nicknames != null) {
    const nicknames = body.nicknames
      .map((n) => String(n).trim())
      .filter(Boolean);
    ensureUnique(db.providers, nicknames, (x) => x.nicknames, "nicknames", p);
    p.nicknames = nicknames;
  }
  if (body.email !== undefined) {
    const email = body.email ? String(body.email).trim().toLowerCase() : null;
    if (email !== p.email && providerAccount(db, p.id)?.claimed) {
      fail(
        409,
        "EMAIL_LOCKED",
        "This provider has claimed their account, so the email can't change.",
        [
          {
            field: "email",
            message: "Locked after the provider claims their account",
          },
        ],
      );
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      invalid("email", "Enter a valid email address");
    p.email = email;
  }
  if (body.phone !== undefined)
    p.phone = body.phone ? normalisePhone(body.phone) : null;
  for (const key of ["slogan", "clinicianNotes", "bio"]) {
    const value = optionalText(body, key);
    if (value !== undefined) p[key] = value;
  }
  if (body.clinical != null) p.clinical = !!body.clinical;
  if (body.roleCategoryIds != null)
    p.roleCategoryIds = roleCategoryIds(db, body.roleCategoryIds);
}

export function register(route) {
  // ---------- The provider's own profile ----------
  route(
    "GET",
    "/providers/me",
    (ctx) => providerProfile(ctx.db, ownProvider(ctx)),
    "PROVIDER",
  );

  route(
    "PATCH",
    "/providers/me",
    (ctx) => {
      const { db, body = {} } = ctx;
      const p = ownProvider(ctx);
      checkVersion(p, body);
      if (body.title !== undefined) {
        const title = String(body.title ?? "").trim();
        if (!title) invalid("title", "Enter your title");
        if (title.length > 30) invalid("title", "Use 30 characters or fewer");
        p.title = title;
      }
      if (body.fullName !== undefined)
        p.fullName = requireText(body, "fullName", 100);
      if (body.phone !== undefined)
        p.phone = body.phone === "" ? null : normalisePhone(body.phone);
      for (const key of ["slogan", "clinicianNotes"]) {
        const value = optionalText(body, key);
        if (value !== undefined) p[key] = value;
      }
      if (body.roleCategoryIds !== undefined)
        p.roleCategoryIds = roleCategoryIds(db, body.roleCategoryIds);
      if (p.status === "DRAFT" && missingFields(p).length === 0)
        submitApplication(db, p);
      return providerProfile(db, p);
    },
    "PROVIDER",
  );

  route(
    "PUT",
    "/providers/me/photo",
    (ctx) => {
      const p = ownProvider(ctx);
      p.photo = imageFromUpload(ctx.files);
      p.version += 1;
      if (p.status === "DRAFT" && missingFields(p).length === 0)
        submitApplication(ctx.db, p);
      return providerProfile(ctx.db, p);
    },
    "PROVIDER",
  );

  route(
    "POST",
    "/providers/me/resubmit",
    (ctx) => {
      const p = ownProvider(ctx);
      if (p.status !== "REJECTED")
        fail(
          409,
          "NOT_REJECTED",
          "Only a declined application can be resubmitted.",
        );
      const missing = missingFields(p);
      if (missing.length) {
        fail(
          422,
          "PROFILE_INCOMPLETE",
          "Finish your profile before you resubmit.",
          [{ field: missing[0], message: "This field is required" }],
        );
      }
      p.version += 1;
      submitApplication(ctx.db, p);
      return providerProfile(ctx.db, p);
    },
    "PROVIDER",
  );

  route(
    "POST",
    "/providers/me/join-requests",
    (ctx) => {
      const { db, body = {} } = ctx;
      const p = ownProvider(ctx);
      if (p.status !== "APPROVED")
        fail(
          403,
          "NOT_APPROVED",
          "Your application needs to be approved first.",
        );
      if (!["CAMPUS", "HOST"].includes(body.targetType))
        invalid("targetType", "Choose a campus or host");
      const campusTarget = body.targetType === "CAMPUS";
      const target = campusTarget
        ? byId(db.campuses, body.targetId)
        : byId(db.hosts, body.targetId);
      if (!target || target.archived)
        fail(422, "TARGET_UNAVAILABLE", "That isn't available to join.");
      const joined = campusTarget
        ? attachedCampusIds(db, p.id).includes(target.id)
        : target.providers.some((x) => x.providerId === p.id);
      if (joined) fail(409, "ALREADY_JOINED", "You already serve here.");
      if (
        db.joinRequests.some(
          (r) =>
            r.providerId === p.id &&
            r.targetId === target.id &&
            r.status === "PENDING",
        )
      ) {
        fail(
          409,
          "ALREADY_REQUESTED",
          "You've already asked to join. The curator will reply soon.",
        );
      }
      const request = {
        id: newId(),
        kind: campusTarget ? "JOIN_CAMPUS" : "JOIN_HOST",
        status: "PENDING",
        createdAt: iso(),
        decidedAt: null,
        providerId: p.id,
        targetType: body.targetType,
        targetId: target.id,
      };
      db.joinRequests.push(request);
      notifyCurators(db, {
        campusId: campusTarget ? target.id : null,
        type: "JOIN_REQUEST",
        title: `Request to join ${target.fullName}`,
        body: `${providerName(p)} asked to serve ${target.fullName}.`,
        data: { providerId: p.id, targetId: target.id },
      });
      emitJustIn(db, target.id);
      return created(joinRequestView(db, request));
    },
    "PROVIDER",
  );

  route(
    "GET",
    "/providers/me/join-requests",
    (ctx) => {
      const p = ownProvider(ctx);
      const mine = ctx.db.joinRequests
        .filter((r) => r.providerId === p.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return pageOf(mine, ctx.query, (r) => joinRequestView(ctx.db, r));
    },
    "PROVIDER",
  );

  // ---------- Curator: Studios providers ----------
  route(
    "GET",
    "/providers",
    ({ db, query }) => {
      let list = db.providers.filter((p) =>
        matchesQ([p.fullName, ...p.nicknames], query.q),
      );
      if (query.roleCategory)
        list = list.filter((p) =>
          p.roleCategoryIds.includes(query.roleCategory),
        );
      if (query.status) {
        if (!STATUSES.includes(query.status))
          fail(400, "MALFORMED_REQUEST", "Unknown status.");
        list = list.filter((p) => p.status === query.status);
      }
      list.sort((a, b) => a.fullName.localeCompare(b.fullName));
      return pageOf(list, query, (p) => providerSummary(db, p));
    },
    "CURATOR",
  );

  route(
    "POST",
    "/providers",
    ({ db, body = {} }) => {
      const p = {
        id: newId(),
        title: null,
        fullName: requireText(body, "fullName", 100),
        nicknames: [],
        email: null,
        phone: null,
        photo: null,
        slogan: null,
        clinicianNotes: null,
        bio: null,
        clinical: false,
        status: "APPROVED",
        submittedAt: null,
        decidedAt: iso(),
        roleCategoryIds: [],
        studioCreated: true,
        version: 1,
      };
      applyStudioFields(db, p, body);
      db.providers.push(p);
      return created(providerProfile(db, p));
    },
    "CURATOR",
  );

  route(
    "GET",
    "/providers/:id",
    ({ db, params }) => providerProfile(db, providerOf(db, params.id)),
    "CURATOR",
  );

  route(
    "PATCH",
    "/providers/:id",
    ({ db, params, body = {} }) => {
      const p = providerOf(db, params.id);
      checkVersion(p, body);
      applyStudioFields(db, p, body);
      return providerProfile(db, p);
    },
    "CURATOR",
  );

  route(
    "PUT",
    "/providers/:id/photo",
    ({ db, params, files }) => {
      const p = providerOf(db, params.id);
      p.photo = imageFromUpload(files);
      p.version += 1;
      return providerProfile(db, p);
    },
    "CURATOR",
  );

  route(
    "POST",
    "/providers/:id/invite",
    ({ db, params }) => {
      const p = providerOf(db, params.id);
      if (!p.email)
        fail(422, "NO_EMAIL", "Add an email before inviting this provider.");
      if (!providerAccount(db, p.id)) {
        db.accounts.push({
          id: newId(),
          role: "PROVIDER",
          contact: p.email,
          password: null,
          claimed: false,
          providerId: p.id,
        });
      }
      return providerProfile(db, p);
    },
    "CURATOR",
  );

  // ---------- Curator: Just In ----------
  route(
    "GET",
    "/join-requests",
    ({ db, query }) => {
      let list = db.joinRequests;
      if (query.status) list = list.filter((r) => r.status === query.status);
      if (query.kind) list = list.filter((r) => r.kind === query.kind);
      if (query.targetType)
        list = list.filter((r) => r.targetType === query.targetType);
      if (query.targetId)
        list = list.filter((r) => r.targetId === query.targetId);
      const pendingFirst = (r) => (r.status === "PENDING" ? 0 : 1);
      list = [...list].sort(
        (a, b) =>
          pendingFirst(a) - pendingFirst(b) ||
          b.createdAt.localeCompare(a.createdAt),
      );
      return pageOf(list, query, (r) => joinRequestView(db, r));
    },
    "CURATOR",
  );

  route(
    "POST",
    "/join-requests/:id/approve",
    ({ db, params, body = {} }) => {
      const r = byId(db.joinRequests, params.id) ?? notFound("that request");
      if (r.status !== "PENDING")
        fail(409, "REQUEST_DECIDED", "This request was already decided.");
      const p = byId(db.providers, r.providerId);
      r.status = "APPROVED";
      r.decidedAt = iso();
      if (r.kind === "PROVIDER_APPLICATION") {
        p.status = "APPROVED";
        p.decidedAt = iso();
        p.version += 1;
        notifyProvider(db, p.id, {
          type: "APPLICATION_ACCEPTED",
          title: "Your application was accepted",
          body: "Welcome to JustGo Health.",
        });
        emitProviderStatus(db, p.id);
      } else if (r.kind === "JOIN_CAMPUS") {
        const campus = byId(db.campuses, r.targetId);
        db.campusProviders.push({
          campusId: campus.id,
          providerId: p.id,
          roleCategoryId: body.roleCategoryId ?? p.roleCategoryIds[0] ?? null,
          nsmqCounsellor: false,
          mainHost: false,
          broughtByCampusHostId: null,
          attachedAt: iso(),
        });
        notifyProvider(db, p.id, {
          type: "JOIN_APPROVED",
          title: `You can now serve ${campus.fullName}`,
          body: "Your request was approved.",
          data: { targetType: "CAMPUS", targetId: campus.id },
        });
        notifyProvider(db, p.id, {
          type: "PROVIDER_ADDED",
          title: `You were added to ${campus.fullName}`,
          body: "You can now see this school's results.",
          data: { campusId: campus.id, providerId: p.id },
        });
      } else {
        const host = byId(db.hosts, r.targetId);
        host.providers.push({
          providerId: p.id,
          roleCategoryId: body.roleCategoryId ?? p.roleCategoryIds[0] ?? null,
          mainHost: true,
          viaHostIds: [],
          attachedAt: iso(),
        });
        notifyProvider(db, p.id, {
          type: "JOIN_APPROVED",
          title: `You joined ${host.fullName}`,
          body: "Your request was approved.",
          data: { targetType: "HOST", targetId: host.id },
        });
      }
      emitJustIn(db, r.targetId);
      return joinRequestView(db, r);
    },
    "CURATOR",
  );

  route(
    "POST",
    "/join-requests/:id/decline",
    ({ db, params }) => {
      const r = byId(db.joinRequests, params.id) ?? notFound("that request");
      if (r.status !== "PENDING")
        fail(409, "REQUEST_DECIDED", "This request was already decided.");
      const p = byId(db.providers, r.providerId);
      r.status = "DECLINED";
      r.decidedAt = iso();
      if (r.kind === "PROVIDER_APPLICATION") {
        p.status = "REJECTED";
        p.decidedAt = iso();
        p.version += 1;
        notifyProvider(db, p.id, {
          type: "APPLICATION_REJECTED",
          title: "Your application wasn't accepted",
          body: "You can update your profile and resubmit.",
        });
        emitProviderStatus(db, p.id);
      } else {
        notifyProvider(db, p.id, {
          type: "JOIN_DECLINED",
          title: "Your join request was declined",
          body: "Contact the curator if you think this is a mistake.",
          data: { targetType: r.targetType, targetId: r.targetId },
        });
      }
      emitJustIn(db, r.targetId);
      return joinRequestView(db, r);
    },
    "CURATOR",
  );
}
