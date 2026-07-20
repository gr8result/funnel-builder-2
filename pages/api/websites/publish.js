import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withWorkspace";
import {
  buildDefaultSiteDomain,
  buildHostedWebsiteUrl,
  buildWebsitePath,
  buildWebsiteUrl,
  collectVideoHeroMedia,
  compareWebsitePublishIntegrity,
  createPublicationPayload,
  getPublishedAssetValidationFailures,
  getCustomDomainTargetHost,
  getPublishHost,
  getSiteRootDomain,
  normalizeDomain,
  slugifyWebsiteValue,
  withProjectPublicationIdentity,
} from "../../../lib/website-builder/publishConfig";
import { loadFullSplitWebsiteProject } from "../../../lib/website-builder/supabaseSiteStorage";
import { getPublishedWebsiteByDomain } from "../../../lib/website-builder/publicationStore";
import { createWebsiteBuilderBackup } from "../../../lib/website-builder/backupStorage";
import { buildWebsiteProjectVersion, summarizeWebsitePage, websiteContentHash } from "../../../lib/website-builder/documentVersion";
import { mergeWebsiteBuilderAssetSources } from "../../../lib/website-builder/mediaAssets";

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

function videoHeroMediaMismatches(expected = [], actual = []) {
  const actualById = new Map((Array.isArray(actual) ? actual : []).map((entry) => [String(entry?.id || ""), entry]));
  return (Array.isArray(expected) ? expected : [])
    .filter((entry) => String(entry?.videoSrc || "").trim())
    .map((entry, index) => {
      const matched = actualById.get(String(entry?.id || "")) || (Array.isArray(actual) ? actual[index] : null);
      const expectedUrl = String(entry?.videoSrc || "").trim();
      const actualUrl = String(matched?.videoSrc || "").trim();
      return expectedUrl === actualUrl ? null : {
        pageName: entry?.pageName || "",
        blockId: entry?.id || "",
        expectedUrl,
        actualUrl,
      };
    })
    .filter(Boolean);
}

function publishedSiteComparable(project) {
  return {
    pages: project?.pages || [],
    pageBlocks: project?.pageBlocks || {},
    pagesContent: project?.pagesContent || {},
    chaiData: project?.chaiData || {},
    globalNavBlock: project?.globalNavBlock || null,
    globalFooterBlock: project?.globalFooterBlock || null,
  };
}

function extractPublicationDebugMeta(html = "") {
  const match = String(html || "").match(/<meta\s+name=["']website-publication-debug["']\s+content=["']([^"']*)["']/i);
  return match?.[1] || "";
}

function debugMetaValue(meta = "", key = "") {
  const prefix = `${key}=`;
  return String(meta || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length)
    || "";
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
  res.setHeader("Cache-Control", "no-store, max-age=0");
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
  const requestedDomainForProject = normalizeDomain(req.body?.customDomain);
  const mergedBrandAssets = mergeWebsiteBuilderAssetSources(incomingProject?.brandAssets, splitProject?.brandAssets);
  const project = withProjectPublicationIdentity(
    splitProject
      ? {
          ...incomingProject,
          ...splitProject,
          slug: incomingProject?.slug || splitProject?.slug,
          customDomain: requestedDomainForProject || incomingProject?.customDomain || incomingProject?.custom_domain || splitProject?.customDomain || splitProject?.custom_domain || "",
          custom_domain: requestedDomainForProject || incomingProject?.custom_domain || incomingProject?.customDomain || splitProject?.custom_domain || splitProject?.customDomain || "",
          publication: {
            ...(splitProject?.publication || {}),
            ...(incomingProject?.publication || {}),
            customDomain: requestedDomainForProject || incomingProject?.publication?.customDomain || incomingProject?.publication?.custom_domain || splitProject?.publication?.customDomain || splitProject?.publication?.custom_domain || "",
            custom_domain: requestedDomainForProject || incomingProject?.publication?.custom_domain || incomingProject?.publication?.customDomain || splitProject?.publication?.custom_domain || splitProject?.publication?.customDomain || "",
          },
          brandAssets: mergedBrandAssets,
        }
      : {
          ...(incomingProject || {}),
          customDomain: requestedDomainForProject || incomingProject?.customDomain || incomingProject?.custom_domain || "",
          custom_domain: requestedDomainForProject || incomingProject?.custom_domain || incomingProject?.customDomain || "",
          brandAssets: mergedBrandAssets,
        }
  );
  if (!project || typeof project !== "object") {
    return res.status(400).json({ ok: false, error: "Missing website project payload" });
  }
  const savedVersionMeta = project?.projectVersion && project?.savedAt && project?.contentHash
    ? { projectVersion: project.projectVersion, savedAt: project.savedAt, contentHash: project.contentHash }
    : buildWebsiteProjectVersion(project, project?.savedAt || project?.updatedAt || new Date().toISOString());

  const publication = createPublicationPayload(project);
  const assetValidationReport = publication.site_data?.publication?.assetValidationReport || {};
  const assetValidationFailures = getPublishedAssetValidationFailures(assetValidationReport);
  if (assetValidationFailures.length) {
    console.error("[website-publish] publish blocked by asset validation", {
      projectId: project?.id || "",
      slug: publication.slug,
      failures: assetValidationFailures,
      summary: assetValidationReport.summary || {},
    });
    return res.status(409).json({
      ok: false,
      error: `Publish blocked: ${assetValidationFailures.length} asset${assetValidationFailures.length === 1 ? "" : "s"} are not public publishable URLs.`,
      code: "WEBSITE_PUBLISH_ASSET_VALIDATION_FAILED",
      assetValidationReport,
      invalidAssets: assetValidationFailures,
      failures: assetValidationFailures,
    });
  }
  const publishIntegrity = compareWebsitePublishIntegrity(project, publication.site_data);
  if (!publishIntegrity.ok) {
    console.error("[website-publish] publish blocked by integrity check", {
      projectId: project?.id || "",
      slug: publication.slug,
      issues: publishIntegrity.issues,
      saved: publishIntegrity.saved,
      published: publishIntegrity.published,
    });
    return res.status(409).json({
      ok: false,
      error: `Publish blocked: ${publishIntegrity.issues[0]?.message || "saved builder content would be removed from the publish payload."}`,
      code: "WEBSITE_PUBLISH_INTEGRITY_FAILED",
      issues: publishIntegrity.issues,
    });
  }
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
      .select("id, project_id, custom_domain, domain_status, updated_at, published_at, site_data")
      .eq("user_id", userId)
      .eq("project_id", projectId)
      .eq("published", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    existingPublication = data || null;
  }

  const requestedCustomDomain = requestedDomainForProject || normalizeDomain(project?.customDomain || project?.custom_domain) || normalizeDomain(existingPublication?.custom_domain);
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

  const publishedAt = new Date().toISOString();
  const nextRecord = {
    user_id: userId,
    project_id: projectId,
    name: publication.name,
    slug,
    primary_domain: primaryDomain,
    custom_domain: useCustomDomain ? requestedCustomDomain : null,
    domain_status: nextDomainStatus,
    published: true,
    published_at: publishedAt,
    site_data: {
      ...publication.site_data,
      slug,
      projectVersion: savedVersionMeta.projectVersion,
      savedAt: savedVersionMeta.savedAt,
      contentHash: savedVersionMeta.contentHash,
      publishedVersion: savedVersionMeta.projectVersion,
      publishedAt,
      published_at: publishedAt,
      publishedContentHash: websiteContentHash(publishedSiteComparable(publication.site_data)),
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
        projectVersion: savedVersionMeta.projectVersion,
        savedAt: savedVersionMeta.savedAt,
        publishedVersion: savedVersionMeta.projectVersion,
        publishedAt,
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
      .eq("published", true)
      .order("published_at", { ascending: false })
      .order("updated_at", { ascending: false })
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
      .select("id, project_id, slug, primary_domain, custom_domain, domain_status, site_data, published_at, updated_at")
      .maybeSingle();
  } else {
    result = await supabaseAdmin
      .from("published_websites")
      .insert(nextRecord)
      .select("id, project_id, slug, primary_domain, custom_domain, domain_status, site_data, published_at, updated_at")
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

  const verifyResult = await supabaseAdmin
    .from("published_websites")
    .select("id, project_id, slug, primary_domain, custom_domain, domain_status, site_data, published_at, updated_at")
    .eq("id", result.data.id)
    .maybeSingle();

  if (verifyResult.error || !verifyResult.data) {
    return res.status(500).json({ ok: false, error: toErrorMessage(verifyResult.error, "Could not verify published website row after update") });
  }

  const verifiedVideoHeroMedia = collectVideoHeroMedia(verifyResult.data.site_data?.pageBlocks || {});
  const verifiedIntegrity = compareWebsitePublishIntegrity(project, verifyResult.data.site_data || {});
  if (!verifiedIntegrity.ok) {
    console.error("[website-publish] published row failed integrity read-back", {
      projectId,
      slug,
      issues: verifiedIntegrity.issues,
      saved: verifiedIntegrity.saved,
      published: verifiedIntegrity.published,
    });
    return res.status(500).json({
      ok: false,
      error: `Published website verification failed. ${verifiedIntegrity.issues[0]?.message || "The live row does not match the saved project."}`,
      code: "WEBSITE_PUBLISH_READBACK_INTEGRITY_FAILED",
      issues: verifiedIntegrity.issues,
      publicationRowId: verifyResult.data.id,
    });
  }
  const videoMismatches = videoHeroMediaMismatches(videoHeroMediaForPublish, verifiedVideoHeroMedia);
  if (videoMismatches.length) {
    console.error("[website-publish] Video Hero publish verification failed", {
      projectId,
      slug,
      expected: videoHeroMediaForPublish,
      verified: verifiedVideoHeroMedia,
      videoMismatches,
    });
    return res.status(500).json({
      ok: false,
      error: "Published website verification failed. The published Video Hero URL does not match the saved project.",
      videoMismatches,
      publicationRowId: verifyResult.data.id,
    });
  }

  const savedHash = websiteContentHash(publishedSiteComparable(publication.site_data));
  const publishedHash = websiteContentHash(publishedSiteComparable(verifyResult.data.site_data || {}));
  const publishedFullHash = websiteContentHash(verifyResult.data.site_data || {});
  const firstPageName = Array.isArray(project?.pages) ? project.pages[0]?.name || "" : "";
  const pageSummary = summarizeWebsitePage(project, firstPageName);
  console.info("[website-publish] verified published row", {
    publicationRowId: verifyResult.data.id,
    projectId,
    slug,
    customDomain: verifyResult.data.custom_domain || null,
    primaryDomain: verifyResult.data.primary_domain || null,
    savedVersion: savedVersionMeta.projectVersion,
    publishedVersion: verifyResult.data.site_data?.publishedVersion || null,
    savedAt: savedVersionMeta.savedAt,
    publishedAt: verifyResult.data.published_at || null,
    savedHash,
    publishedHash,
    hashesMatch: savedHash === publishedHash,
    publishedFullHash,
    pageId: pageSummary.pageId,
    pageName: pageSummary.pageName,
    blockCount: pageSummary.blockCount,
  });

  if (savedHash !== publishedHash) {
    return res.status(500).json({
      ok: false,
      error: "Published website verification failed. The live row content hash does not match the latest saved project.",
      savedHash,
      publishedHash,
      publicationRowId: verifyResult.data.id,
    });
  }

  const domainReadback = primaryDomain ? await getPublishedWebsiteByDomain(primaryDomain) : null;
  const domainReadbackHash = domainReadback?.site_data ? websiteContentHash(publishedSiteComparable(domainReadback.site_data)) : "";
  if (primaryDomain && (!domainReadback || domainReadback.id !== verifyResult.data.id || domainReadbackHash !== publishedHash)) {
    return res.status(500).json({
      ok: false,
      error: "Published website verification failed. The custom domain resolves to a different row or content hash than the row just written.",
      code: "WEBSITE_PUBLISH_DOMAIN_ROW_MISMATCH",
      writtenRowId: verifyResult.data.id,
      writtenHash: publishedHash,
      domainRowId: domainReadback?.id || null,
      domainHash: domainReadbackHash || null,
      domain: primaryDomain,
    });
  }

  let liveHttpVerification = null;
  if (primaryWebsiteUrl && /^https?:\/\//i.test(primaryWebsiteUrl)) {
    try {
      const liveResponse = await fetch(primaryWebsiteUrl, {
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
      const liveHtml = await liveResponse.text();
      const liveMeta = extractPublicationDebugMeta(liveHtml);
      const liveRowId = liveResponse.headers.get("x-gr8-published-row-id") || debugMetaValue(liveMeta, "row");
      const liveHash = liveResponse.headers.get("x-gr8-site-data-hash") || debugMetaValue(liveMeta, "hash");
      liveHttpVerification = {
        ok: liveResponse.ok && liveRowId === verifyResult.data.id && liveHash === publishedFullHash,
        status: liveResponse.status,
        url: liveResponse.url,
        rowId: liveRowId || "",
        hash: liveHash || "",
      };
    } catch (error) {
      liveHttpVerification = { ok: false, error: error?.message || "Could not request live URL" };
    }

    if (!liveHttpVerification?.ok) {
      return res.status(500).json({
        ok: false,
        error: "Published website verification failed. The live domain did not return the row/hash that was just written.",
        code: "WEBSITE_PUBLISH_LIVE_HTTP_MISMATCH",
        writtenRowId: verifyResult.data.id,
        writtenHash: publishedHash,
        writtenFullHash: publishedFullHash,
        live: liveHttpVerification,
      });
    }
  }

  return res.status(200).json({
    ok: true,
    publication: {
      id: verifyResult.data.id,
      slug: verifyResult.data.slug,
      primary_domain: verifyResult.data.primary_domain,
      custom_domain: verifyResult.data.custom_domain,
      domain_status: verifyResult.data.domain_status,
      published_at: verifyResult.data.published_at,
      updated_at: verifyResult.data.updated_at,
      projectVersion: savedVersionMeta.projectVersion,
      savedAt: savedVersionMeta.savedAt,
      publishedVersion: verifyResult.data.site_data?.publishedVersion || savedVersionMeta.projectVersion,
      publishedAt: verifyResult.data.site_data?.publishedAt || verifyResult.data.published_at,
      contentHash: savedHash,
      publishedHash,
      publishedFullHash,
    },
    verified: {
      ok: true,
      savedHash,
      publishedHash,
      publicationRowId: verifyResult.data.id,
      domainRowId: domainReadback?.id || null,
      domainHash: domainReadbackHash || null,
      live: liveHttpVerification,
    },
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
