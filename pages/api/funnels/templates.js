import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../lib/withWorkspace";
import { getLimit } from "../../../lib/featureGates";
import { normaliseDocument } from "../../../lib/landing-pages/pageModel";
import { sanitiseBrief } from "../../../lib/landing-pages/interview";
import { pageThumbnail } from "../../../lib/landing-pages/repository";
import { templateContent } from "../../../lib/funnels/templateContent";

const MASTER_COLUMNS = "id, name, template_description, template_thumbnail, template_kind, template_payload, updated_at";
const FUNNEL_COLUMNS = "id, name, description, notify_email, default_list_id, workspace_id, owner_user_id, is_master_template, template_description, template_thumbnail, template_kind, template_payload";

let databaseOverride = null;
export function setFunnelTemplateDb(client) {
  databaseOverride = client;
}

const db = () => databaseOverride || supabaseAdmin;

function firstImageSrc(html = "") {
  const match = String(html || "").match(/<img[^>]+src=["']([^"']+)["']/i)
    || String(html || "").match(/url\(["']?(https?:[^"')]+)["']?\)/i);
  const src = match?.[1] || "";
  return /^(https?:)?\/\//i.test(src) || src.startsWith("/") ? src : "";
}

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

async function getMaster(id) {
  if (!id || typeof id !== "string") throw httpError("Template id is required", 400);
  const { data, error } = await db().from("funnels").select(FUNNEL_COLUMNS)
    .eq("id", id).eq("is_master_template", true).maybeSingle();
  if (error) throw error;
  if (!data) throw httpError("Template not found", 404);
  return data;
}

async function getSteps(funnelId) {
  const { data, error } = await db().from("funnel_steps")
    .select("title, content, order_index").eq("funnel_id", funnelId)
    .order("order_index", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function listTemplates() {
  const { data, error } = await db().from("funnels").select(MASTER_COLUMNS)
    .eq("is_master_template", true).order("updated_at", { ascending: false });
  if (error) throw error;
  const templates = data || [];
  if (!templates.length) return [];
  const { data: steps, error: stepsError } = await db().from("funnel_steps")
    .select("funnel_id, title, content, order_index").in("funnel_id", templates.map((item) => item.id))
    .order("order_index", { ascending: true });
  if (stepsError) throw stepsError;
  return templates.map((template) => {
    const ownSteps = template.template_kind === "campaign"
      ? (template.template_payload?.pages || []).map((page, index) => ({ title: page.title, order_index: index }))
      : (steps || []).filter((step) => step.funnel_id === template.id);
    return {
      id: template.id,
      name: template.name,
      kind: template.template_kind || "funnel",
      description: template.template_description || "",
      thumbnail: template.template_thumbnail || ownSteps.map((step) => firstImageSrc(step.content)).find(Boolean) || "",
      stepCount: ownSteps.length,
      steps: ownSteps.map((step) => ({ title: step.title, order_index: step.order_index })),
      updatedAt: template.updated_at,
    };
  });
}

function assertPublicTemplateAssets(value) {
  if (typeof value === "string" && /\/storage\/v1\/object\/(?:sign|authenticated)\/|^\/api\/assets\//i.test(value)) {
    throw httpError("Template assets must use public catalogue URLs, not private or signed asset references", 400);
  }
  if (Array.isArray(value)) value.forEach(assertPublicTemplateAssets);
  else if (value && typeof value === "object") Object.values(value).forEach(assertPublicTemplateAssets);
}

async function saveCampaignMaster(req, body) {
  if (!["owner", "admin"].includes(req.memberRole)) throw httpError("Only workspace administrators can save master templates", 403);
  const id = String(body.campaignId || "");
  if (!id) throw httpError("Campaign id is required", 400);
  const { data: source, error: sourceError } = await db().from("landing_campaigns")
    .select("id, name, brief, interview, status").eq("id", id).eq("workspace_id", req.workspaceId)
    .eq("created_by", req.user.id).maybeSingle();
  if (sourceError) throw sourceError;
  if (!source) throw httpError("Campaign not found in this workspace", 404);
  if (source.status === "archived") throw httpError("Restore this campaign before saving a master template", 409);
  const findExisting = async () => {
    const result = await db().from("funnels").select("id, name, is_master_template")
      .eq("workspace_id", req.workspaceId).eq("template_source_campaign_id", id)
      .eq("template_kind", "campaign").eq("is_master_template", true).maybeSingle();
    if (result.error) throw result.error;
    return result.data;
  };
  const existing = await findExisting();
  if (existing) return existing;
  const { data: pages, error: pagesError } = await db().from("landing_pages")
    .select("id, title, slug, document").eq("campaign_id", id).eq("workspace_id", req.workspaceId)
    .order("created_at", { ascending: true }).order("id", { ascending: true });
  if (pagesError) throw pagesError;
  if (!pages?.length || pages.some((page) => !Array.isArray(page.document?.sections) || !page.document.sections.length)) {
    throw httpError("Every campaign page needs saved content before it can become a template", 400);
  }
  const payload = {
    version: 1,
    brief: sanitiseBrief(source.brief || {}),
    interview: source.interview || {},
    pages: pages.map((page) => ({ title: page.title, sourceSlug: page.slug, document: normaliseDocument(page.document) })),
  };
  assertPublicTemplateAssets(payload);
  const { data, error } = await db().from("funnels").insert({
    owner_user_id: req.user.id, workspace_id: req.workspaceId, name: source.name, status: "draft",
    is_master_template: true, template_kind: "campaign", template_source_campaign_id: id, template_payload: payload,
    template_description: String(body.description || "").trim().slice(0, 1000),
    template_thumbnail: pages.map((page) => pageThumbnail(page.document)).find(Boolean) || null,
    notify_email: null, default_list_id: null, slug: null,
  }).select("id, name, is_master_template").single();
  if (error?.code === "23505") {
    const concurrent = await findExisting();
    if (concurrent) return concurrent;
  }
  if (error) throw error;
  return data;
}

async function saveAsMaster(req, body) {
  if (!["owner", "admin"].includes(req.memberRole)) throw httpError("Only workspace administrators can save master templates", 403);
  const id = body.id;
  if (!id || typeof id !== "string") throw httpError("Funnel id is required", 400);

  const { data: source, error: sourceError } = await db().from("funnels")
    .select(FUNNEL_COLUMNS).eq("id", id).eq("owner_user_id", req.user.id)
    .eq("workspace_id", req.workspaceId).maybeSingle();
  if (sourceError) throw sourceError;
  if (!source) throw httpError("Funnel not found in this workspace", 404);

  const steps = await getSteps(source.id);
  if (!steps.length) throw httpError("Add at least one page before saving this funnel as a master template", 400);

  const description = String(body.description || "").trim().slice(0, 1000);
  const thumbnail = steps.map((step) => firstImageSrc(step.content)).find(Boolean) || null;
  const { data, error } = await db().from("funnels").update({
    is_master_template: true,
    template_description: description,
    template_thumbnail: thumbnail,
  }).eq("id", source.id).eq("owner_user_id", req.user.id).eq("workspace_id", req.workspaceId)
    .select("id, name, is_master_template, template_description, template_thumbnail").single();
  if (error) throw error;
  return data;
}

async function assertBelowLimit(req) {
  const { data: workspace, error: workspaceError } = await db().from("workspaces")
    .select("plan").eq("id", req.workspaceId).maybeSingle();
  if (workspaceError) throw workspaceError;
  const limit = getLimit(workspace?.plan || req.workspace?.plan || "starter", "funnels");
  if (limit === null) return;
  const { data, error } = await db().from("funnels").select("id")
    .eq("owner_user_id", req.user.id).eq("workspace_id", req.workspaceId).eq("is_master_template", false);
  if (error) throw error;
  if ((data || []).length >= limit) {
    throw httpError(`You've reached your funnel limit (${limit}). Delete a funnel or upgrade to create from a template.`, 403);
  }
}

async function createFromTemplate(req, body) {
  const source = await getMaster(body.templateId);
  if (source.template_kind === "campaign") {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(body.requestId || ""))) {
      throw httpError("A valid clone request ID is required", 400);
    }
    const { data, error } = await db().rpc("lp_clone_master_template", {
      p_template_id: source.id, p_workspace_id: req.workspaceId, p_user_id: req.user.id,
      p_name: String(body.name || `${source.name} copy`).trim().slice(0, 160), p_request_id: body.requestId,
      p_contact_email: req.user.email || null,
    });
    if (error) throw error;
    if (!data?.campaign?.id || !Array.isArray(data.pageIds) || !data.pageIds.length) throw new Error("Campaign clone receipt is incomplete");
    return data;
  }
  const steps = await getSteps(source.id);
  if (!steps.length) throw httpError("This template has no pages and cannot be copied", 409);
  await assertBelowLimit(req);

  const name = String(body.name || `${source.name} copy`).trim().slice(0, 160);
  if (!name) throw httpError("Funnel name can't be empty", 400);
  const { data: copy, error } = await db().from("funnels").insert({
    owner_user_id: req.user.id,
    workspace_id: req.workspaceId,
    name,
    description: source.template_description || source.description || "",
    notify_email: null,
    default_list_id: null,
    slug: null,
    status: "draft",
    is_master_template: false,
    template_description: null,
    template_thumbnail: null,
  }).select("id, name").single();
  if (error) throw error;

  try {
    const { error: stepsError } = await db().from("funnel_steps").insert(steps.map((step) => ({
      funnel_id: copy.id,
      title: step.title,
      content: templateContent(step.content),
      order_index: step.order_index,
    })));
    if (stepsError) throw stepsError;
  } catch (error) {
    const { error: cleanupError } = await db().from("funnels").delete()
      .eq("id", copy.id).eq("owner_user_id", req.user.id).eq("workspace_id", req.workspaceId);
    if (cleanupError) {
      console.error("[funnels/templates] failed to roll back incomplete copy", cleanupError.message || cleanupError);
      throw httpError("The funnel copy was incomplete and could not be rolled back. Contact support before retrying.", 500);
    }
    throw error;
  }
  return copy;
}

export async function handler(req, res) {
  try {
    if (req.method === "GET") {
      if (req.query?.id) {
        const template = await getMaster(String(req.query.id));
        const steps = template.template_kind === "campaign"
          ? (template.template_payload?.pages || []).map((page, index) => ({ title: page.title, document: page.document, order_index: index }))
          : await getSteps(template.id);
        return res.status(200).json({
          ok: true,
          template: {
            id: template.id,
            name: template.name,
            kind: template.template_kind || "funnel",
            description: template.template_description || "",
            thumbnail: template.template_thumbnail || steps.map((step) => firstImageSrc(step.content)).find(Boolean) || "",
            steps: steps.map((step) => ({ title: step.title, order_index: step.order_index,
              ...(step.document ? { document: step.document } : { content: templateContent(step.content) }) })),
          },
        });
      }
      return res.status(200).json({ ok: true, templates: await listTemplates() });
    }

    if (req.method === "POST") {
      const action = String(req.body?.action || "");
      if (action === "save") return res.status(200).json({ ok: true, template: await saveAsMaster(req, req.body || {}) });
      if (action === "save_campaign") return res.status(200).json({ ok: true, template: await saveCampaignMaster(req, req.body || {}) });
      if (action === "clone") {
        const copy = await createFromTemplate(req, req.body || {});
        return res.status(201).json({ ok: true, ...(copy.campaign ? copy : { funnel: copy }) });
      }
      return res.status(400).json({ ok: false, error: "Unknown action" });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("[funnels/templates]", error?.message || error);
    return res.status(status).json({ ok: false, error: status >= 500 ? "We couldn't update the template catalogue right now. Please try again." : error.message });
  }
}

export default withWorkspace(handler);
