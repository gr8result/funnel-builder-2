import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const TABLE_NAME = "published_websites";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "15mb",
    },
  },
};

function getBearerToken(req) {
  const header = String(req.headers.authorization || req.headers.Authorization || "").trim();
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

function toErrorMessage(error, fallback) {
  return error?.message || fallback;
}

function isMissingDraftProjectsTable(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes(TABLE_NAME) && (message.includes("schema cache") || message.includes("does not exist") || message.includes("could not find the table"));
}

function toDraftProjectId(projectId) {
  return `draft:${String(projectId || "").trim()}`;
}

function buildDraftSlug(projectId) {
  return `draft-${String(projectId || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`;
}

function buildDraftPrimaryDomain(projectId) {
  return `${buildDraftSlug(projectId)}.draft.local`;
}

function mapProjectRow(row) {
  if (!row) return null;

  const project = row.site_data && typeof row.site_data === "object"
    ? row.site_data
    : {};

  return {
    ...project,
    id: String(project?.id || row.project_id || "").trim().replace(/^draft:/, ""),
    name: project?.name || row.name || "Untitled Website",
    createdAt: project?.createdAt || row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || project?.updatedAt || row.created_at || new Date().toISOString(),
  };
}

async function requireUserId(req, res) {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ ok: false, error: "Missing Bearer token" });
    return null;
  }

  const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !userData?.user?.id) {
    res.status(401).json({ ok: false, error: toErrorMessage(authError, "Authentication failed") });
    return null;
  }

  return userData.user.id;
}

export default async function handler(req, res) {
  const userId = await requireUserId(req, res);
  if (!userId) return;

  if (req.method === "GET") {
    const projectId = String(req.query?.projectId || "").trim();
    const draftProjectId = projectId ? toDraftProjectId(projectId) : "";

    const baseSelect = supabaseAdmin
      .from(TABLE_NAME)
      .select("id, project_id, name, site_data, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (projectId) {
      // Try draft-prefixed row first, then fall back to the raw project_id (published sites)
      const draftResult = await baseSelect
        .eq("project_id", draftProjectId)
        .limit(1)
        .maybeSingle();

      if (draftResult.error) {
        if (isMissingDraftProjectsTable(draftResult.error)) {
          return res.status(500).json({ ok: false, error: "Website draft sync is not set up yet. The draft projects table is missing from Supabase." });
        }
        return res.status(500).json({ ok: false, error: toErrorMessage(draftResult.error, "Could not load website project") });
      }

      if (draftResult.data) {
        return res.status(200).json({ ok: true, project: mapProjectRow(draftResult.data) });
      }

      // Fall back: look up by the raw (non-draft-prefixed) project_id for published sites
      const publishedResult = await supabaseAdmin
        .from(TABLE_NAME)
        .select("id, project_id, name, site_data, created_at, updated_at")
        .eq("user_id", userId)
        .eq("project_id", projectId)
        .limit(1)
        .maybeSingle();

      if (publishedResult.error) {
        return res.status(500).json({ ok: false, error: toErrorMessage(publishedResult.error, "Could not load website project") });
      }

      return res.status(200).json({ ok: true, project: mapProjectRow(publishedResult.data) });
    }

    // List all projects — include both drafts and published sites
    const result = await baseSelect.limit(100);

    if (result.error) {
      if (isMissingDraftProjectsTable(result.error)) {
        return res.status(500).json({ ok: false, error: "Website draft sync is not set up yet. The draft projects table is missing from Supabase." });
      }
      return res.status(500).json({ ok: false, error: toErrorMessage(result.error, "Could not load website projects") });
    }

    // Deduplicate: when a draft: row and a published row share the same effective id,
    // always prefer the published (non-draft) row — it is the authoritative source.
    // Only fall back to a draft row when no published row exists for that id.
    const seen = new Map();
    for (const row of Array.isArray(result.data) ? result.data : []) {
      const mapped = mapProjectRow(row);
      if (!mapped?.id) continue;
      const isDraft = String(row.project_id || "").startsWith("draft:");
      const existing = seen.get(mapped.id);
      if (!existing) {
        seen.set(mapped.id, { mapped, isDraft });
      } else if (existing.isDraft && !isDraft) {
        // Published row beats draft row unconditionally
        seen.set(mapped.id, { mapped, isDraft });
      } else if (!existing.isDraft && isDraft) {
        // Already have a published row — skip the draft
      } else {
        // Same kind (both draft or both published) — keep the most recently updated
        const existingTs = Date.parse(existing.mapped.updatedAt || 0) || 0;
        const incomingTs = Date.parse(mapped.updatedAt || 0) || 0;
        if (incomingTs > existingTs) seen.set(mapped.id, { mapped, isDraft });
      }
    }

    return res.status(200).json({ ok: true, projects: Array.from(seen.values()).map((e) => e.mapped) });
  }

  if (req.method === "POST") {
    const project = req.body?.project;
    if (!project || typeof project !== "object") {
      return res.status(400).json({ ok: false, error: "Missing website project payload" });
    }

    const projectId = String(project?.id || req.body?.projectId || "").trim();
    if (!projectId) {
      return res.status(400).json({ ok: false, error: "A website project id is required" });
    }

    const draftProjectId = toDraftProjectId(projectId);

    const now = new Date().toISOString();
    const nextProject = {
      ...project,
      id: projectId,
      createdAt: project?.createdAt || now,
      updatedAt: now,
    };

    const existing = await supabaseAdmin
      .from(TABLE_NAME)
      .select("id, published, published_at, custom_domain, domain_status, slug, primary_domain, site_data")
      .eq("user_id", userId)
      .eq("project_id", draftProjectId)
      .limit(1)
      .maybeSingle();

    if (existing.error) {
      if (isMissingDraftProjectsTable(existing.error)) {
        return res.status(500).json({ ok: false, error: "Website draft sync is not set up yet. The publishing table is missing from Supabase." });
      }
      return res.status(500).json({ ok: false, error: toErrorMessage(existing.error, "Could not load website draft") });
    }

    // Preserve any blocks marked _pinned:true that exist in the DB but are missing from the incoming payload.
    // This prevents auto-saves from the visual builder from removing manually-pinned blocks.
    if (existing.data?.site_data?.pageBlocks && nextProject.pageBlocks) {
      const dbPageBlocks = existing.data.site_data.pageBlocks;
      for (const [pageName, dbBlocks] of Object.entries(dbPageBlocks)) {
        if (!Array.isArray(dbBlocks)) continue;
        const pinnedBlocks = dbBlocks.filter((b) => b && b._pinned);
        if (pinnedBlocks.length === 0) continue;
        const incomingBlocks = Array.isArray(nextProject.pageBlocks[pageName]) ? nextProject.pageBlocks[pageName] : [];
        const incomingIds = new Set(incomingBlocks.map((b) => b?.id).filter(Boolean));
        const missing = pinnedBlocks.filter((b) => !incomingIds.has(b.id));
        if (missing.length > 0) {
          nextProject.pageBlocks[pageName] = [...incomingBlocks, ...missing];
        }
      }
    }

    const record = {
      user_id: userId,
      project_id: draftProjectId,
      name: nextProject?.name || "Untitled Website",
      slug: existing.data?.slug || buildDraftSlug(projectId),
      primary_domain: existing.data?.primary_domain || buildDraftPrimaryDomain(projectId),
      custom_domain: existing.data?.custom_domain || null,
      domain_status: existing.data?.domain_status || "generated",
      published: false,
      published_at: null,
      site_data: {
        ...nextProject,
        __draftSync: true,
      },
    };

    const result = existing.data?.id
      ? await supabaseAdmin
        .from(TABLE_NAME)
        .update(record)
        .eq("id", existing.data.id)
        .select("id, project_id, name, site_data, created_at, updated_at")
        .maybeSingle()
      : await supabaseAdmin
        .from(TABLE_NAME)
        .insert(record)
        .select("id, project_id, name, site_data, created_at, updated_at")
        .maybeSingle();

    if (result.error || !result.data) {
      if (isMissingDraftProjectsTable(result.error)) {
        return res.status(500).json({ ok: false, error: "Website draft sync is not set up yet. The draft projects table is missing from Supabase." });
      }
      return res.status(500).json({ ok: false, error: toErrorMessage(result.error, "Could not save website draft") });
    }

    return res.status(200).json({ ok: true, project: mapProjectRow(result.data) });
  }

  if (req.method === "PATCH") {
    const { projectId: patchProjectId, name: patchName } = req.body || {};
    const newName = String(patchName || "").trim();
    if (!patchProjectId || !newName) {
      return res.status(400).json({ ok: false, error: "projectId and name are required" });
    }

    const draftId = toDraftProjectId(patchProjectId);

    // Fetch all rows matching either the published or draft project_id
    const { data: matchingRows, error: fetchError } = await supabaseAdmin
      .from(TABLE_NAME)
      .select("id, project_id, site_data")
      .eq("user_id", userId)
      .in("project_id", [patchProjectId, draftId]);

    if (fetchError) {
      return res.status(500).json({ ok: false, error: toErrorMessage(fetchError, "Could not find website project") });
    }

    if (!matchingRows?.length) {
      return res.status(404).json({ ok: false, error: "Website project not found" });
    }

    const now = new Date().toISOString();
    for (const row of matchingRows) {
      const nextSiteData = { ...(row.site_data && typeof row.site_data === "object" ? row.site_data : {}), name: newName };
      await supabaseAdmin.from(TABLE_NAME).update({ name: newName, site_data: nextSiteData, updated_at: now }).eq("id", row.id);
    }

    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const projectId = String(req.query?.projectId || req.body?.projectId || "").trim();
    if (!projectId) {
      return res.status(400).json({ ok: false, error: "A website project id is required" });
    }

    const draftProjectId = toDraftProjectId(projectId);

    // Delete by draft-prefixed project_id OR raw project_id (covers both draft and non-draft rows)
    const result = await supabaseAdmin
      .from(TABLE_NAME)
      .delete()
      .eq("user_id", userId)
      .or(`project_id.eq.${draftProjectId},project_id.eq.${projectId}`)
      .neq("published", true);

    if (result.error) {
      if (isMissingDraftProjectsTable(result.error)) {
        return res.status(500).json({ ok: false, error: "Website draft sync is not set up yet. The draft projects table is missing from Supabase." });
      }
      return res.status(500).json({ ok: false, error: toErrorMessage(result.error, "Could not delete website draft") });
    }

    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}