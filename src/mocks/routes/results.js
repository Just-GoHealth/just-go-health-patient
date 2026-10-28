/**
 * Results, NSMQ runs and care cases for staff (contract 4c, 4d), and
 * notifications for any signed-in role (4f).
 */
import {
  DAY,
  bool,
  created,
  fail,
  forbidden,
  initials,
  int,
  invalid,
  iso,
  newId,
  noContent,
  notFound,
  pageOf,
} from "../core.js";
import { careCaseView, staffRun } from "../nsmq-engine.js";
import { notifyCampusProviders } from "../events.js";
import {
  assertCampus,
  assertResult,
  byId,
  notificationView,
  providerName,
  resultDetail,
  resultItem,
  resultsAt,
} from "../views.js";

const PERIOD_DAYS = { WEEK: 7, MONTH: 30, YEAR: 365 };
const BAND_ORDER = [
  "Perfect",
  "Good",
  "Average",
  "Poor",
  "Very Poor",
  "ASAP",
  "NOW",
  "911",
];
const LOCK_BAND = {
  PURPLE: "Perfect",
  GREEN: "Good",
  LIGHT_GREEN: "Average",
  RED: "Poor",
  BLACK: "Very Poor",
};

function periodStart(period, now = new Date()) {
  if (period === "TODAY")
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (!PERIOD_DAYS[period])
    fail(400, "MALFORMED_REQUEST", `Unknown period "${period}".`);
  return now.getTime() - PERIOD_DAYS[period] * DAY;
}

function applyFilters(list, query, search) {
  const active = bool(query.active);
  if (active !== undefined) list = list.filter((r) => r.active === active);
  if (query.period) {
    const since = periodStart(query.period);
    list = list.filter((r) => Date.parse(r.createdAt) >= since);
  }
  if (query.variant) list = list.filter((r) => r.variant === query.variant);
  if (query.ageFrom)
    list = list.filter((r) => r.age != null && r.age >= int(query.ageFrom, 0));
  if (query.ageTo)
    list = list.filter((r) => r.age != null && r.age <= int(query.ageTo, 200));
  if (query.gender) list = list.filter((r) => r.gender === query.gender);
  if (query.year) list = list.filter((r) => r.yearLabel === query.year);
  const outcomes = search.getAll("outcome");
  if (outcomes.length) {
    list = list.filter((r) =>
      outcomes.every((o) => {
        const [code, band] = o.split(":");
        return r.outcomes.some(
          (x) => x.sectionCode === code && x.band === band,
        );
      }),
    );
  }
  const awaiting = bool(query.awaiting);
  if (awaiting !== undefined)
    list = list.filter((r) => !r.acceptedAt === awaiting);
  return list;
}

function bands(list, keyOf) {
  const counts = new Map();
  for (const r of list) {
    const key = keyOf(r);
    if (!key) continue;
    const entry = counts.get(key.band) ?? {
      band: key.band,
      colour: key.colour ?? null,
      count: 0,
    };
    entry.count += 1;
    counts.set(key.band, entry);
  }
  return [...counts.values()]
    .map((b) => ({
      ...b,
      percent: list.length
        ? Math.round((b.count * 1000) / list.length) / 10
        : 0,
    }))
    .sort((a, b) => BAND_ORDER.indexOf(a.band) - BAND_ORDER.indexOf(b.band));
}

function summary(list) {
  const codes = [];
  for (const r of list) {
    for (const o of r.outcomes) {
      if (!codes.some((c) => c.sectionCode === o.sectionCode)) codes.push(o);
    }
  }
  const sections = codes.map((o) => ({
    sectionCode: o.sectionCode,
    title: o.sectionTitle,
    parentCode: o.parentCode,
    outcomes: bands(list, (r) =>
      r.outcomes.find((x) => x.sectionCode === o.sectionCode),
    ),
  }));
  const startOf = (period) => periodStart(period);
  const count = (period) =>
    list.filter((r) => Date.parse(r.createdAt) >= startOf(period)).length;
  return {
    total: list.length,
    lockedIn: bands(
      list.filter((r) => r.lockedIn),
      (r) => ({
        band: LOCK_BAND[r.lockedIn.colour],
        colour: r.lockedIn.colour,
      }),
    ),
    sections,
    suicidality: bands(list, (r) =>
      r.suicidality ? { band: r.suicidality, colour: null } : null,
    ),
    ranking: sections
      .flatMap((s) =>
        s.outcomes
          .filter((b) => ["Poor", "Very Poor", "NOW", "911"].includes(b.band))
          .map((b) => ({
            sectionCode: s.sectionCode,
            title: s.title,
            band: b.band,
            count: b.count,
          })),
      )
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    groups: {
      TODAY: count("TODAY"),
      WEEK: count("WEEK"),
      MONTH: count("MONTH"),
      YEAR: count("YEAR"),
      ALL: list.length,
    },
  };
}

function averages(results) {
  const sums = {};
  for (const r of results) {
    for (const o of r.outcomes) {
      if (o.score == null || o.sectionCode === "TAG") continue;
      const s = (sums[o.sectionCode] ??= { total: 0, count: 0 });
      s.total += o.score;
      s.count += 1;
    }
  }
  return Object.fromEntries(
    Object.entries(sums).map(([code, s]) => [
      code,
      {
        average: s.count ? Math.round((s.total / s.count) * 10) / 10 : null,
        count: s.count,
      },
    ]),
  );
}

const visibleCampusResults = (db, account) =>
  db.campuses.flatMap((c) => {
    try {
      assertCampus(db, account, c.id);
      return resultsAt(db, account, c.id);
    } catch {
      return [];
    }
  });

function acceptResult(db, r) {
  r.acceptedAt = iso();
  notifyCampusProviders(db, r.campusId, {
    type: "NEW_RESULTS",
    title: `New results at ${byId(db.campuses, r.campusId)?.fullName ?? "your school"}`,
    body: "A new result is ready to view.",
    data: { campusId: r.campusId, count: 1 },
  });
}

export function register(route) {
  // ---------- Results ----------
  route(
    "GET",
    "/campuses/:id/results",
    ({ db, account, params, query, search }) => {
      assertCampus(db, account, params.id);
      const list = applyFilters(
        resultsAt(db, account, params.id),
        query,
        search,
      ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return pageOf(list, query, resultItem);
    },
    "STAFF",
  );

  route(
    "GET",
    "/campuses/:id/results/summary",
    ({ db, account, params, query, search }) => {
      assertCampus(db, account, params.id);
      return summary(
        applyFilters(resultsAt(db, account, params.id), query, search),
      );
    },
    "STAFF",
  );

  route(
    "POST",
    "/campuses/:id/results/accept-all",
    ({ db, params }) => {
      assertCampus(db, { role: "CURATOR" }, params.id);
      const waiting = db.results.filter(
        (r) => r.campusId === params.id && !r.acceptedAt,
      );
      waiting.forEach((r) => acceptResult(db, r));
      return { accepted: waiting.length };
    },
    "CURATOR",
  );

  route(
    "GET",
    "/results/urgent",
    ({ db, account, query }) => {
      const list = query.campusId
        ? (assertCampus(db, account, query.campusId),
          resultsAt(db, account, query.campusId))
        : visibleCampusResults(db, account);
      return list
        .filter(
          (r) => (r.urgent || r.attention) && r.active && !r.treatingStartedAt,
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map(resultItem);
    },
    "STAFF",
  );

  route(
    "GET",
    "/benchmarks",
    ({ db, account, query }) => {
      const out = {
        overall: { averages: averages(db.results.filter((r) => r.acceptedAt)) },
      };
      if (query.campusId) {
        assertCampus(db, account, query.campusId);
        out.campus = {
          id: query.campusId,
          averages: averages(resultsAt(db, account, query.campusId)),
        };
      }
      const type =
        query.campusType ??
        (query.campusId ? byId(db.campuses, query.campusId).type : null);
      if (type) {
        const ids = new Set(
          db.campuses.filter((c) => c.type === type).map((c) => c.id),
        );
        out.campusType = {
          type,
          averages: averages(
            db.results.filter((r) => r.acceptedAt && ids.has(r.campusId)),
          ),
        };
      }
      return out;
    },
    "STAFF",
  );

  route(
    "GET",
    "/results/:id",
    ({ db, account, params }) => {
      const r = assertResult(db, account, params.id);
      // Opening a result records the view.
      if (account.role === "PROVIDER") {
        const p = byId(db.providers, account.providerId);
        r.lastProviderView = {
          providerId: p.id,
          name: providerName(p),
          initials: initials(p.fullName),
          at: iso(),
        };
        r.seen = true;
      }
      return resultDetail(db, r);
    },
    "STAFF",
  );

  route(
    "PATCH",
    "/results/:id",
    ({ db, account, params, body }) => {
      const r = assertResult(db, account, params.id);
      if (typeof body?.active !== "boolean")
        invalid("active", "Send active: true or false");
      r.active = body.active;
      return resultDetail(db, r);
    },
    "STAFF",
  );

  route(
    "PUT",
    "/results/:id/care",
    ({ db, account, params, body = {} }) => {
      const r = assertResult(db, account, params.id);
      const me = byId(db.providers, account.providerId);
      if (body.status === "TREATING") {
        r.care = r.care.filter((c) => c.providerId !== me.id);
        r.care.push({
          providerId: me.id,
          name: providerName(me),
          status: "TREATING",
          referredBy: null,
          at: iso(),
        });
        r.treatingStartedAt ??= iso();
      } else if (body.status === "REFERRED") {
        const to = byId(db.providers, body.referToProviderId);
        if (!to) invalid("referToProviderId", "Choose who to refer to");
        r.care = r.care.filter((c) => c.providerId !== to.id);
        r.care.push({
          providerId: to.id,
          name: providerName(to),
          status: "REFERRED",
          referredBy: me.id,
          at: iso(),
        });
      } else {
        invalid("status", "Choose TREATING or REFERRED");
      }
      return resultDetail(db, r);
    },
    "PROVIDER",
  );

  route(
    "GET",
    "/results/:id/comments",
    ({ db, account, params }) =>
      [...assertResult(db, account, params.id).comments].sort((a, b) =>
        a.at.localeCompare(b.at),
      ),
    "STAFF",
  );

  route(
    "POST",
    "/results/:id/comments",
    ({ db, account, params, body }) => {
      const r = assertResult(db, account, params.id);
      const text = typeof body?.body === "string" ? body.body.trim() : "";
      if (!text) invalid("body", "Write a comment");
      if (text.length > 2000) invalid("body", "Use 2000 characters or fewer");
      const comment = {
        id: newId(),
        authorAccountId: account.id,
        body: text,
        at: iso(),
      };
      r.comments.push(comment);
      return created(comment);
    },
    "STAFF",
  );

  route(
    "POST",
    "/results/:id/accept",
    ({ db, account, params }) => {
      const r = assertResult(db, account, params.id);
      if (!r.acceptedAt) acceptResult(db, r);
      return resultDetail(db, r);
    },
    "CURATOR",
  );

  // ---------- NSMQ runs and care cases ----------
  route("GET", "/runs/untagged", () => [], "CURATOR");

  route(
    "GET",
    "/runs/:id",
    ({ db, account, params }) => {
      const run = byId(db.runs, params.id) ?? notFound("that run");
      assertCampus(db, account, run.campusId);
      return staffRun(db, run);
    },
    "STAFF",
  );

  route(
    "GET",
    "/care-cases",
    ({ db, account, query }) => {
      if (!query.campusId)
        fail(400, "MALFORMED_REQUEST", "campusId is required.");
      assertCampus(db, account, query.campusId);
      const standing = (c) =>
        c.effectiveTag === "911" && !c.clearedAt ? 0 : 1;
      return db.careCases
        .filter((c) => c.campusId === query.campusId)
        .sort(
          (a, b) =>
            standing(a) - standing(b) || b.updatedAt.localeCompare(a.updatedAt),
        )
        .map((c) => careCaseView(db, c));
    },
    "STAFF",
  );

  route(
    "GET",
    "/care-cases/:id/clearances",
    ({ db, account, params }) => {
      const c = byId(db.careCases, params.id) ?? notFound("that care case");
      assertCampus(db, account, c.campusId);
      return c.clearances;
    },
    "STAFF",
  );

  route(
    "POST",
    "/care-cases/:id/clear",
    ({ db, account, params, body }) => {
      const c = byId(db.careCases, params.id) ?? notFound("that care case");
      assertCampus(db, account, c.campusId);
      const counsellor = db.campusProviders.some(
        (l) =>
          l.campusId === c.campusId &&
          l.providerId === account.providerId &&
          l.nsmqCounsellor,
      );
      if (!counsellor)
        forbidden("Only this school's NSMQ counsellor can clear a 911.");
      if (c.effectiveTag !== "911" || c.clearedAt)
        fail(409, "NOT_A_STANDING_911", "This student has no standing 911.");
      const note = typeof body?.note === "string" ? body.note.trim() : "";
      if (!note) invalid("note", "Say why it's safe to clear");
      if (note.length > 2000) invalid("note", "Use 2000 characters or fewer");
      c.clearedAt = iso();
      c.updatedAt = c.clearedAt;
      c.clearances.push({
        clearedBy: account.id,
        note,
        clearedAt: c.clearedAt,
        runId: c.sourceRunId,
      });
      return careCaseView(db, c);
    },
    "STAFF",
  );

  // ---------- Notifications ----------
  route(
    "GET",
    "/me/notifications",
    ({ db, account, query }) => {
      const unread = bool(query.unread);
      const list = db.notifications
        .filter(
          (n) =>
            n.accountId === account.id &&
            (!unread || !n.readAt) &&
            (!query.campusId || n.campusId === query.campusId),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return pageOf(list, query, notificationView);
    },
    "any",
  );

  route(
    "GET",
    "/me/notifications/counts",
    ({ db, account }) => {
      const unread = db.notifications.filter(
        (n) => n.accountId === account.id && !n.readAt,
      );
      const perCampus = new Map();
      for (const n of unread) {
        if (n.campusId)
          perCampus.set(n.campusId, (perCampus.get(n.campusId) ?? 0) + 1);
      }
      return {
        total: unread.length,
        campuses: [...perCampus].map(([campusId, count]) => ({
          campusId,
          unread: count,
        })),
      };
    },
    "any",
  );

  route(
    "POST",
    "/me/notifications/read-all",
    ({ db, account, query }) => {
      for (const n of db.notifications) {
        if (
          n.accountId === account.id &&
          !n.readAt &&
          (!query.campusId || n.campusId === query.campusId)
        )
          n.readAt = iso();
      }
      return noContent();
    },
    "any",
  );

  route(
    "POST",
    "/me/notifications/:id/read",
    ({ db, account, params }) => {
      const n = db.notifications.find(
        (x) => x.id === params.id && x.accountId === account.id,
      );
      if (!n) notFound("that notification");
      n.readAt ??= iso();
      return noContent();
    },
    "any",
  );
}
