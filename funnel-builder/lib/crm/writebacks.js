// /lib/crm/writebacks.js
// Email → CRM write-backs (client-side, offline-friendly)
// Logs: email:sent, email:open, email:click into each contact's timeline.
// Storage: same as CRM module (localStorage key: crm_contacts_v1)

const STORAGE_KEY = "crm_contacts_v1";

// ---------- public API ----------
export function onEmailSent(contactId, meta = {}) {
  return appendActivity(contactId, "email:sent", meta);
}

export function onEmailOpen(contactId, meta = {}) {
  return appendActivity(contactId, "email:open", meta);
}

export function onEmailClick(contactId, meta = {}) {
  return appendActivity(contactId, "email:click", meta);
}

// Optional batch helper (e.g., broadcast to many contacts)
export function onEmailSentBatch(contactIds = [], meta = {}) {
  return appendActivityBatch(contactIds, "email:sent", meta);
}

// ---------- internals ----------
function appendActivity(contactId, type, meta) {
  if (!contactId) return { ok: false, error: "Missing contactId" };
  const { contacts, ix } = loadContactsFor(contactId);
  if (ix < 0) return { ok: false, error: "Contact not found" };

  const now = Date.now();
  const ev = {
    id: rid(),
    type,                                // "email:sent" | "email:open" | "email:click"
    ts: now,
    text: label(type, meta),             // short human line for timeline
    meta: sanitizeMeta(meta),            // keep raw details for later (campaignsId, templateId, url, etc.)
  };

  contacts[ix] = {
    ...contacts[ix],
    updatedAt: now,
    timeline: [ev, ...(contacts[ix].timeline || [])],
  };

  saveContacts(contacts);
  return { ok: true, event: ev };
}

function appendActivityBatch(contactIds, type, meta) {
  if (!Array.isArray(contactIds) || contactIds.length === 0)
    return { ok: false, error: "Empty contactIds" };

  const contacts = loadContacts();
  const now = Date.now();
  let count = 0;

  for (const id of contactIds) {
    const ix = contacts.findIndex((c) => c && c.id === id);
    if (ix < 0) continue;

    const ev = {
      id: rid(),
      type,
      ts: now,
      text: label(type, meta),
      meta: sanitizeMeta(meta),
    };

    contacts[ix] = {
      ...contacts[ix],
      updatedAt: now,
      timeline: [ev, ...(contacts[ix].timeline || [])],
    };
    count++;
  }

  saveContacts(contacts);
  return { ok: true, count };
}

// ---------- storage ----------
function loadContacts() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function saveContacts(contacts) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
  } catch {
    // ignore
  }
}
function loadContactsFor(contactId) {
  const contacts = loadContacts();
  const ix = contacts.findIndex((c) => c && c.id === contactId);
  return { contacts, ix };
}

// ---------- utils ----------
function label(type, meta) {
  const campaigns = meta?.campaignsName || meta?.campaignsId || "campaigns";
  const template = meta?.templateName || meta?.templateId;
  const url = meta?.url;

  switch (type) {
    case "email:sent":
      return template ? `Email sent (${campaigns} · ${template})` : `Email sent (${campaigns})`;
    case "email:open":
      return `Email opened${meta?.ip ? ` · ${meta.ip}` : ""}`;
    case "email:click":
      return `Link clicked${url ? ` · ${truncate(url, 64)}` : ""}`;
    default:
      return "Email activity";
  }
}

function sanitizeMeta(meta) {
  const allowed = ["campaignsId", "campaignsName", "templateId", "templateName", "messageId", "url", "ip", "ua"];
  const out = {};
  for (const k of allowed) if (meta && k in meta) out[k] = meta[k];
  return out;
}

function truncate(s, n) {
  if (!s) return s;
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function rid() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const a = new Uint32Array(2);
    crypto.getRandomValues(a);
    return [...a].map((n) => n.toString(36)).join("");
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}




