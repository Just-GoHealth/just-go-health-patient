/**
 * The "MOCK API" button in the bottom-left corner: the test logins, which
 * NSMQ check-in is due, and a reset. Plain DOM so it works in any app.
 */
import { mockControls } from "./handlers.js";
import { ACCESS_CODE_LENGTH } from "./nsmq-engine.js";
import { CODE } from "./routes/auth.js";
import { PASSWORD } from "./seed.js";

const DUE_OPTIONS = [
  ["D1", "D-1"],
  ["T3", "T-3"],
  ["TPLUS", "T+"],
  ["NONE", "None"],
];

const escape = (text) =>
  String(text).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

function teamCodes(db) {
  return db.teams
    .filter((t) => t.versionCode === "nsmq2026")
    .map((t) => {
      const campus = db.campuses.find((c) => c.id === t.campusId);
      const code = db.codes.find(
        (c) => c.teamId === t.id && c.status === "ISSUED",
      );
      return `${escape(campus?.nicknames[0] ?? "Team")}: <code>${escape(code?.code ?? "none left")}</code>`;
    })
    .join(" · ");
}

function render(sheet, roles) {
  const db = mockControls.db();
  const rows = db.logins
    .filter((l) => roles.includes(l.role))
    .map(
      (l) => `<tr>
        <td style="padding:3px 6px;color:#6b7280">${l.role.toLowerCase()}</td>
        <td style="padding:3px 6px"><button data-copy="${escape(l.contact)}" title="Copy" style="all:unset;cursor:pointer;font-family:ui-monospace,monospace;color:#1d4ed8">${escape(l.contact)}</button></td>
        <td style="padding:3px 6px">${escape(l.note)}</td>
      </tr>`,
    )
    .join("");
  const dueButtons = DUE_OPTIONS.map(
    ([kind, label]) =>
      `<button data-due="${kind}" style="padding:3px 8px;border:1px solid #d1d5db;border-radius:6px;cursor:pointer;background:${db.dueMode === kind ? "#111827" : "#fff"};color:${db.dueMode === kind ? "#fff" : "#111827"}">${label}</button>`,
  ).join(" ");
  sheet.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <strong style="font-size:13px">Mock API: fake data, nothing is sent anywhere</strong>
      <button data-close style="all:unset;cursor:pointer;font-size:16px;padding:0 4px">×</button>
    </div>
    <p style="margin:0 0 6px">Password for every account: <code>${PASSWORD}</code> · Verification codes: nothing is sent; type any 6 digits, e.g. <code>${CODE}</code></p>
    <table style="border-collapse:collapse;width:100%;margin-bottom:8px">${rows}</table>
    <p style="margin:0 0 4px">NSMQ access code: <strong>any ${ACCESS_CODE_LENGTH} digits</strong> join the school you picked, e.g. <code>123456789</code> (letters are refused, to see the error). Issued codes per team:<br>${teamCodes(db)}</p>
    <p style="margin:8px 0 4px">NSMQ 2026 check-in due now: ${dueButtons}</p>
    <div style="display:flex;gap:6px;margin-top:10px">
      <button data-signout style="padding:4px 10px;border:1px solid #d1d5db;border-radius:6px;cursor:pointer;background:#fff">Sign out</button>
      <button data-reset style="padding:4px 10px;border:1px solid #fca5a5;border-radius:6px;cursor:pointer;background:#fef2f2;color:#991b1b">Reset all data</button>
    </div>`;
}

/** @param {{ roles: string[] }} options which roles' logins to list */
export function mountPanel({ roles }) {
  if (document.getElementById("jg-mock-panel")) return;
  const root = document.createElement("div");
  root.id = "jg-mock-panel";
  // A slim tab on the right edge, clear of the apps' bottom buttons and the
  // Next.js dev badge (bottom-left).
  root.style.cssText =
    "position:fixed;right:0;top:30%;z-index:2147483647;display:flex;flex-direction:row-reverse;align-items:flex-start;font:12px/1.45 system-ui,-apple-system,sans-serif;color:#111827";

  const toggle = document.createElement("button");
  toggle.textContent = "MOCK API";
  toggle.style.cssText =
    "writing-mode:vertical-rl;transform:rotate(180deg);padding:10px 4px;border-radius:0 8px 8px 0;border:0;background:#b45309;color:#fff;font-size:10px;font-weight:700;letter-spacing:.08em;cursor:pointer;opacity:.85;box-shadow:0 2px 8px rgba(0,0,0,.25)";

  const sheet = document.createElement("div");
  sheet.style.cssText =
    "display:none;width:min(560px,calc(100vw - 40px));max-height:65vh;overflow:auto;margin-right:6px;padding:12px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.25)";

  toggle.addEventListener("click", () => {
    const open = sheet.style.display === "none";
    if (open) render(sheet, roles);
    sheet.style.display = open ? "block" : "none";
  });

  sheet.addEventListener("click", async (event) => {
    const el = event.target.closest("button");
    if (!el) return;
    if (el.dataset.close !== undefined) sheet.style.display = "none";
    if (el.dataset.copy) {
      await navigator.clipboard?.writeText(el.dataset.copy).catch(() => {});
      el.textContent = "copied ✓";
      setTimeout(() => (el.textContent = el.dataset.copy), 900);
    }
    if (el.dataset.due) {
      mockControls.setDue(el.dataset.due);
      location.reload();
    }
    if (el.dataset.signout !== undefined) {
      mockControls.signOut();
      location.replace(location.origin);
    }
    if (
      el.dataset.reset !== undefined &&
      confirm("Reset all mock data and sign out?")
    ) {
      mockControls.reset();
      location.replace(location.origin);
    }
  });

  root.append(sheet, toggle);
  document.body.append(root);
}
