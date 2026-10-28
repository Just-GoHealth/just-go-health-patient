/**
 * Curator network (venues, hosts, partners, host providers, campus ⇄ host
 * routing, Reach) and the landing-page content (cover pages, the icons wall,
 * team entries). All curator only.
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
  noContent,
  notFound,
  pageOf,
  requireText,
} from "../core.js";
import { notifyProvider } from "../events.js";
import { byId, campusProviderView } from "../views.js";

const HOST_TYPES = ["CLINICAL", "CURATOR", "BRAND"];
const TEAM_ENTRY_TYPES = ["COACH", "ADVISOR", "AMBASSADOR"];

const venueOf = (db, id) => byId(db.venues, id) ?? notFound("that venue");
const hostOf = (db, id) => byId(db.hosts, id) ?? notFound("that host");
const campusOf = (db, id) => byId(db.campuses, id) ?? notFound("that campus");

const venueView = (v) => ({
  id: v.id,
  title: v.title,
  bio: v.bio,
  serviceTypes: v.serviceTypes,
  version: v.version,
});

function hostView(db, h) {
  const location = byId(db.locations, h.locationId);
  return {
    id: h.id,
    fullName: h.fullName,
    nicknames: h.nicknames,
    type: h.type,
    bio: h.bio,
    location: location ? { id: location.id, name: location.name } : null,
    photo: h.photo,
    version: h.version,
  };
}

function hostProviderView(db, link) {
  const p = byId(db.providers, link.providerId);
  const category = link.roleCategoryId
    ? byId(db.roleCategories, link.roleCategoryId)
    : null;
  return {
    providerId: p.id,
    title: p.title,
    fullName: p.fullName,
    initials: p.fullName
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join(""),
    photo: p.photo,
    roleCategoryId: link.roleCategoryId ?? null,
    roleCategory: category?.name ?? null,
    mainHost: link.mainHost,
    viaHostIds: link.viaHostIds,
    attachedAt: link.attachedAt,
  };
}

function campusHostView(db, link) {
  const h = byId(db.hosts, link.hostId);
  return {
    hostId: h.id,
    fullName: h.fullName,
    type: h.type,
    joinType: link.joinType,
    mainVenueId: link.mainVenueId,
    venueIds: link.venueIds,
    broughtByHostId: link.broughtByHostId,
    photo: h.photo,
    addedAt: link.addedAt,
  };
}

const circleView = (db, c) => {
  const v = byId(db.venues, c.connectedId);
  return {
    venueId: c.connectedId,
    title: v?.title ?? "Venue",
    serviceTypes: c.serviceTypes,
    addedAt: c.addedAt,
  };
};

function checkHostType(value, field = "type") {
  if (!HOST_TYPES.includes(value)) invalid(field, "Choose a host type");
  return value;
}

/** Attaches a provider to a campus (and tells them). */
function attachProvider(db, campus, routing, hostId = null) {
  const p = byId(db.providers, routing.providerId);
  if (!p) invalid("providerId", "Unknown provider");
  if (p.status !== "APPROVED")
    fail(422, "PROVIDER_NOT_APPROVED", `${p.fullName} isn't approved yet.`);
  if (
    db.campusProviders.some(
      (l) => l.campusId === campus.id && l.providerId === p.id,
    )
  )
    return;
  db.campusProviders.push({
    campusId: campus.id,
    providerId: p.id,
    roleCategoryId: routing.roleCategoryId ?? p.roleCategoryIds[0] ?? null,
    nsmqCounsellor: false,
    mainHost: !!routing.mainHost,
    broughtByCampusHostId: hostId ?? routing.viaHostIds?.[0] ?? null,
    attachedAt: iso(),
  });
  notifyProvider(db, p.id, {
    type: "PROVIDER_ADDED",
    title: `You were added to ${campus.fullName}`,
    body: "You can now see this school's results.",
    data: { campusId: campus.id, providerId: p.id },
  });
}

/** A campus's (campusId), JustGo Health's (global), or all. */
const inScope = (item, query) =>
  query.campusId
    ? item.campusId === query.campusId
    : query.global === "true"
      ? item.campusId == null
      : true;

const iconView = (i) => ({
  icon: {
    id: i.id,
    nickname: i.nickname,
    name: i.name,
    slogan: i.slogan,
    campusId: i.campusId,
    campusName: null,
    year: i.year,
    photo: i.photo,
    rank: i.rank,
    position: i.position,
    achievements: i.achievements,
    lockIns: i.lockIns,
  },
  phone: i.phone,
  version: i.version,
});

export function register(route) {
  // ---------- Venues ----------
  route(
    "GET",
    "/venues",
    ({ db, query }) =>
      db.venues
        .filter((v) => matchesQ([v.title], query.q))
        .sort((a, b) => a.title.localeCompare(b.title))
        .map(venueView),
    "CURATOR",
  );

  route(
    "POST",
    "/venues",
    ({ db, body = {} }) => {
      const title = requireText(body, "title", 100);
      ensureUnique(db.venues, [title], (v) => [v.title], "title");
      if (!Array.isArray(body.serviceTypes) || !body.serviceTypes.length)
        invalid("serviceTypes", "Choose at least one service");
      const venue = {
        id: newId(),
        title,
        bio: body.bio ?? null,
        serviceTypes: body.serviceTypes,
        version: 1,
      };
      db.venues.push(venue);
      return created(venueView(venue));
    },
    "CURATOR",
  );

  route(
    "PATCH",
    "/venues/:id",
    ({ db, params, body = {} }) => {
      const venue = venueOf(db, params.id);
      checkVersion(venue, body);
      if (body.title !== undefined) {
        const title = requireText(body, "title", 100);
        ensureUnique(db.venues, [title], (v) => [v.title], "title", venue);
        venue.title = title;
      }
      if (body.bio !== undefined) venue.bio = body.bio || null;
      if (body.serviceTypes !== undefined)
        venue.serviceTypes = body.serviceTypes;
      return venueView(venue);
    },
    "CURATOR",
  );

  route(
    "GET",
    "/venues/:id/hub",
    ({ db, params }) => {
      const venue = venueOf(db, params.id);
      const circles = db.circles
        .filter((c) => c.venueId === venue.id)
        .map((c) => circleView(db, c));
      return {
        identity: { venue: venueView(venue), circles },
        counts: { circles: circles.length },
      };
    },
    "CURATOR",
  );

  route(
    "POST",
    "/venues/:id/circles",
    ({ db, params, body }) => {
      const venue = venueOf(db, params.id);
      for (const c of Array.isArray(body) ? body : []) {
        venueOf(db, c.venueId);
        if (
          c.venueId === venue.id ||
          db.circles.some(
            (x) => x.venueId === venue.id && x.connectedId === c.venueId,
          )
        )
          continue;
        db.circles.push({
          venueId: venue.id,
          connectedId: c.venueId,
          serviceTypes: c.serviceTypes ?? [],
          addedAt: iso(),
        });
      }
      return db.circles
        .filter((c) => c.venueId === venue.id)
        .map((c) => circleView(db, c));
    },
    "CURATOR",
  );

  route(
    "DELETE",
    "/venues/:id/circles/:connectedId",
    ({ db, params }) => {
      db.circles = db.circles.filter(
        (c) =>
          !(c.venueId === params.id && c.connectedId === params.connectedId),
      );
      return noContent();
    },
    "CURATOR",
  );

  // ---------- Hosts ----------
  route(
    "GET",
    "/hosts",
    ({ db, query }) => {
      const atCampus = query.notAtCampus
        ? new Set(
            db.campusHosts
              .filter((h) => h.campusId === query.notAtCampus)
              .map((h) => h.hostId),
          )
        : new Set();
      const list = db.hosts
        .filter((h) => matchesQ([h.fullName, ...h.nicknames], query.q))
        .filter((h) => !query.type || h.type === query.type)
        .filter((h) => !atCampus.has(h.id))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
      return pageOf(list, query, (h) => hostView(db, h));
    },
    "CURATOR",
  );

  route(
    "POST",
    "/hosts",
    ({ db, body = {} }) => {
      const fullName = requireText(body, "fullName", 100);
      const nicknames = (body.nicknames ?? [])
        .map((n) => String(n).trim())
        .filter(Boolean);
      if (!nicknames.length) invalid("nicknames", "Add at least one nickname");
      ensureUnique(db.hosts, [fullName], (h) => [h.fullName], "fullName");
      ensureUnique(db.hosts, nicknames, (h) => h.nicknames, "nicknames");
      if (!byId(db.locations, body.locationId))
        invalid("locationId", "Choose a location");
      const host = {
        id: newId(),
        fullName,
        nicknames,
        type: checkHostType(body.type),
        bio: requireText(body, "bio", 2000),
        locationId: body.locationId,
        photo: null,
        version: 1,
        venueIds: [],
        network: [],
        partners: [],
        providers: [],
      };
      db.hosts.push(host);
      return created(hostView(db, host));
    },
    "CURATOR",
  );

  route(
    "GET",
    "/hosts/:id",
    ({ db, params }) => hostView(db, hostOf(db, params.id)),
    "CURATOR",
  );

  route(
    "PATCH",
    "/hosts/:id",
    ({ db, params, body = {} }) => {
      const host = hostOf(db, params.id);
      checkVersion(host, body);
      if (body.fullName !== undefined) {
        const fullName = requireText(body, "fullName", 100);
        ensureUnique(
          db.hosts,
          [fullName],
          (h) => [h.fullName],
          "fullName",
          host,
        );
        host.fullName = fullName;
      }
      if (body.nicknames !== undefined) {
        ensureUnique(
          db.hosts,
          body.nicknames,
          (h) => h.nicknames,
          "nicknames",
          host,
        );
        host.nicknames = body.nicknames;
      }
      if (body.type !== undefined) host.type = checkHostType(body.type);
      if (body.bio !== undefined) host.bio = body.bio;
      if (body.locationId !== undefined) {
        if (!byId(db.locations, body.locationId))
          invalid("locationId", "Choose a location");
        host.locationId = body.locationId;
      }
      return hostView(db, host);
    },
    "CURATOR",
  );

  route(
    "PUT",
    "/hosts/:id/photo",
    ({ db, params, files }) => {
      const host = hostOf(db, params.id);
      host.photo = imageFromUpload(files);
      host.version += 1;
      return hostView(db, host);
    },
    "CURATOR",
  );

  route(
    "GET",
    "/hosts/:id/hub",
    ({ db, params }) => {
      const host = hostOf(db, params.id);
      return {
        identity: hostView(db, host),
        counts: {
          venues: host.venueIds.length,
          campuses: db.campusHosts.filter((c) => c.hostId === host.id).length,
          partners: host.partners.length,
          providers: host.providers.length,
          justIn: db.joinRequests.filter(
            (r) => r.targetId === host.id && r.status === "PENDING",
          ).length,
        },
      };
    },
    "CURATOR",
  );

  route(
    "PUT",
    "/hosts/:id/venues/:venueId",
    ({ db, params }) => {
      const host = hostOf(db, params.id);
      venueOf(db, params.venueId);
      if (!host.venueIds.includes(params.venueId))
        host.venueIds.push(params.venueId);
      return host.venueIds;
    },
    "CURATOR",
  );

  route(
    "DELETE",
    "/hosts/:id/venues/:venueId",
    ({ db, params }) => {
      const host = hostOf(db, params.id);
      host.venueIds = host.venueIds.filter((v) => v !== params.venueId);
      return host.venueIds;
    },
    "CURATOR",
  );

  route(
    "GET",
    "/hosts/:id/network",
    ({ db, params }) =>
      hostOf(db, params.id)
        .network.map((id) => byId(db.hosts, id))
        .filter(Boolean)
        .map((h) => hostView(db, h)),
    "CURATOR",
  );

  route(
    "PUT",
    "/hosts/:id/network",
    ({ db, params, body }) => {
      const host = hostOf(db, params.id);
      const ids = body?.memberHostIds ?? [];
      ids.forEach((id) => hostOf(db, id));
      host.network = ids.filter((id) => id !== host.id);
      return host.network.map((id) => hostView(db, byId(db.hosts, id)));
    },
    "CURATOR",
  );

  route(
    "GET",
    "/hosts/:id/partners",
    ({ db, params }) =>
      hostOf(db, params.id).partners.map(({ hostId, joinType }) => ({
        hostId,
        joinType,
      })),
    "CURATOR",
  );

  route(
    "POST",
    "/hosts/:id/partners",
    ({ db, params, body }) => {
      const host = hostOf(db, params.id);
      for (const p of Array.isArray(body) ? body : []) {
        hostOf(db, p.partnerHostId);
        if (host.partners.some((x) => x.hostId === p.partnerHostId))
          fail(409, "ALREADY_LINKED", "That host is already a partner.");
        host.partners.push({
          hostId: p.partnerHostId,
          joinType: p.joinType ?? null,
          venueIds: p.venueIds ?? [],
        });
      }
      return host.partners.map(({ hostId, joinType }) => ({
        hostId,
        joinType,
      }));
    },
    "CURATOR",
  );

  route(
    "DELETE",
    "/hosts/:id/partners/:partnerId",
    ({ db, params }) => {
      const host = hostOf(db, params.id);
      host.partners = host.partners.filter(
        (p) => p.hostId !== params.partnerId,
      );
      return noContent();
    },
    "CURATOR",
  );

  route(
    "GET",
    "/hosts/:id/providers",
    ({ db, params }) =>
      hostOf(db, params.id).providers.map((l) => hostProviderView(db, l)),
    "CURATOR",
  );

  route(
    "POST",
    "/hosts/:id/providers",
    ({ db, params, body }) => {
      const host = hostOf(db, params.id);
      for (const r of body?.providers ?? []) {
        const p = byId(db.providers, r.providerId);
        if (!p) invalid("providerId", "Unknown provider");
        if (p.status !== "APPROVED")
          fail(
            422,
            "PROVIDER_NOT_APPROVED",
            `${p.fullName} isn't approved yet.`,
          );
        if (!r.mainHost && !r.viaHostIds?.length)
          fail(
            422,
            "VIA_HOSTS_REQUIRED",
            "Say which host brings this provider.",
          );
        if (host.providers.some((x) => x.providerId === p.id)) continue;
        host.providers.push({
          providerId: p.id,
          roleCategoryId: r.roleCategoryId ?? p.roleCategoryIds[0] ?? null,
          mainHost: !!r.mainHost,
          viaHostIds: r.viaHostIds ?? [],
          attachedAt: iso(),
        });
        notifyProvider(db, p.id, {
          type: "HOST_PROVIDER_ADDED",
          title: `You were added to ${host.fullName}`,
          body: "",
          data: { hostId: host.id },
        });
      }
      return host.providers.map((l) => hostProviderView(db, l));
    },
    "CURATOR",
  );

  route(
    "DELETE",
    "/hosts/:id/providers/:providerId",
    ({ db, params }) => {
      const host = hostOf(db, params.id);
      host.providers = host.providers.filter(
        (p) => p.providerId !== params.providerId,
      );
      return noContent();
    },
    "CURATOR",
  );

  route(
    "GET",
    "/hosts/:id/campuses",
    ({ db, params }) => {
      hostOf(db, params.id);
      return db.campusHosts
        .filter((c) => c.hostId === params.id)
        .map((c) => campusHostView(db, c));
    },
    "CURATOR",
  );

  // ---------- Campus ⇄ hosts and providers ----------
  route(
    "GET",
    "/campuses/:id/hosts",
    ({ db, params }) => {
      campusOf(db, params.id);
      return db.campusHosts
        .filter((c) => c.campusId === params.id)
        .map((c) => campusHostView(db, c));
    },
    "CURATOR",
  );

  route(
    "POST",
    "/campuses/:id/hosts",
    ({ db, params, body }) => {
      const campus = campusOf(db, params.id);
      for (const req of body?.hosts ?? []) {
        const host = hostOf(db, req.hostId);
        if (
          db.campusHosts.some(
            (c) => c.campusId === campus.id && c.hostId === host.id,
          )
        ) {
          fail(
            409,
            "HOST_ALREADY_AT_CAMPUS",
            `${host.fullName} is already at this campus.`,
          );
        }
        if (req.mainVenueId && !host.venueIds.includes(req.mainVenueId)) {
          fail(
            422,
            "VENUE_NOT_THE_HOSTS",
            "That venue isn't one of this host's venues.",
          );
        }
        db.campusHosts.push({
          campusId: campus.id,
          hostId: host.id,
          joinType: req.joinType ?? host.type,
          mainVenueId: req.mainVenueId ?? null,
          venueIds: req.venueIds ?? host.venueIds,
          broughtByHostId: null,
          addedAt: iso(),
        });
        // Brings its partners and providers along unless told otherwise.
        for (const partner of host.partners.filter(
          (p) => !req.bringPartnerIds || req.bringPartnerIds.includes(p.hostId),
        )) {
          if (
            db.campusHosts.some(
              (c) => c.campusId === campus.id && c.hostId === partner.hostId,
            )
          )
            continue;
          db.campusHosts.push({
            campusId: campus.id,
            hostId: partner.hostId,
            joinType: partner.joinType,
            mainVenueId: null,
            venueIds: partner.venueIds,
            broughtByHostId: host.id,
            addedAt: iso(),
          });
        }
        for (const link of host.providers.filter(
          (p) =>
            !req.bringProviderIds ||
            req.bringProviderIds.includes(p.providerId),
        )) {
          attachProvider(db, campus, link, host.id);
        }
      }
      return db.campusHosts
        .filter((c) => c.campusId === campus.id)
        .map((c) => campusHostView(db, c));
    },
    "CURATOR",
  );

  route(
    "DELETE",
    "/campuses/:id/hosts/:hostId",
    ({ db, params }) => {
      db.campusHosts = db.campusHosts.filter(
        (c) => !(c.campusId === params.id && c.hostId === params.hostId),
      );
      return noContent();
    },
    "CURATOR",
  );

  route(
    "POST",
    "/campuses/:id/providers",
    ({ db, params, body }) => {
      const campus = campusOf(db, params.id);
      for (const routing of body?.providers ?? [])
        attachProvider(db, campus, routing);
      return db.campusProviders
        .filter((l) => l.campusId === campus.id)
        .map((l) => campusProviderView(db, l));
    },
    "CURATOR",
  );

  route(
    "GET",
    "/campuses/:id/providers/routes",
    ({ db, params }) => {
      campusOf(db, params.id);
      return Object.fromEntries(
        db.campusProviders
          .filter((l) => l.campusId === params.id)
          .map((l) => [
            l.providerId,
            l.broughtByCampusHostId ? [l.broughtByCampusHostId] : [],
          ]),
      );
    },
    "CURATOR",
  );

  // ---------- Reach ----------
  const reachView = (db, campusId) => {
    const results = db.results.filter(
      (r) => !campusId || r.campusId === campusId,
    );
    const baseline = db.reachBaselines[campusId ?? "global"] ?? 0;
    const students = new Set(results.map((r) => r.patientAccountId)).size;
    return {
      reach: baseline + students,
      baseline,
      visits: results.filter((r) => r.lastProviderView).length,
      screens: results.length,
      carriedVisits: 0,
      carriedScreens: 0,
      results: results.length,
      activeResults: results.filter((r) => r.active).length,
    };
  };

  route(
    "GET",
    "/reach",
    ({ db, query }) => reachView(db, query.campusId ?? null),
    "CURATOR",
  );

  route(
    "PUT",
    "/reach/baseline",
    ({ db, body = {} }) => {
      if (!Number.isInteger(body.value) || body.value < 0)
        invalid("value", "Enter a whole number");
      db.reachBaselines[body.campusId ?? "global"] = body.value;
      return reachView(db, body.campusId ?? null);
    },
    "CURATOR",
  );

  // ---------- Cover pages ----------
  route(
    "GET",
    "/cover-pages",
    ({ db, query }) =>
      db.covers
        .filter((c) => inScope(c, query))
        .sort((a, b) => a.position - b.position),
    "CURATOR",
  );

  route(
    "POST",
    "/cover-pages",
    ({ db, body = {} }) => {
      const cover = {
        id: newId(),
        campusId: body.campusId ?? null,
        photo: null,
        slogan: body.slogan ?? null,
        colour: body.colour ?? null,
        position:
          body.position ??
          db.covers.filter((c) => c.campusId === (body.campusId ?? null))
            .length,
        version: 1,
      };
      db.covers.push(cover);
      return created(cover);
    },
    "CURATOR",
  );

  route(
    "PATCH",
    "/cover-pages/:id",
    ({ db, params, body = {} }) => {
      const cover = byId(db.covers, params.id) ?? notFound("that cover page");
      checkVersion(cover, body);
      for (const key of ["slogan", "colour", "position"])
        if (body[key] !== undefined) cover[key] = body[key];
      return cover;
    },
    "CURATOR",
  );

  route(
    "PUT",
    "/cover-pages/:id/photo",
    ({ db, params, files }) => {
      const cover = byId(db.covers, params.id) ?? notFound("that cover page");
      cover.photo = imageFromUpload(files);
      cover.version += 1;
      return cover;
    },
    "CURATOR",
  );

  route(
    "DELETE",
    "/cover-pages/:id",
    ({ db, params }) => {
      db.covers = db.covers.filter((c) => c.id !== params.id);
      return noContent();
    },
    "CURATOR",
  );

  // ---------- Icons ----------
  const withCampusName = (db, view) => ({
    ...view,
    icon: {
      ...view.icon,
      campusName: view.icon.campusId
        ? (byId(db.campuses, view.icon.campusId)?.fullName ?? null)
        : null,
    },
  });
  const ICON_FIELDS = [
    "name",
    "nickname",
    "slogan",
    "campusId",
    "year",
    "rank",
    "position",
    "phone",
    "achievements",
    "lockIns",
  ];

  route(
    "GET",
    "/icons",
    ({ db }) =>
      [...db.icons]
        .sort((a, b) => a.position - b.position)
        .map((i) => withCampusName(db, iconView(i))),
    "CURATOR",
  );

  route(
    "POST",
    "/icons",
    ({ db, body = {} }) => {
      const icon = {
        id: newId(),
        name: requireText(body, "name", 100),
        nickname: null,
        slogan: null,
        campusId: null,
        year: null,
        photo: null,
        rank: null,
        position: db.icons.length,
        achievements: [],
        lockIns: [],
        phone: null,
        version: 1,
      };
      for (const key of ICON_FIELDS)
        if (key !== "name" && body[key] != null) icon[key] = body[key];
      db.icons.push(icon);
      return created(withCampusName(db, iconView(icon)));
    },
    "CURATOR",
  );

  route(
    "PATCH",
    "/icons/:id",
    ({ db, params, body = {} }) => {
      const icon = byId(db.icons, params.id) ?? notFound("that icon");
      checkVersion(icon, body);
      for (const key of ICON_FIELDS)
        if (body[key] !== undefined) icon[key] = body[key];
      return withCampusName(db, iconView(icon));
    },
    "CURATOR",
  );

  route(
    "PUT",
    "/icons/:id/photo",
    ({ db, params, files }) => {
      const icon = byId(db.icons, params.id) ?? notFound("that icon");
      icon.photo = imageFromUpload(files);
      icon.version += 1;
      return withCampusName(db, iconView(icon));
    },
    "CURATOR",
  );

  route(
    "DELETE",
    "/icons/:id",
    ({ db, params }) => {
      db.icons = db.icons.filter((i) => i.id !== params.id);
      return noContent();
    },
    "CURATOR",
  );

  // ---------- Team entries ----------
  route(
    "GET",
    "/team-entries",
    ({ db, query }) =>
      db.teamEntries
        .filter((t) => inScope(t, query))
        .sort((a, b) => a.rank - b.rank),
    "CURATOR",
  );

  route(
    "POST",
    "/team-entries",
    ({ db, body = {} }) => {
      if (!TEAM_ENTRY_TYPES.includes(body.type))
        invalid("type", "Choose coach, advisor or ambassador");
      const entry = {
        id: newId(),
        campusId: body.campusId ?? null,
        type: body.type,
        fullName: requireText(body, "fullName", 100),
        rank: body.rank ?? db.teamEntries.length + 1,
        version: 1,
      };
      db.teamEntries.push(entry);
      return created(entry);
    },
    "CURATOR",
  );

  route(
    "PATCH",
    "/team-entries/:id",
    ({ db, params, body = {} }) => {
      const entry = byId(db.teamEntries, params.id) ?? notFound("that entry");
      checkVersion(entry, body);
      if (body.type !== undefined && !TEAM_ENTRY_TYPES.includes(body.type))
        invalid("type", "Choose coach, advisor or ambassador");
      for (const key of ["type", "fullName", "rank"])
        if (body[key] !== undefined) entry[key] = body[key];
      return entry;
    },
    "CURATOR",
  );

  route(
    "DELETE",
    "/team-entries/:id",
    ({ db, params }) => {
      db.teamEntries = db.teamEntries.filter((t) => t.id !== params.id);
      return noContent();
    },
    "CURATOR",
  );
}
