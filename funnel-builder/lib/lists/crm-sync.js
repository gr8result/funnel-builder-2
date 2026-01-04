// /lib/lists/crm-sync.js
// Per-list setting + helper to auto-create CRM contact from a new subscriber.

let db = null;
try { db = require("@/lib/db/supabase.js"); } catch (_) {}

const SETTINGS_KEY = "list_settings_v1"; // { [listId]: { autoAddToCRM: boolean } }
const LOCAL_KEY = "crm_contacts_v1";

// ---- settings ----
export function setAutoAddToCRM(listId, enabled) {
  const all = loadSettings();
  all[listId] = { ...(all[listId] || {}), autoAddToCRM: !!enabled };
  saveSettings(all);
}
export function getAutoAddToCRM(listId) {
  return !!(loadSettings()[listId]?.autoAddToCRM);
}
function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"); } catch { return {}; }
}
function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

// ---- main entry: call this when a subscriber is created in a list ----
export async function maybeAddToCRM(listId, sub) {
  if (!getAutoAddToCRM(listId)) return { ok: true, skipped: true };
  const payload = normalise(sub);

  // Try to find an existing contact by email/phone (local or remote)
  const existing = await findExisting(payload.email, payload.phone);

  if (existing) {
    // just log a note so team sees the linkage
    await addActivity(existing.id, {
      type: "note",
      text: `Subscriber re-captured in list "${listId}".`,
      ts: Date.now(),
    });
    return { ok: true, id: existing.id, deduped: true };
  }

  const created = await upsertContact({
    id: rid(),
    name: [payload.firstName, payload.lastName].filter(Boolean).join(" "),
    email: payload.email || "",
    phone: payload.phone || "",
    company: payload.company || "",
    tags: ["Subscriber", `List:${listId}`],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    timeline: [],
  });

  await addActivity(created.id, {
    type: "note",
    text: `Added from List "${listId}" via auto-add.`,
    ts: Date.now(),
  });

  // Seed handy spreadsheet fields (address, position) into the custom map
  touchCustom(created.id, {
    _address: payload.address || "",
    _position: payload.position || "",
    _status: "New",
    _last_type: "",
    _last_date: "",
  });

  return { ok: true, id: created.id };
}

// ---- adapters (Supabase or local) ----
async function upsertContact(contact) {
  if (db && db.isRemote && db.isRemote()) return await db.upsertContact(contact);
  // local
  const all = loadLocal();
  const ix = all.findIndex((c) => c.id === contact.id);
  if (ix >= 0) all[ix] = contact; else all.unshift(contact);
  saveLocal(all);
  return contact;
}
async function addActivity(contactId, ev) {
  if (db && db.isRemote && db.isRemote()) return await db.addActivity(contactId, ev);
  const all = loadLocal();
  const ix = all.findIndex((c) => c.id === contactId);
  if (ix < 0) return null;
  const c = all[ix];
  c.timeline = [{ id: rid(), ...ev }, ...(c.timeline || [])];
  c.updatedAt = ev.ts || Date.now();
  all[ix] = c;
  saveLocal(all);
  return ev;
}
async function findExisting(email, phone) {
  const all = db && db.isRemote && db.isRemote()
    ? await db.listContacts({ sortBy: "updatedAt" })
    : loadLocal();

  const e = (email || "").trim().toLowerCase();
  const p = normalisePhone(phone);
  return all.find((c) =>
    (e && c.email?.toLowerCase() === e) || (p && normalisePhone(c.phone) === p)
  );
}

// ---- local utils ----
function loadLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]") || []; } catch { return []; }
}
function saveLocal(arr) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(arr)); } catch {}
}
function rid() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const a = new Uint32Array(2); crypto.getRandomValues(a);
    return [...a].map((n) => n.toString(36)).join("");
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function normalise(sub) {
  return {
    firstName: sub.firstName || sub.first_name || sub.given_name || "",
    lastName: sub.lastName || sub.last_name || sub.family_name || "",
    email: sub.email || "",
    phone: sub.phone || sub.mobile || "",
    company: sub.company || "",
    position: sub.position || sub.title || "",
    address: sub.address || sub.physicalAddress || "",
  };
}
function normalisePhone(s) { return String(s || "").replace(/\D+/g, ""); }

// ---- custom values used by the spreadsheet dashboard ----
const COLS_VALUES_KEY = "crm_custom_values_v1";
function loadCustom() {
  try { return JSON.parse(localStorage.getItem(COLS_VALUES_KEY) || "{}") || {}; } catch { return {}; }
}
function saveCustom(map) {
  try { localStorage.setItem(COLS_VALUES_KEY, JSON.stringify(map)); } catch {}
}
function touchCustom(contactId, kv) {
  const map = loadCustom();
  map[contactId] = { ...(map[contactId] || {}), ...kv };
  saveCustom(map);
}




