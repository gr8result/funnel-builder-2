// Builder master payment templates, kept per builder (workspace). Job contracts hold their own copy, so saving here never rewrites a job
// and editing a job never rewrites this.
//
// The shared store is public.builder_trade_payment_templates (supabase/migrations/20261011090000_trade_payment_schedules.sql), reached
// with the signed-in user's own session so row-level security decides what they may read and write. The browser copy is a per-builder
// cache of it, and the only store until that migration is applied: every server failure falls back to it and says so.
import { saveBuilderTemplate, normalizeTradeKey, validateTemplateMilestones } from "./tradePaymentSchedule.js";

const TABLE = "builder_trade_payment_templates";
const keyFor = (builderId) => `gr8:trade-payment-templates:v1:${builderId}`;

export function loadBuilderTemplates(builderId, storage = globalThis.localStorage) {
  if (!builderId || !storage) return {};
  try {
    const parsed = JSON.parse(storage.getItem(keyFor(builderId)) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? { [builderId]: parsed } : {};
  } catch { return {}; }
}

export function saveBuilderTemplateLocal(builderId, template, { actor = "", storage = globalThis.localStorage } = {}) {
  if (!storage) return { ok: false, code: "NO_STORAGE", message: "Browser storage is unavailable." };
  const store = loadBuilderTemplates(builderId, storage);
  const result = saveBuilderTemplate(store, builderId, template, { actor });
  if (result.ok) storage.setItem(keyFor(builderId), JSON.stringify(result.store[builderId]));
  return result;
}

const fromRow = (row) => ({
  templateId: `builder:${row.workspace_id}:${row.trade}`, builderId: row.workspace_id, trade: row.trade, name: row.name, sourceSection: row.source_section,
  revision: row.revision, milestones: row.milestones, updatedAt: row.updated_at || "", recordId: row.id,
});

// db is a Supabase client carrying the user's session. Every query names the workspace; a row from anywhere else is refused even if
// the database were to return one.
export function createTemplateRepository(db, workspaceId) {
  const owner = String(workspaceId || "").trim();
  if (!owner) throw new Error("A builder workspace is required.");
  const own = (row) => { if (row.workspace_id !== owner) throw new Error("Template does not belong to this builder workspace."); return row; };
  async function list() {
    const { data, error } = await db.from(TABLE).select("*").eq("workspace_id", owner);
    if (error) throw error;
    return Object.fromEntries((data || []).map((row) => [own(row).trade, fromRow(row)]));
  }
  async function save(template) {
    if (template?.builderId && template.builderId !== owner) throw new Error("Template belongs to another builder.");
    const trade = normalizeTradeKey(template?.trade);
    if (!trade) throw new Error("A trade is required.");
    const issues = validateTemplateMilestones(template.milestones || []);
    if (issues.length) { const error = new Error("Template milestones are invalid."); error.issues = issues; throw error; }
    const payload = { workspace_id: owner, trade, name: String(template.name || trade), source_section: String(template.sourceSection || trade), milestones: template.milestones };
    const { data: existing, error: lookupError } = await db.from(TABLE).select("id, workspace_id").eq("workspace_id", owner).eq("trade", trade).maybeSingle();
    if (lookupError) throw lookupError;
    const query = existing ? db.from(TABLE).update(payload).eq("workspace_id", owner).eq("id", own(existing).id) : db.from(TABLE).insert(payload);
    const { data, error } = await query.select("*").single();
    if (error) throw error;
    return fromRow(own(data));
  }
  return Object.freeze({ list, save });
}

const cache = (builderId, templates, storage) => { try { storage?.setItem(keyFor(builderId), JSON.stringify(templates)); } catch { /* cache only */ } };

// Shared templates for the builder, refreshing the browser cache. source says where they came from.
export async function loadBuilderTemplatesShared(db, builderId, { storage = globalThis.localStorage } = {}) {
  if (!builderId) return { store: {}, source: "NONE", message: "No builder workspace." };
  try {
    const templates = await createTemplateRepository(db, builderId).list();
    cache(builderId, templates, storage);
    return { store: { [builderId]: templates }, source: "SHARED" };
  } catch (error) {
    return { store: loadBuilderTemplates(builderId, storage), source: "LOCAL", message: `Shared templates unavailable (${error?.message || "error"}); using this browser's copy.` };
  }
}

// Save to the shared store; the browser cache follows only what was really saved. When the shared store is unreachable the template
// is kept in this browser and the caller is told it is not yet shared.
export async function saveBuilderTemplateShared(db, builderId, template, { actor = "", storage = globalThis.localStorage } = {}) {
  const checked = saveBuilderTemplate(loadBuilderTemplates(builderId, storage), builderId, template, { actor });
  if (!checked.ok) return checked;
  try {
    const saved = await createTemplateRepository(db, builderId).save({ ...template, builderId });
    cache(builderId, { ...(loadBuilderTemplates(builderId, storage)[builderId] || {}), [saved.trade]: saved }, storage);
    return { ok: true, template: saved, source: "SHARED", message: `Saved as the builder default for ${saved.trade.replace(/_/g, " ")} (revision ${saved.revision}).` };
  } catch (error) {
    if (/row-level security|permission denied|another builder/i.test(error?.message || "")) return { ok: false, code: "NOT_PERMITTED", message: "Only a builder owner or admin can change master payment templates." };
    const local = saveBuilderTemplateLocal(builderId, template, { actor, storage });
    return local.ok ? { ...local, source: "LOCAL", message: `Saved in this browser only - the shared template store is not available (${error?.message || "error"}).` } : local;
  }
}

// A job's current schedule as a master template: the structure only, never claims, payments, dates or task links.
export function templateFromContract(contract, { name = "" } = {}) {
  return {
    trade: contract.trade, name: name || `${contract.trade.replace(/_/g, " ")} payment schedule`, sourceSection: contract.sourceSection,
    milestones: contract.milestones.map((milestone) => {
      const { taskId, taskRelation, manualTask, resolved, ...link } = milestone.link || {};
      return { key: milestone.key, label: milestone.label, percent: milestone.remainder ? null : milestone.percent, remainder: Boolean(milestone.remainder), constructionStage: milestone.constructionStage || "", link };
    }),
  };
}

// "Rough-in 30, Fix 40, Final balance" -> template milestones. The one entry without a percentage takes the balance.
export function parseTemplateMilestones(input = "") {
  return String(input).split(/[,\n]/).map((part) => part.trim()).filter(Boolean).map((part) => {
    const match = part.match(/^(.*?)[\s:]+(\d+(?:\.\d+)?)\s*%?$/);
    const label = (match ? match[1] : part.replace(/[\s:]+(balance|remainder)$/i, "")).trim();
    return { key: normalizeTradeKey(label), label, percent: match ? Number(match[2]) : null, remainder: !match, constructionStage: "", link: {} };
  });
}
