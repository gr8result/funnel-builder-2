import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withWorkspace";
import { loadFullSplitWebsiteProject } from "../../../lib/website-builder/supabaseSiteStorage";
import { getPublishedWebsiteByDomain } from "../../../lib/website-builder/publicationStore";
import {
  diffWebsitePersistence,
  summarizeWebsitePersistence,
  websitePersistenceHash,
} from "../../../lib/website-builder/documentVersion";
import { normalizeDomain } from "../../../lib/website-builder/publishConfig";

function getBearerToken(req) {
  const header = String(req.headers.authorization || req.headers.Authorization || "").trim();
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

function firstMismatch(stages = []) {
  for (let index = 1; index < stages.length; index += 1) {
    const previous = stages[index - 1];
    const current = stages[index];
    if (!previous?.project || !current?.project) continue;
    const previousHash = websitePersistenceHash(previous.project);
    const currentHash = websitePersistenceHash(current.project);
    if (previousHash !== currentHash) {
      return {
        from: previous.name,
        to: current.name,
        previousHash,
        currentHash,
        diffs: diffWebsitePersistence(previous.project, current.project).slice(0, 50),
      };
    }
  }
  return null;
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (process.env.NODE_ENV === "production" && process.env.WEBSITE_PERSISTENCE_AUDIT !== "1") {
    return res.status(404).json({ ok: false, error: "Not found" });
  }
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ ok: false, error: "Missing Bearer token" });
  const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !userData?.user?.id) return res.status(401).json({ ok: false, error: authError?.message || "Authentication failed" });

  const userId = userData.user.id;
  const projectId = String(req.query?.projectId || req.body?.projectId || "").trim().replace(/^draft:/, "");
  const pageName = String(req.query?.pageName || req.query?.page || req.body?.pageName || "Email").trim();
  const domain = normalizeDomain(req.query?.domain || req.body?.domain || "");
  if (!projectId) return res.status(400).json({ ok: false, error: "projectId is required" });

  const draftProject = await loadFullSplitWebsiteProject(userId, projectId);
  const { data: publishedRows, error: publishedError } = await supabaseAdmin
    .from("published_websites")
    .select("id, project_id, slug, primary_domain, custom_domain, published, published_at, updated_at, site_data")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .order("published_at", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(10);

  if (publishedError) return res.status(500).json({ ok: false, error: publishedError.message || "Could not read published website rows" });

  const domainPublication = domain ? await getPublishedWebsiteByDomain(domain) : null;
  const latestPublished = Array.isArray(publishedRows) ? publishedRows.find((row) => row?.published) || publishedRows[0] || null : null;
  const publishedProject = latestPublished?.site_data && typeof latestPublished.site_data === "object" ? latestPublished.site_data : null;
  const publicProject = domainPublication?.site_data && typeof domainPublication.site_data === "object" ? domainPublication.site_data : null;
  const stages = [
    { name: "draft-readback", project: draftProject, sourceTable: "website_builder_sites + website_builder_pages", sourceRecordId: projectId },
    { name: "published-snapshot", project: publishedProject, sourceTable: "published_websites", sourceRecordId: latestPublished?.id || "" },
    { name: "public-domain-renderer", project: publicProject, sourceTable: "published_websites", sourceRecordId: domainPublication?.id || "" },
  ];

  return res.status(200).json({
    ok: true,
    projectId,
    pageName,
    domain,
    stages: stages.map((stage) => ({
      name: stage.name,
      sourceTable: stage.sourceTable,
      sourceRecordId: stage.sourceRecordId,
      summary: stage.project ? summarizeWebsitePersistence(stage.project, pageName) : null,
    })),
    firstMismatch: firstMismatch(stages),
    publishedRows: (Array.isArray(publishedRows) ? publishedRows : []).map((row) => ({
      table: "published_websites",
      recordId: row.id,
      projectId: row.project_id,
      slug: row.slug,
      primaryDomain: row.primary_domain,
      customDomain: row.custom_domain,
      published: row.published,
      publishedAt: row.published_at,
      updatedAt: row.updated_at,
      hash: row.site_data ? websitePersistenceHash(row.site_data) : "",
      pageCount: Array.isArray(row.site_data?.pages) ? row.site_data.pages.length : 0,
      email: summarizeWebsitePersistence(row.site_data || {}, "Email"),
    })),
  });
}

export default withAuth(handler);
