// /lib/db/supabase.js
// Supabase adapter with safe local fallback.
// If NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are missing,
// this module quietly uses localStorage so the app still works offline.

let supabase = null;
try {
  const { createClient } = require("@supabase/supabase-js");
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (URL && KEY) supabase = createClient(URL, KEY, { auth: { persistSession: true } });
} catch (_) {
  // package not installed or running on server without deps — fallback will handle it
}

const LS_KEY = "crm_contacts_v1"; // same as current CRM

// ---------- Public API ----------
module.exports = {
  // Tell UI whether we’re talking to Supabase or local
  isRemote: () => Boolean(supabase),

  // Contacts
  async listContacts({ search = "", sortBy = "updatedAt" } = {}) {
    if (!supabase) return listContactsLocal({ search, sortBy });

    let q = supabase.from("contacts").select("*").order(sortBy === "name" ? "name" : "updated_at", { ascending: sortBy === "name" });
    if (search?.trim()) {
      const s = `%${search.trim()}%`;
      q = q.or(`name.ilike.${s},email.ilike.${s},phone.ilike.${s},company.ilike.${s}`);
    }
    const { data, error } = await q;
    if (error) throw error;
    // normalise to current client shape
    return (data || []).map(rowToContact);
  },

  async getContact(id) {
    if (!supabase) return getContactLocal(id);
    const { data, error } = await supabase.from("contacts").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? rowToContact(data) : null;
  },

  async upsertContact(contact) {
    if (!supabase) return upsertContactLocal(contact);

    const payload = contactToRow(contact);
    const { data, error } = await supabase.from("contacts").upsert(payload).select().maybeSingle();
    if (error) throw error;
    return rowToContact(data);
  },

  // Activities (timeline)
  async listActivities(contactId, { limit = 200 } = {}) {
    if (!supabase) return listActivitiesLocal(contactId, { limit });

    const { data, error } = await supabase
      .from("activities")
      .select("*")
      .eq("contact_id", contactId)
      .order("ts", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(rowToActivity);
  },

  async addActivity(contactId, activity) {
    if (!supabase) return addActivityLocal(contactId, activity);

    const payload = {
      id: activity.id || rid(),
      contact_id: contactId,
      type: activity.type,
      text: activity.text || null,
      meta: activity.meta || null,
      ts: toIso(activity.ts) || new Date().toISOString(),
    };
    const { data, error } = await supabase.from("activities").insert(payload).select().maybeSingle();
    if (error) throw error;
    // bump contact.updated_at
    await supabase.from("contacts").update({ updated_at: payload.ts }).eq("id", contactId);
    return rowToActivity(data);
  },

  // Email events (optional direct log)
  async logEmailEvent(contactId, { campaignId = null, event, url = null, ts = Date.now() } = {}) {
    if (!supabase) {
      // still write as a timeline item so UI stays consistent
      return addActivityLocal(contactId, { type: `email:${event}`, text: url ? `Link ${event} · ${url}` : `Email ${event}`, ts });
    }
    const payload = {
      id: rid(),
      contact_id: contactId,
      campaign_id: campaignId,
      event,
      url,
      ts: toIso(ts),
    };
    const { error } = await supabase.from("email_events").insert(payload);
    if (error) throw error;
    // also mirror into activities for the timeline UX
    return module.exports.addActivity(contactId, { type: `email:${event}`, text: url ? `Link ${event} · ${url}` : `Email ${event}`, ts });
  },

  // Migration helper: push localStorage to Supabase (run once)
  async migrateLocalToSupabase() {
    if (!supabase) return { ok: false, reason: "Supabase not configured" };
    const local = loadLocal();
    // upsert contacts
    if (local.length) {
      const rows = local.map(contactToRow);
      const { error } = await supabase.from("contacts").upsert(rows);
      if (error) throw error;
    }
    // upsert activities
    for (const c of local) {
      for (const ev of c.timeline || []) {
        const payload = {
          id: ev.id || rid(),
          contact_id: c.id,
          type: ev.type || "note",
          text: ev.text || null,
          meta: ev.meta || null,
          ts: toIso(ev.ts) || new Date().toISOString(),
        };
        await supabase.from("activities").upsert(payload);
      }
    }
    return { ok: true, count: local.length };
  },
};

// ---------- Local fallback (keeps you offline-capable) ----------
function loadLocal() {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(LS_KEY) : "[]";
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveLocal(arr) {
  try { if (typeof window !== "undefined") window.localStorage.setItem(LS_KEY, JSON.stringify(arr)); } catch {}
}

async function listContactsLocal({ search = "", sortBy = "updatedAt" } = {}) {
  const all = loadLocal();
  const q = search.trim().toLowerCase();
  const base = q
    ? all.filter(c => [c.name, c.email, c.phone, c.company].filter(Boolean).some(v => v.toLowerCase().includes(q)))
    : all.slice();
  base.sort((a, b) => (sortBy === "name" ? String(a.name).localeCompare(String(b.name)) : b.updatedAt - a.updatedAt));
  return base;
}
async function getContactLocal(id) {
  return loadLocal().find(c => c.id === id) || null;
}
async function upsertContactLocal(contact) {
  const all = loadLocal();
  const ix = all.findIndex(c => c.id === contact.id);
  const now = Date.now();
  const next = { ...contact, updatedAt: contact.updatedAt || now, createdAt: contact.createdAt || now };
  if (ix >= 0) all[ix] = next; else all.unshift(next);
  saveLocal(all);
  return next;
}
async function listActivitiesLocal(contactId, { limit = 200 } = {}) {
  const c = loadLocal().find(x => x.id === contactId);
  const arr = (c?.timeline || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return arr.slice(0, limit);
}
async function addActivityLocal(contactId, activity) {
  const all = loadLocal();
  const ix = all.findIndex(c => c.id === contactId);
  if (ix < 0) return null;
  const ev = { id: activity.id || rid(), type: activity.type || "note", text: activity.text || null, meta: activity.meta || null, ts: activity.ts || Date.now() };
  const c = all[ix];
  c.timeline = [ev, ...(c.timeline || [])];
  c.updatedAt = ev.ts;
  all[ix] = c;
  saveLocal(all);
  return ev;
}

// ---------- utils ----------
function rid() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const a = new Uint32Array(2); crypto.getRandomValues(a);
    return [...a].map(n => n.toString(36)).join("");
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function toIso(ts) { return ts ? new Date(ts).toISOString() : null; }
function rowToContact(r) {
  return {
    id: r.id,
    name: r.name || "",
    email: r.email || "",
    phone: r.phone || "",
    company: r.company || "",
    tags: r.tags || [],
    createdAt: Date.parse(r.created_at || r.createdAt || Date.now()),
    updatedAt: Date.parse(r.updated_at || r.updatedAt || Date.now()),
    // timeline is fetched separately
  };
}
function contactToRow(c) {
  return {
    id: c.id,
    name: c.name || null,
    email: c.email || null,
    phone: c.phone || null,
    company: c.company || null,
    tags: c.tags || [],
    created_at: toIso(c.createdAt) || new Date().toISOString(),
    updated_at: toIso(c.updatedAt) || new Date().toISOString(),
  };
}
function rowToActivity(r) {
  return { id: r.id, type: r.type, text: r.text, meta: r.meta, ts: Date.parse(r.ts) };
}




