// GET  /api/funnels/manage                          -> the signed-in owner's multi-step funnels for the active workspace
// POST /api/funnels/manage { action, id }           -> duplicate | publish | unpublish | rename | delete
// Funnels are owned by a user (owner_user_id). Rows stamped with another workspace_id are never listed or changed here.

import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../lib/withWorkspace";
import { getLimit } from "../../../lib/featureGates";

const FUNNEL_COLS = "id, name, slug, status, description, notify_email, default_list_id, workspace_id, owner_user_id, is_master_template, template_description, template_thumbnail, created_at, updated_at";
let databaseOverride = null;

export function setFunnelManageDb(client) {
  databaseOverride = client;
}

const db = () => databaseOverride || supabaseAdmin;

export function slugifyFunnel(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function firstImageSrc(html = "") {
  const match = String(html || "").match(/<img[^>]+src=["']([^"']+)["']/i) || String(html || "").match(/url\(["']?(https?:[^"')]+)["']?\)/i);
  const src = match?.[1] || "";
  return /^(https?:)?\/\//i.test(src) || src.startsWith("/") ? src : "";
}

function scoped(query, req) {
  return query.eq("owner_user_id", req.user.id).or(`workspace_id.is.null,workspace_id.eq.${req.workspaceId}`);
}

async function loadFunnel(req, id) {
  if (!id || typeof id !== "string") throw Object.assign(new Error("Funnel id is required"), { status: 400 });
  const { data, error } = await scoped(db().from("funnels").select(FUNNEL_COLS).eq("id", id), req).maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error("Funnel not found in this workspace"), { status: 404 });
  if (data.is_master_template) throw Object.assign(new Error("Master templates can only be changed through the template administrator tools"), { status: 403 });
  return data;
}

async function uniqueSlug(base, excludeId) {
  const root = slugifyFunnel(base) || "funnel";
  for (let i = 0; i < 25; i += 1) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const { data, error } = await db().from("funnels").select("id").eq("slug", candidate).limit(1);
    if (error) throw error;
    if (!data?.length || data[0].id === excludeId) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

async function listFunnels(req) {
  const { data: funnels, error } = await scoped(db().from("funnels").select(FUNNEL_COLS), req)
    .eq("is_master_template", false).order("updated_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  const ids = (funnels || []).map((f) => f.id);
  const steps = ids.length
    ? (await db().from("funnel_steps").select("funnel_id, content, order_index, updated_at").in("funnel_id", ids).order("order_index", { ascending: true }))
    : { data: [] };
  if (steps.error) throw steps.error;
  return (funnels || []).map((f) => {
    const own = (steps.data || []).filter((s) => s.funnel_id === f.id);
    const lastStepEdit = own.reduce((latest, s) => (s.updated_at && s.updated_at > latest ? s.updated_at : latest), "");
    const thumbnail = own.map((s) => firstImageSrc(s.content)).find(Boolean) || "";
    return {
      id: f.id,
      name: f.name,
      slug: f.slug,
      status: f.status,
      stepCount: own.length,
      thumbnail,
      createdAt: f.created_at,
      updatedAt: [f.updated_at, lastStepEdit, f.created_at].filter(Boolean).sort().pop() || null,
    };
  });
}

async function getFunnelContent(req, id) {
  const funnel = await loadFunnel(req, id);
  const [{ data: steps, error: stepsError }, { data: lists, error: listsError }] = await Promise.all([
    db().from("funnel_steps").select("id, funnel_id, title, content, order_index, updated_at")
      .eq("funnel_id", funnel.id).order("order_index", { ascending: true }),
    db().from("email_lists").select("id, name")
      .eq("user_id", req.user.id).order("created_at", { ascending: true }),
  ]);
  if (stepsError) throw stepsError;
  if (listsError) throw listsError;
  return { funnel, steps: steps || [], lists: lists || [] };
}

async function assertBelowLimit(req) {
  const { data: ws, error: workspaceError } = await db().from("workspaces").select("plan").eq("id", req.workspaceId).maybeSingle();
  if (workspaceError) throw workspaceError;
  const limit = getLimit(ws?.plan || "starter", "funnels");
  if (limit === null) return;
  const { count, error } = await db().from("funnels").select("id", { count: "exact", head: true })
    .eq("owner_user_id", req.user.id).eq("workspace_id", req.workspaceId).eq("is_master_template", false);
  if (error) throw error;
  if ((count || 0) >= limit) throw Object.assign(new Error(`You've reached your funnel limit (${limit}). Delete a funnel or upgrade to duplicate this one.`), { status: 403 });
}

async function duplicateFunnel(req, id) {
  const src = await loadFunnel(req, id);
  await assertBelowLimit(req);
  const { data: steps, error: stepsError } = await db().from("funnel_steps").select("title, content, order_index").eq("funnel_id", src.id).order("order_index", { ascending: true });
  if (stepsError) throw stepsError;
  const { data: copy, error } = await db().from("funnels").insert({
    owner_user_id: req.user.id,
    workspace_id: req.workspaceId,
    name: `${src.name || "Funnel"} (copy)`.slice(0, 160),
    description: src.description || "",
    notify_email: src.notify_email || null,
    default_list_id: src.default_list_id || null,
    slug: null,
    status: "draft",
    is_master_template: false,
  }).select("id").single();
  if (error) throw error;
  if (steps?.length) {
    const inserted = await db().from("funnel_steps").insert(steps.map((s) => ({ funnel_id: copy.id, title: s.title, content: s.content, order_index: s.order_index })));
    if (inserted.error) {
      const { error: cleanupError } = await db().from("funnels").delete()
        .eq("id", copy.id).eq("owner_user_id", req.user.id).eq("workspace_id", req.workspaceId);
      if (cleanupError) {
        console.error("[funnels/manage] failed to roll back incomplete duplicate", cleanupError.message || cleanupError);
        throw Object.assign(new Error("The funnel copy was incomplete and could not be rolled back. Contact support before retrying."), { status: 500 });
      }
      throw inserted.error;
    }
  }
  return copy.id;
}

async function saveFunnelBasics(req, body) {
  const funnel = await loadFunnel(req, body.id);
  const name = String(body.name || "").trim().slice(0, 160);
  if (!name) throw Object.assign(new Error("Name can't be empty."), { status: 400 });
  const description = String(body.description || "").trim().slice(0, 5000);
  const slug = slugifyFunnel(body.slug || "") || null;
  const notifyEmail = String(body.notify_email || "").trim().slice(0, 320) || null;
  const defaultListId = String(body.default_list_id || "").trim() || null;

  if (defaultListId) {
    const { data: list, error: listError } = await db().from("email_lists")
      .select("id").eq("id", defaultListId).eq("user_id", req.user.id).maybeSingle();
    if (listError) throw listError;
    if (!list) throw Object.assign(new Error("Select an email list owned by your account."), { status: 400 });
  }

  const { data, error } = await scoped(db().from("funnels").update({
    name,
    description,
    slug,
    notify_email: notifyEmail,
    default_list_id: defaultListId,
  }).eq("id", funnel.id), req).select(FUNNEL_COLS).single();
  if (error) throw error;
  return data;
}

async function saveStep(req, body) {
  const funnel = await loadFunnel(req, body.funnelId);
  const title = String(body.title || "Page").trim().slice(0, 160) || "Page";
  const content = typeof body.content === "string" ? body.content : "";
  if (content.length > 900_000) throw Object.assign(new Error("The page content is too large."), { status: 400 });
  const orderIndex = Number(body.order_index);
  if (!Number.isInteger(orderIndex) || orderIndex < 0) {
    throw Object.assign(new Error("Page order must be a non-negative integer."), { status: 400 });
  }
  const stepId = String(body.stepId || "").trim();

  const query = stepId
    ? db().from("funnel_steps").update({ title, content, order_index: orderIndex })
      .eq("id", stepId).eq("funnel_id", funnel.id)
    : db().from("funnel_steps").insert({
      funnel_id: funnel.id,
      title,
      content,
      order_index: orderIndex,
    });
  const { data, error } = await query.select("id, funnel_id, title, content, order_index, updated_at").single();
  if (error) {
    if (stepId && (error.code === "PGRST116" || /0 rows|no rows|JSON object requested/i.test(error.message || ""))) {
      throw Object.assign(new Error("Page not found in this funnel."), { status: 404 });
    }
    throw error;
  }
  return data;
}

async function deleteFunnelStep(req, body) {
  const funnel = await loadFunnel(req, body.funnelId);
  const stepId = String(body.stepId || "").trim();
  if (!stepId) throw Object.assign(new Error("Page id is required."), { status: 400 });
  const { data: deleted, error } = await db().from("funnel_steps").delete()
    .eq("id", stepId).eq("funnel_id", funnel.id).select("id");
  if (error) throw error;
  if (!deleted?.length) throw Object.assign(new Error("Page not found in this funnel."), { status: 404 });

  const { data: remaining, error: remainingError } = await db().from("funnel_steps")
    .select("id").eq("funnel_id", funnel.id).order("order_index", { ascending: true });
  if (remainingError) throw remainingError;
  for (const [orderIndex, step] of (remaining || []).entries()) {
    const { error: reorderError } = await db().from("funnel_steps")
      .update({ order_index: orderIndex }).eq("id", step.id).eq("funnel_id", funnel.id);
    if (reorderError) throw reorderError;
  }
  return true;
}

async function createBlankFunnel(req, body) {
  await assertBelowLimit(req);
  const name = String(body.name || "").trim().slice(0, 160);
  if (!name) throw Object.assign(new Error("Funnel name is required"), { status: 400 });
  const content = typeof body.content === "string" ? body.content : "";
  if (content.length > 900_000) throw Object.assign(new Error("The starter page is too large"), { status: 400 });
  const { data: funnel, error } = await db().from("funnels").insert({
    owner_user_id: req.user.id,
    workspace_id: req.workspaceId,
    name,
    description: "",
    slug: null,
    status: "draft",
    is_master_template: false,
  }).select("id").single();
  if (error) throw error;
  const { error: stepError } = await db().from("funnel_steps").insert({
    funnel_id: funnel.id,
    title: "Page 1",
    content,
    order_index: 0,
  });
  if (stepError) {
    const { error: cleanupError } = await db().from("funnels").delete()
      .eq("id", funnel.id).eq("owner_user_id", req.user.id).eq("workspace_id", req.workspaceId);
    if (cleanupError) {
      console.error("[funnels/manage] failed to roll back incomplete funnel", cleanupError.message || cleanupError);
      throw Object.assign(new Error("The funnel was incomplete and could not be rolled back. Contact support before retrying."), { status: 500 });
    }
    throw stepError;
  }
  return funnel.id;
}

async function handler(req, res) {
  try {
    if (req.method === "GET") {
      if (req.query?.id) return res.status(200).json({ ok: true, ...await getFunnelContent(req, String(req.query.id)) });
      return res.status(200).json({ ok: true, funnels: await listFunnels(req) });
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }
    const action = String(req.body?.action || "");
    const id = req.body?.id;
    if (action === "create") return res.status(201).json({ ok: true, id: await createBlankFunnel(req, req.body || {}) });
    if (action === "duplicate") return res.status(201).json({ ok: true, id: await duplicateFunnel(req, id) });
    if (action === "saveBasics") return res.status(200).json({ ok: true, funnel: await saveFunnelBasics(req, req.body || {}) });
    if (action === "saveStep") return res.status(200).json({ ok: true, step: await saveStep(req, req.body || {}) });
    if (action === "deleteStep") return res.status(200).json({ ok: true, deleted: await deleteFunnelStep(req, req.body || {}) });
    if (action === "publish") {
      const funnel = await loadFunnel(req, id);
      const requestedSlug = slugifyFunnel(req.body?.slug || funnel.slug || funnel.name);
      if (!requestedSlug) throw Object.assign(new Error("Add a funnel name or slug before publishing."), { status: 400 });
      const slug = await uniqueSlug(requestedSlug, funnel.id);
      if (slug !== requestedSlug) throw Object.assign(new Error("Slug already in use. Pick another."), { status: 409 });
      const { error } = await scoped(db().from("funnels").update({ status: "published", slug }).eq("id", funnel.id), req);
      if (error) throw error;
      return res.status(200).json({ ok: true, slug, url: `/p/${slug}` });
    }
    if (action === "rename") {
      const funnel = await loadFunnel(req, id);
      const name = String(req.body?.name || "").trim().slice(0, 160);
      if (!name) return res.status(400).json({ ok: false, error: "Name can't be empty." });
      const { error } = await scoped(db().from("funnels").update({ name }).eq("id", funnel.id), req);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    if (action === "unpublish") {
      const funnel = await loadFunnel(req, id);
      const { error } = await scoped(db().from("funnels").update({ status: "draft" }).eq("id", funnel.id), req);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    if (action === "delete") {
      const funnel = await loadFunnel(req, id);
      if (String(req.body?.confirmName || "").trim() !== String(funnel.name || "").trim()) {
        return res.status(400).json({ ok: false, error: "Type the funnel name exactly to confirm permanent deletion." });
      }
      const stepsDelete = await db().from("funnel_steps").delete().eq("funnel_id", funnel.id);
      if (stepsDelete.error) throw stepsDelete.error;
      const { error } = await scoped(db().from("funnels").delete().eq("id", funnel.id), req);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ ok: false, error: "Unknown action" });
  } catch (err) {
    const status = Number(err?.status) || 500;
    if (status >= 500) console.error("[funnels/manage]", err?.message || err);
    return res.status(status).json({ ok: false, error: status >= 500 ? "We couldn't update your funnels right now. Please try again." : err.message });
  }
}

export { handler };
export default withWorkspace(handler);
