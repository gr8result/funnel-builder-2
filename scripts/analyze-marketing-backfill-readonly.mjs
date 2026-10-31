// READ-ONLY ownership and schema analysis for the central contacts / marketing backfill.
// Issues only GET requests (PostgREST schema + selects). Writes nothing to the database.
// Output contains counts, column names and record UUIDs only — no emails, phone numbers or names.
// Usage: node scripts/analyze-marketing-backfill-readonly.mjs > <file outside the repo>
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local", quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing Supabase URL or service key; no request was made."); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const TABLES = [
  "workspaces", "workspace_members", "contacts", "leads", "lead_lists", "email_lists", "subscribers", "form_submissions",
  "email_broadcasts", "email_sends", "email_events", "email_campaigns_sends", "email_campaigns_queue", "email_autoresponder_queue",
  "sms_queue", "sms_messages", "sms_sent_history", "sms_delivery_receipts", "telephony_numbers", "crm_tasks", "crm_pipelines",
  "accounts", "email_unsubscribes", "email_suppressions",
];

async function openApiColumns() {
  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/openapi+json" } });
  if (!res.ok) return {};
  const spec = await res.json();
  return Object.fromEntries(Object.entries(spec.definitions || {}).map(([t, d]) => [t, Object.keys(d.properties || {})]));
}

async function readAll(table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns.join(",")).range(from, from + 999);
    if (error) return { error: error.message, rows };
    rows.push(...data);
    if (data.length < 1000) return { rows };
  }
}

const out = { analysis: "marketing-backfill-readonly", generatedAt: new Date().toISOString(), schema: {}, ownership: {}, consentEvidence: {}, findings: [] };
const columns = await openApiColumns();
for (const t of TABLES) {
  const { count, error } = await db.from(t).select("*", { count: "exact", head: true });
  out.schema[t] = error ? { exists: false, error: error.code || error.message } : { exists: true, rows: count, columns: columns[t] || "not exposed in OpenAPI" };
}

// Probe columns hidden from OpenAPI (contacts) by selecting zero rows per candidate column.
for (const t of ["contacts", "gantt_contacts"]) {
  if (!out.schema[t]?.exists && t !== "gantt_contacts") continue;
  const probe = {};
  for (const c of ["id", "workspace_id", "user_id", "email", "phone", "first_name", "last_name", "display_name", "company", "source", "is_demo", "created_by", "created_at", "updated_at"]) {
    const { error } = await db.from(t).select(c).limit(0);
    probe[c] = !error;
  }
  out.schema[`${t}__probed_columns`] = probe;
}

// Users -> active workspaces (ownership is resolvable only when exactly one).
const members = await readAll("workspace_members", ["workspace_id", "user_id", "role", "status"]);
const byUser = new Map();
for (const m of members.rows) {
  if (m.status && m.status !== "active") continue;
  if (!byUser.has(m.user_id)) byUser.set(m.user_id, new Set());
  byUser.get(m.user_id).add(m.workspace_id);
}
const resolve = (userId) => {
  const set = byUser.get(userId);
  if (!userId) return { state: "no_user" };
  if (!set || set.size === 0) return { state: "user_without_workspace" };
  if (set.size > 1) return { state: "user_in_multiple_workspaces" };
  return { state: "single", workspaceId: [...set][0] };
};
out.ownership.users = {
  withExactlyOneWorkspace: [...byUser.values()].filter((s) => s.size === 1).length,
  withMultipleWorkspaces: [...byUser.entries()].filter(([, s]) => s.size > 1).map(([u, s]) => ({ user_id: u, workspaces: s.size })),
};

async function ownershipFor(table) {
  const cols = out.schema[table]?.columns;
  if (!Array.isArray(cols)) return { skipped: "table or columns unavailable" };
  const has = (c) => cols.includes(c);
  const pick = ["id", has("user_id") && "user_id", has("workspace_id") && "workspace_id"].filter(Boolean);
  const { rows, error } = await readAll(table, pick);
  if (error) return { error };
  const result = { rows: rows.length, hasWorkspaceColumn: has("workspace_id"), alreadyScoped: 0, deterministic: 0, conflicting: 0, quarantine: { no_user: [], user_without_workspace: [], user_in_multiple_workspaces: [] } };
  for (const r of rows) {
    const owner = has("user_id") ? resolve(r.user_id) : { state: "no_user" };
    if (r.workspace_id) {
      result.alreadyScoped += 1;
      if (owner.state === "single" && owner.workspaceId !== r.workspace_id) result.conflicting += 1;
      continue;
    }
    if (owner.state === "single") result.deterministic += 1;
    else result.quarantine[owner.state].push(r.id);
  }
  return result;
}
for (const t of ["leads", "lead_lists", "email_lists", "subscribers", "form_submissions", "email_broadcasts", "email_sends", "sms_sent_history", "sms_messages", "sms_queue", "email_campaigns_queue", "telephony_numbers", "crm_tasks", "crm_pipelines"]) {
  out.ownership[t] = await ownershipFor(t);
}

// Consent / opt-out evidence that exists today (counts only).
const leadCols = Array.isArray(out.schema.leads?.columns) ? out.schema.leads.columns : [];
const flagCols = leadCols.filter((c) => /consent|opt_?out|unsubscrib|subscribed|marketing/i.test(c));
out.consentEvidence.leadFlagColumns = flagCols;
if (flagCols.length) {
  const { rows } = await readAll("leads", ["id", ...flagCols]);
  out.consentEvidence.leadFlagCounts = Object.fromEntries(flagCols.map((c) => [c, rows.filter((r) => r[c] === true || (r[c] && typeof r[c] === "string")).length]));
}
const sendCols = Array.isArray(out.schema.email_sends?.columns) ? out.schema.email_sends.columns : [];
if (sendCols.includes("unsubscribed")) {
  const { count } = await db.from("email_sends").select("id", { count: "exact", head: true }).eq("unsubscribed", true);
  out.consentEvidence.emailSendsUnsubscribed = count;
}
if (sendCols.includes("status")) {
  const { rows } = await readAll("email_sends", ["status"]);
  out.consentEvidence.emailSendStatuses = rows.reduce((a, r) => ({ ...a, [r.status || "null"]: (a[r.status || "null"] || 0) + 1 }), {});
}
const evCols = Array.isArray(out.schema.email_events?.columns) ? out.schema.email_events.columns : [];
if (evCols.includes("event")) {
  const { rows } = await readAll("email_events", ["event"]);
  out.consentEvidence.emailEventTypes = rows.reduce((a, r) => ({ ...a, [r.event || "null"]: (a[r.event || "null"] || 0) + 1 }), {});
}
const smsMsgCols = Array.isArray(out.schema.sms_messages?.columns) ? out.schema.sms_messages.columns : [];
if (smsMsgCols.includes("direction") && smsMsgCols.includes("body")) {
  const { rows } = await readAll("sms_messages", ["direction", "body"]);
  out.consentEvidence.inboundSmsStopKeywords = rows.filter((r) => r.direction === "inbound" && /^\s*(stop|unsubscribe|cancel|end|quit)\W*$/i.test(r.body || "")).length;
}
console.log(JSON.stringify(out, null, 2));
