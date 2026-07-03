import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withWorkspace";
import {
  buildDefaultSiteDomain,
  buildHostedWebsiteUrl,
  buildWebsitePath,
  buildWebsiteUrl,
  collectVideoHeroMedia,
  createPublicationPayload,
  getCustomDomainTargetHost,
  getPublishHost,
  getSiteRootDomain,
  normalizeDomain,
  slugifyWebsiteValue,
} from "../../../lib/website-builder/publishConfig";
import { loadFullSplitWebsiteProject } from "../../../lib/website-builder/supabaseSiteStorage";
import { createWebsiteBuilderBackup } from "../../../lib/website-builder/backupStorage";

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

async function clearPrimaryWebsiteFlags(userId, keepId = "") {
  const { data } = await supabaseAdmin
    .from("published_websites")
    .select("id, site_data")
    .eq("user_id", userId)
    .eq("published", true)
    .limit(100);

  for (const row of Array.isArray(data) ? data : []) {
    if (!row?.id || row.id === keepId) continue;
    const siteData = row.site_data && typeof row.site_data === "object" ? row.site_data : {};
    const publication = siteData.publication && typeof siteData.publication === "object" ? siteData.publication : {};
    if (siteData.isPrimaryWebsite === true || publication.isPrimaryWebsite === true || publication.primaryWebsite === true) {
      await supabaseAdmin
        .from("published_websites")
        .update({
          site_data: {
            ...siteData,
            isPrimaryWebsite: false,
            publication: {
              ...publication,
              isPrimaryWebsite: false,
              primaryWebsite: false,
            },
          },
        })
        .eq("id", row.id);
    }
  }
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
  const videoHeroMediaBeforePublish = collectVideoHeroMedia(project?.pageBlocks || {});
  const videoHeroMediaForPublish = collectVideoHeroMedia(publication.site_data?.pageBlocks || {});
  console.log("[website-publish] Video Hero media", {
    projectId: project?.id || "",
    slug: publication.slug,
    before: videoHeroMediaBeforePublish,
    published: videoHeroMediaForPublish,
  });
  const projectId = String(project.id || "").trim() || null;
  let existingPublication = null;
  if (projectId) {
    const { data } = await supabaseAdmin
      .from("published_websites")
      .select("id, custom_domain, domain_status")
      .eq("user_id", userId)
      .eq("project_id", projectId)
      .limit(1)
      .maybeSingle();
    existingPublication = data || null;
  }

  const requestedCustomDomain = normalizeDomain(req.body?.customDomain) || normalizeDomain(existingPublication?.custom_domain);
  const useCustomDomain = !!requestedCustomDomain;
  const nextDomainStatus = useCustomDomain
    ? (normalizeDomain(existingPublication?.custom_domain) === requestedCustomDomain
      ? (existingPublication?.domain_status || "pending_verification")
      : "pending_verification")
    : "generated";
  const requestedSlug = slugifyWebsiteValue(req.body?.slug || publication.slug);
  const rootDomain = getSiteRootDomain();
  const requestedRootPrimaryWebsite = req.body?.primaryWebsite === true
    || (rootDomain && (requestedCustomDomain === rootDomain || requestedCustomDomain === `www.${rootDomain}`))
    || requestedSlug === "gr8-result-digital-solutions";
  const primaryWebsiteUrl = useCustomDomain
    ? buildWebsiteUrl({ slug: requestedSlug, domain: requestedCustomDomain })
    : buildHostedWebsiteUrl({ slug: requestedSlug });
  const internalPreviewUrl = buildHostedWebsiteUrl({ slug: requestedSlug });
  if (!requestedSlug) {
    return res.status(400).json({ ok: false, error: "A site slug is required to publish" });
  }

  const slug = requestedSlug;
  const primaryDomain = requestedCustomDomain || buildDefaultSiteDomain(slug) || null;
  const customDomainTarget = getCustomDomainTargetHost();

  if (projectId) {
    await createWebsiteBuilderBackup(userId, projectId, {
      source: "publish",
      reason: "Before publishing website",
      project,
      metadata: { slug, customDomain: requestedCustomDomain || "" },
    });
  }

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
    domain_status: nextDomainStatus,
    published: true,
    published_at: new Date().toISOString(),
    site_data: {
      ...publication.site_data,
      slug,
      publishedAt: new Date().toISOString(),
      isPrimaryWebsite: requestedRootPrimaryWebsite,
      primaryWebsiteUrl,
      internalPreviewUrl,
      publication: {
        ...(publication.site_data?.publication || {}),
        isPrimaryWebsite: requestedRootPrimaryWebsite,
        primaryWebsite: requestedRootPrimaryWebsite,
        primaryWebsiteUrl,
        internalPreviewUrl,
        rootDomain: rootDomain || null,
      },
    },
  };

  let existing = existingPublication?.id ? { id: existingPublication.id } : null;
  if (projectId && !existing) {
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

  if (requestedRootPrimaryWebsite) {
    await clearPrimaryWebsiteFlags(userId, result.data.id);
  }

  return res.status(200).json({
    ok: true,
    publication: result.data,
    primaryWebsite: requestedRootPrimaryWebsite,
    primaryWebsiteUrl,
    internalPreviewUrl,
    rootUrl: requestedRootPrimaryWebsite && rootDomain ? `https://${rootDomain}` : null,
    sitePath: buildWebsitePath(result.data.slug),
    defaultUrl: internalPreviewUrl,
    liveUrl: primaryWebsiteUrl,
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
