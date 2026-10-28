/**
 * In-app notifications and the live stream (GET /me/stream). MSW's `sse`
 * handler hands each EventSource a client; named events go to every open
 * client for that account.
 */
import { iso, newId } from "./core.js";
import {
  attachedCampusIds,
  byId,
  curatorAccounts,
  providerAccount,
} from "./views.js";

const clients = new Map(); // accountId → Set<ServerSentEventClient>
let eventSeq = 0;

export function emit(accountId, name, data) {
  eventSeq += 1;
  for (const client of clients.get(accountId) ?? []) {
    try {
      client.send({ id: String(eventSeq), event: name, data });
    } catch {
      clients.get(accountId)?.delete(client);
    }
  }
}

export function openStream(accountId, client) {
  const set = clients.get(accountId) ?? new Set();
  set.add(client);
  clients.set(accountId, set);
}

// ---------- Notifications ----------

export const unreadCount = (db, accountId) =>
  db.notifications.filter((n) => n.accountId === accountId && !n.readAt).length;

export function notify(db, accountId, n) {
  const notification = {
    id: newId(),
    accountId,
    campusId: n.campusId ?? null,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link ?? null,
    data: n.data ?? {},
    readAt: n.read ? (n.at ?? iso()) : null,
    createdAt: n.at ?? iso(),
  };
  db.notifications.push(notification);
  emit(accountId, "notification", {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    campusId: notification.campusId,
    unread: unreadCount(db, accountId),
  });
  return notification;
}

/** Provider notifications always have campusId null (the campus goes in `data`). */
export function notifyProvider(db, providerId, n) {
  const acc = providerAccount(db, providerId);
  if (acc) notify(db, acc.id, { ...n, campusId: null });
}

export function notifyCampusProviders(db, campusId, n) {
  for (const p of db.providers) {
    if (
      p.status === "APPROVED" &&
      attachedCampusIds(db, p.id).includes(campusId)
    ) {
      notifyProvider(db, p.id, n);
    }
  }
}

export function notifyCurators(db, n) {
  for (const acc of curatorAccounts(db)) notify(db, acc.id, n);
}

/** The curator's Just In badge changed. */
export function emitJustIn(db, targetId = null) {
  const pending = db.joinRequests.filter((r) => r.status === "PENDING").length;
  for (const acc of curatorAccounts(db)) {
    emit(acc.id, "just-in", { pending, targetId });
  }
}

/** A provider's application was decided: the app moves them on at once. */
export function emitProviderStatus(db, providerId) {
  const p = byId(db.providers, providerId);
  const acc = providerAccount(db, providerId);
  if (!p || !acc) return;
  emit(acc.id, "provider-status", {
    status: p.status,
    next: p.status === "APPROVED" ? "HOME" : "REJECTED",
  });
}
