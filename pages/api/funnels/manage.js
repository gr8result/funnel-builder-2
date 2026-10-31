// GET  /api/funnels/manage                          -> the signed-in owner's multi-step funnels for the active workspace
// POST /api/funnels/manage { action, id }           -> duplicate | publish | unpublish | rename | delete
// Funnels are owned by a user (owner_user_id). Rows stamped with another workspace_id are never listed or changed here.

import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../lib/withWorkspace";
import { getLimit } from "../../../lib/featureGates";

const FUNNEL_COLS = "id, name, slug, status, description, notify_email, default_list_id, workspace_id, created_at, updated_at";

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
  const { data, error } = await scoped(supabaseAdmin.from("funnels").select(FUNNEL_COLS).eq("id", id), req).maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error("Funnel not found in this workspace"), { status: 404 });
  return data;
}

async function uniqueSlug(base, excludeId) {
  const root = slugifyFunnel(base) || "funnel";
  for (let i = 0; i < 25; i += 1) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const { data, error } = await supabaseAdmin.from("funnels").select("id").eq("slug", candidate).limit(1);
    if (error) throw error;
    if (!data?.length || data[0].id === excludeId) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

async function listFunnels(req) {
  const { data: funnels, error } = await scoped(supabaseAdmin.from("funnels").select(FUNNEL_COLS), req).order("updated_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  const ids = (funnels || []).map((f) => f.id);
  const steps = ids.length
    ? (await supabaseAdmin.from("funnel_steps").select("funnel_id, content, order_index, updated_at").in("funnel_id", ids).order("order_index", { ascending: true }))
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

async function assertBelowLimit(req) {
  const { data: ws } = await supabaseAdmin.from("workspaces").select("plan").eq("owner_id", req.user.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
  const limit = getLimit(ws?.plan || "starter", "funnels");
  if (limit === null) return;
  const { count, error } = await supabaseAdmin.from("funnels").select("id", { count: "exact", head: true }).eq("owner_user_id", req.user.id);
  if (error) throw error;
  if ((count || 0) >= limit) throw Object.assign(new Error(`You've reached your funnel limit (${limit}). Delete a funnel or upgrade to duplicate this one.`), { status: 403 });
}

async function duplicateFunnel(req, id) {
  const src = await loadFunnel(req, id);
  await assertBelowLimit(req);
  const { data: copy, error } = await supabaseAdmin.from("funnels").insert({
    owner_user_id: req.user.id,
    workspace_id: src.workspace_id || null,
    name: `${src.name || "Funnel"} (copy)`.slice(0, 160),
    description: src.description || "",
    notify_email: src.notify_email || null,
    default_list_id: src.default_list_id || null,
    slug: null,
    status: "draft",
  }).select("id").single();
  if (error) throw error;
  const { data: steps, error: stepsError } = await supabaseAdmin.from("funnel_steps").select("title, content, order_index").eq("funnel_id", src.id).order("order_index", { ascending: true });
  if (stepsError) throw stepsError;
  if (steps?.length) {
    const inserted = await supabaseAdmin.from("funnel_steps").insert(steps.map((s) => ({ funnel_id: copy.id, title: s.title, content: s.content, order_index: s.order_index })));
    if (inserted.error) {
      await supabaseAdmin.from("funnels").delete().eq("id", copy.id);
      throw inserted.error;
    }
  }
  return copy.id;
}

async function handler(req, res) {
  try {
    if (req.method === "GET") return res.status(200).json({ ok: true, funnels: await listFunnels(req) });
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }
    const action = String(req.body?.action || "");
    const id = req.body?.id;
    if (action === "duplicate") return res.status(201).json({ ok: true, id: await duplicateFunnel(req, id) });
    if (action === "publish") {
      const funnel = await loadFunnel(req, id);
      const slug = funnel.slug || await uniqueSlug(funnel.name, funnel.id);
      const { error } = await supabaseAdmin.from("funnels").update({ status: "published", slug }).eq("id", funnel.id);
      if (error) throw error;
      return res.status(200).json({ ok: true, slug, url: `/p/${slug}` });
    }
    if (action === "rename") {
      const funnel = await loadFunnel(req, id);
      const name = String(req.body?.name || "").trim().slice(0, 160);
      if (!name) return res.status(400).json({ ok: false, error: "Name can't be empty." });
      const { error } = await supabaseAdmin.from("funnels").update({ name }).eq("id", funnel.id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    if (action === "unpublish") {
      const funnel = await loadFunnel(req, id);
      const { error } = await supabaseAdmin.from("funnels").update({ status: "draft" }).eq("id", funnel.id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    if (action === "delete") {
      const funnel = await loadFunnel(req, id);
      if (String(req.body?.confirmName || "").trim() !== String(funnel.name || "").trim()) {
        return res.status(400).json({ ok: false, error: "Type the funnel name exactly to confirm permanent deletion." });
      }
      const stepsDelete = await supabaseAdmin.from("funnel_steps").delete().eq("funnel_id", funnel.id);
      if (stepsDelete.error) throw stepsDelete.error;
      const { error } = await supabaseAdmin.from("funnels").delete().eq("id", funnel.id).eq("owner_user_id", req.user.id);
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
