import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withWorkspace";
import {
  buildDefaultSiteDomain,
  buildHostedWebsiteUrl,
  buildWebsitePath,
  buildWebsiteUrl,
  createPublicationPayload,
  getCustomDomainTargetHost,
  getPublishHost,
  normalizeDomain,
  slugifyWebsiteValue,
} from "../../../lib/website-builder/publishConfig";
import { loadFullSplitWebsiteProject } from "../../../lib/website-builder/siteStorage";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
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

function isMissingPublishedWebsitesTable(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("published_websites") && (message.includes("schema cache") || message.includes("does not exist") || message.includes("could not find the table"));
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ ok: false, error: "Missing Bearer token" });

  const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !userData?.user?.id) {
    return res.status(401).json({ ok: false, error: toErrorMessage(authError, "Authentication failed") });
  }

  const userId = userData.user.id;
  const incomingProject = req.body?.project;
  const splitProjectId = String(incomingProject?.id || "").trim();
  const splitProject = splitProjectId ? await loadFullSplitWebsiteProject(userId, splitProjectId) : null;
  const project = splitProject ? { ...incomingProject, ...splitProject, brandAssets: incomingProject?.brandAssets } : incomingProject;
  if (!project || typeof project !== "object") {
    return res.status(400).json({ ok: false, error: "Missing website project payload" });
  }

  const publication = createPublicationPayload(project);
  const requestedCustomDomain = normalizeDomain(req.body?.customDomain);
  const useCustomDomain = !!requestedCustomDomain;
  const requestedSlug = slugifyWebsiteValue(req.body?.slug || publication.slug);
  if (!requestedSlug) {
    return res.status(400).json({ ok: false, error: "A site slug is required to publish" });
  }

  const projectId = String(project.id || "").trim() || null;
  const slug = requestedSlug;
  const primaryDomain = buildDefaultSiteDomain(slug) || getPublishHost() || `${slug}--published`;
  const customDomainTarget = getCustomDomainTargetHost();

  const { data: conflictingSlug } = await supabaseAdmin
    .from("published_websites")
    .select("id, user_id")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();

  if (supabaseAdmin?.from == null) {
    return res.status(500).json({ ok: false, error: "Website publishing is not configured correctly on the server" });
  }

  if (conflictingSlug && conflictingSlug.user_id !== userId) {
    return res.status(409).json({ ok: false, error: "That site slug is already in use" });
  }

  if (useCustomDomain) {
    const { data: conflictingDomain } = await supabaseAdmin
      .from("published_websites")
      .select("id, user_id")
      .eq("custom_domain", requestedCustomDomain)
      .limit(1)
      .maybeSingle();

    if (conflictingDomain && conflictingDomain.user_id !== userId) {
      return res.status(409).json({ ok: false, error: "That custom domain is already connected to another site" });
    }
  }

  const nextRecord = {
    user_id: userId,
    project_id: projectId,
    name: publication.name,
    slug,
    primary_domain: primaryDomain,
    custom_domain: useCustomDomain ? requestedCustomDomain : null,
    domain_status: useCustomDomain ? "pending_verification" : "generated",
    published: true,
    published_at: new Date().toISOString(),
    site_data: {
      ...publication.site_data,
      slug,
      publishedAt: new Date().toISOString(),
    },
  };

  let existing = null;
  if (projectId) {
    const { data } = await supabaseAdmin
      .from("published_websites")
      .select("id")
      .eq("user_id", userId)
      .eq("project_id", projectId)
      .limit(1)
      .maybeSingle();
    existing = data || null;
  }

  let result;
  if (existing?.id) {
    result = await supabaseAdmin
      .from("published_websites")
      .update(nextRecord)
      .eq("id", existing.id)
      .select("id, slug, primary_domain, custom_domain, domain_status, published_at")
      .maybeSingle();
  } else {
    result = await supabaseAdmin
      .from("published_websites")
      .insert(nextRecord)
      .select("id, slug, primary_domain, custom_domain, domain_status, published_at")
      .maybeSingle();
  }

  if (result.error || !result.data) {
    if (isMissingPublishedWebsitesTable(result.error)) {
      return res.status(500).json({ ok: false, error: "Website publishing is not set up yet. The publishing table is missing from Supabase." });
    }
    return res.status(500).json({ ok: false, error: toErrorMessage(result.error, "Could not publish website") });
  }

  return res.status(200).json({
    ok: true,
    publication: result.data,
    sitePath: buildWebsitePath(result.data.slug),
    defaultUrl: buildHostedWebsiteUrl({ slug: result.data.slug }),
    liveUrl: result.data.custom_domain
      ? buildWebsiteUrl({ slug: result.data.slug, domain: result.data.custom_domain })
      : buildHostedWebsiteUrl({ slug: result.data.slug }),
    customDomainInstructions: useCustomDomain
      ? {
          domain: requestedCustomDomain,
          type: "CNAME",
          name: "www",
          value: customDomainTarget,
          apexHint: `ALIAS/ANAME -> ${customDomainTarget}`,
        }
      : null,
  });
}

export default withAuth(handler);
