import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withWorkspace";
import {
  buildDefaultSiteDomain,
  buildWebsitePath,
  collectVideoHeroMedia,
  getCustomDomainTargetHost,
  getPublishHost,
  getSiteRootDomain,
  normalizeDomain,
  resolveWebsiteUrls,
  slugifyWebsiteValue,
  withProjectPublicationIdentity,
} from "../../../lib/website-builder/publishConfig";
import { assembleWebsiteForRendering } from "../../../lib/website-builder/supabaseSiteStorage";
import { getPublishedWebsiteByDomain } from "../../../lib/website-builder/publicationStore";
import { createWebsiteBuilderBackup } from "../../../lib/website-builder/backupStorage";
import {
  diffWebsitePersistence,
  buildWebsiteProjectVersion,
  summarizeWebsitePage,
  websiteContentHash,
  websitePersistenceHash,
} from "../../../lib/website-builder/documentVersion";
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

function countFooterCards(block = null) {
  if (!block || block.type !== "footer") return 0;
  const props = block.props || {};
  const order = Array.isArray(props.footerCardOrder) ? props.footerCardOrder.filter(Boolean) : [];
  if (order.length) return order.length;
  const groups = Array.isArray(props.linkGroups)
    ? props.linkGroups.filter((group) => group?.type === "australian-company-panel" || Array.isArray(group?.links))
    : [];
  return 1 + groups.length + (props.showNewsletter === false ? 0 : 1);
}

function summarizePublishSnapshot(siteData = {}) {
  const pages = Array.isArray(siteData.pages) ? siteData.pages : [];
  const pageBlocks = siteData.pageBlocks && typeof siteData.pageBlocks === "object" ? siteData.pageBlocks : {};
  return {
    pageCount: pages.length,
    pageIds: pages.map((page) => page?.id || page?.slug || page?.name || "").filter(Boolean),
    pageSlugs: pages.map((page) => page?.slug || "").filter(Boolean),
    blockCounts: Object.fromEntries(pages.map((page) => [page?.slug || page?.name || "", Array.isArray(pageBlocks?.[page?.name]) ? pageBlocks[page.name].length : 0])),
    footerCardCount: countFooterCards(siteData.globalFooterBlock),
    navStickyMode: siteData.globalNavBlock?.props?.stickyMode || "",
  };
}

function revisionSortValue(siteData = {}) {
  const revision = siteData?.publishedVersion || siteData?.publication?.publishedVersion || siteData?.projectVersion || "";
  const match = String(revision || "").match(/^pv_(\d{8,17})_/);
  return match ? match[1] : "";
}

function timeValue(value = "") {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? time : 0;
}

function sortPublicationRows(rows = []) {
  return [...(Array.isArray(rows) ? rows : [])].sort((left, right) => {
    const activeRank = Number(right?.published === true) - Number(left?.published === true);
    if (activeRank) return activeRank;
    const rightRevision = revisionSortValue(right?.site_data || {});
    const leftRevision = revisionSortValue(left?.site_data || {});
    if (rightRevision !== leftRevision) return rightRevision.localeCompare(leftRevision);
    return timeValue(right?.published_at) - timeValue(left?.published_at)
      || timeValue(right?.updated_at) - timeValue(left?.updated_at);
  });
}

function describePublicationRow(row = {}) {
  const siteData = row?.site_data && typeof row.site_data === "object" ? row.site_data : {};
  return {
    id: row?.id || "",
    projectId: row?.project_id || siteData.id || "",
    slug: row?.slug || siteData.slug || "",
    customDomain: row?.custom_domain || siteData.customDomain || siteData.custom_domain || "",
    primaryDomain: row?.primary_domain || siteData.primaryDomain || siteData.primary_domain || "",
    published: row?.published === true,
    revision: siteData.publishedVersion || siteData.projectVersion || siteData.publication?.publishedVersion || "",
    snapshotHash: siteData.publication?.publishedSnapshotHash || siteData.contentHash || "",
    publishedAt: row?.published_at || siteData.publishedAt || "",
    updatedAt: row?.updated_at || siteData.updatedAt || "",
  };
}

async function loadIntendedPublishedRows({ userId, projectId, slug, customDomain, primaryDomain }) {
  let query = supabaseAdmin
    .from("published_websites")
    .select("id, user_id, project_id, slug, primary_domain, custom_domain, domain_status, site_data, published, published_at, updated_at")
    .eq("user_id", userId)
    .eq("published", true);

  const filters = [];
  if (projectId) filters.push(`project_id.eq.${projectId}`);
  if (slug) filters.push(`slug.eq.${slug}`);
  if (customDomain) filters.push(`custom_domain.eq.${customDomain}`);
  if (primaryDomain) filters.push(`primary_domain.eq.${primaryDomain}`);
  if (!filters.length) return { data: [], error: null };

  query = query.or(filters.join(","));
  const result = await query.limit(25);
  return { data: Array.isArray(result.data) ? result.data : [], error: result.error || null };
}

async function writePublishedWebsiteRow(existingId, nextRecord) {
  if (existingId) {
    const result = await supabaseAdmin
      .from("published_websites")
      .update(nextRecord)
      .eq("id", existingId)
      .select("id, project_id, slug, primary_domain, custom_domain, domain_status, site_data, published_at, updated_at");
    return { ...result, data: Array.isArray(result.data) ? result.data : [] };
  }

  const result = await supabaseAdmin
    .from("published_websites")
    .insert(nextRecord)
    .select("id, project_id, slug, primary_domain, custom_domain, domain_status, site_data, published_at, updated_at");
  return { ...result, data: Array.isArray(result.data) ? result.data : [] };
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
  const requestedDomainForProject = normalizeDomain(req.body?.customDomain);
  const assembledSnapshot = splitProjectId
    ? await assembleWebsiteForRendering(userId, splitProjectId, {
        slug: incomingProject?.slug || req.body?.slug || "",
        customDomain: requestedDomainForProject || incomingProject?.customDomain || incomingProject?.custom_domain || incomingProject?.publication?.customDomain || "",
        custom_domain: requestedDomainForProject || incomingProject?.custom_domain || incomingProject?.customDomain || incomingProject?.publication?.custom_domain || "",
        primaryDomain: incomingProject?.primaryDomain || incomingProject?.primary_domain || incomingProject?.publication?.primaryDomain || "",
        primary_domain: incomingProject?.primary_domain || incomingProject?.primaryDomain || incomingProject?.publication?.primary_domain || "",
        name: incomingProject?.name || "",
      })
    : null;
  const mergedBrandAssets = mergeWebsiteBuilderAssetSources(incomingProject?.brandAssets, assembledSnapshot?.brandAssets);
  const project = withProjectPublicationIdentity({
    ...(assembledSnapshot || incomingProject || {}),
    customDomain: requestedDomainForProject || assembledSnapshot?.customDomain || incomingProject?.customDomain || incomingProject?.custom_domain || "",
    custom_domain: requestedDomainForProject || assembledSnapshot?.custom_domain || incomingProject?.custom_domain || incomingProject?.customDomain || "",
    brandAssets: mergedBrandAssets,
  });
  if (!project || typeof project !== "object") {
    return res.status(400).json({ ok: false, error: "Missing website project payload" });
  }
  const savedVersionMeta = project?.projectVersion && project?.savedAt && project?.contentHash
    ? { projectVersion: project.projectVersion, savedAt: project.savedAt, contentHash: project.contentHash }
    : buildWebsiteProjectVersion(project, project?.savedAt || project?.updatedAt || new Date().toISOString());

  const sourceDraftHash = websitePersistenceHash(project);
  const assembledSnapshotHash = websitePersistenceHash(project);
  const assembledFullHash = websiteContentHash(project);
  const assembledStructuralHash = assembledFullHash;
  const assembledSummary = summarizePublishSnapshot(project);
  const videoHeroMediaBeforePublish = collectVideoHeroMedia(project?.pageBlocks || {});
  const videoHeroMediaForPublish = collectVideoHeroMedia(project?.pageBlocks || {});
  console.log("[website-publish] Video Hero media", {
    projectId: project?.id || "",
    slug: project?.slug || "",
    before: videoHeroMediaBeforePublish,
    published: videoHeroMediaForPublish,
  });
  const projectId = String(project.id || "").trim() || null;
  const requestedCustomDomain = requestedDomainForProject || normalizeDomain(project?.customDomain || project?.custom_domain);
  const requestedSlug = slugifyWebsiteValue(req.body?.slug || project?.slug || project?.name || splitProjectId);
  if (!requestedSlug) {
    return res.status(400).json({ ok: false, error: "A site slug is required to publish" });
  }
  const slug = requestedSlug;
  const primaryDomain = requestedCustomDomain || buildDefaultSiteDomain(slug) || null;
  const intendedRowsResult = await loadIntendedPublishedRows({
    userId,
    projectId,
    slug,
    customDomain: requestedCustomDomain,
    primaryDomain,
  });
  if (intendedRowsResult.error) {
    return res.status(500).json({ ok: false, error: toErrorMessage(intendedRowsResult.error, "Could not inspect existing published website rows") });
  }
  const intendedRows = sortPublicationRows(intendedRowsResult.data);
  const projectRows = projectId ? intendedRows.filter((row) => row.project_id === projectId) : [];
  const conflictingRows = intendedRows.filter((row) => projectId && row.project_id && row.project_id !== projectId);
  if (conflictingRows.length) {
    return res.status(409).json({
      ok: false,
      error: "Publish stopped: the requested slug or domain is already attached to a different published website row.",
      code: "WEBSITE_PUBLISH_CONFLICTING_PUBLISHED_ROWS",
      rows: conflictingRows.map(describePublicationRow),
    });
  }
  if (projectRows.length > 1) {
    return res.status(409).json({
      ok: false,
      error: "Publish stopped: multiple active published rows exist for this website project.",
      code: "WEBSITE_PUBLISH_DUPLICATE_PROJECT_ROWS",
      rows: projectRows.map(describePublicationRow),
    });
  }
  const existingPublication = projectRows[0] || intendedRows[0] || null;
  const useCustomDomain = !!requestedCustomDomain;
  const nextDomainStatus = useCustomDomain
    ? (normalizeDomain(existingPublication?.custom_domain) === requestedCustomDomain
      ? (existingPublication?.domain_status || "pending_verification")
      : "pending_verification")
    : "generated";
  const rootDomain = getSiteRootDomain();
  const requestedRootPrimaryWebsite = req.body?.primaryWebsite === true
    || (rootDomain && (requestedCustomDomain === rootDomain || requestedCustomDomain === `www.${rootDomain}`))
    || requestedSlug === "gr8-result-digital-solutions";
  const resolvedUrls = resolveWebsiteUrls({
    ...project,
    slug: requestedSlug,
    customDomain: requestedCustomDomain || "",
    custom_domain: requestedCustomDomain || "",
    domainStatus: nextDomainStatus,
    domain_status: nextDomainStatus,
  });
  const primaryWebsiteUrl = resolvedUrls.primaryPublicUrl;
  const internalPreviewUrl = resolvedUrls.internalPreviewUrl;

  const customDomainTarget = getCustomDomainTargetHost();
  const publishedAt = new Date().toISOString();
  const publishedVersionMeta = buildWebsiteProjectVersion(project, publishedAt);
  const finalSiteData = {
    ...project,
    slug,
    customDomain: requestedCustomDomain || project.customDomain || project.custom_domain || "",
    custom_domain: requestedCustomDomain || project.custom_domain || project.customDomain || "",
    primaryDomain,
    primary_domain: primaryDomain,
    projectVersion: savedVersionMeta.projectVersion,
    savedAt: savedVersionMeta.savedAt,
    contentHash: savedVersionMeta.contentHash,
    publishedVersion: publishedVersionMeta.projectVersion,
    publishedAt,
    published_at: publishedAt,
    publishedContentHash: assembledSnapshotHash,
    isPrimaryWebsite: requestedRootPrimaryWebsite,
    primaryWebsiteUrl,
    internalPreviewUrl,
    publication: {
      ...(project.publication || {}),
      verified: true,
      verifiedAt: publishedAt,
      isPrimaryWebsite: requestedRootPrimaryWebsite,
      primaryWebsite: requestedRootPrimaryWebsite,
      primaryWebsiteUrl,
      internalPreviewUrl,
      rootDomain: rootDomain || null,
      projectVersion: savedVersionMeta.projectVersion,
      savedAt: savedVersionMeta.savedAt,
      publishedVersion: publishedVersionMeta.projectVersion,
      publishedAt,
      publishedSnapshotHash: assembledSnapshotHash,
      publishedFullHash: assembledFullHash,
      publishedStructuralHash: assembledStructuralHash,
      pageCount: assembledSummary.pageCount,
      footerCardCount: assembledSummary.footerCardCount,
    },
  };
  const finalSiteDataHash = websitePersistenceHash(finalSiteData);
  const finalSiteDataFullHash = websiteContentHash(finalSiteData);

  console.info("[website-publish] assembled draft for publication", {
    sourceWebsiteId: splitProjectId || projectId || "",
    sourceProjectId: projectId || "",
    selectedPage: req.body?.page || req.body?.pageName || "",
    sourceDraftRevision: project?.projectVersion || "",
    sourceContentHash: project?.contentHash || sourceDraftHash,
    sourcePersistenceHash: sourceDraftHash,
    existingCandidateCount: intendedRows.length,
    previousPublishedRecordId: existingPublication?.id || "",
    previousPublishedRevision: existingPublication?.site_data?.publishedVersion || existingPublication?.site_data?.projectVersion || "",
    previousPublishedAt: existingPublication?.published_at || "",
    previousSnapshotHash: existingPublication?.site_data?.publication?.publishedSnapshotHash || existingPublication?.site_data?.contentHash || "",
    newPublishedRevision: publishedVersionMeta.projectVersion,
    snapshotHash: assembledSnapshotHash,
    snapshotFullHash: assembledFullHash,
    structuralHash: assembledStructuralHash,
    pageCount: assembledSummary.pageCount,
    footerCardCount: assembledSummary.footerCardCount,
    customDomain: requestedCustomDomain || "",
  });

  if (projectId) {
    // Best-effort local dev recovery snapshot -- Supabase (published_websites) is the
    // durable record either way, so a snapshot failure must never fail the publish itself.
    await createWebsiteBuilderBackup(userId, projectId, {
      source: "publish",
      reason: "Before publishing website",
      project,
      metadata: { slug, customDomain: requestedCustomDomain || "" },
    }).catch((error) => {
      console.warn("[website-publish] local backup snapshot failed (non-fatal)", { projectId, error: error?.message || error });
    });
  }

  if (supabaseAdmin?.from == null) {
    return res.status(500).json({ ok: false, error: "Website publishing is not configured correctly on the server" });
  }

  const nextRecord = {
    user_id: userId,
    project_id: projectId,
    name: project.name,
    slug,
    primary_domain: primaryDomain,
    custom_domain: useCustomDomain ? requestedCustomDomain : null,
    domain_status: nextDomainStatus,
    published: true,
    published_at: publishedAt,
    site_data: finalSiteData,
  };

  const result = await writePublishedWebsiteRow(existingPublication?.id || "", nextRecord);
  const updateCount = Array.isArray(result.data) ? result.data.length : 0;
  console.info("[website-publish] database write result", {
    projectId,
    websiteId: splitProjectId || projectId || "",
    selectedPage: req.body?.page || req.body?.pageName || "",
    publishedRecordId: result.data?.[0]?.id || existingPublication?.id || "",
    oldPublishedRevision: existingPublication?.site_data?.publishedVersion || existingPublication?.site_data?.projectVersion || "",
    newPublishedRevision: publishedVersionMeta.projectVersion,
    oldSnapshotHash: existingPublication?.site_data?.publication?.publishedSnapshotHash || existingPublication?.site_data?.contentHash || "",
    newSnapshotHash: assembledSnapshotHash,
    databaseUpdateCount: updateCount,
    databaseError: result.error?.message || "",
  });

  if (result.error || updateCount !== 1) {
    if (isMissingPublishedWebsitesTable(result.error)) {
      return res.status(500).json({ ok: false, error: "Website publishing is not set up yet. The publishing table is missing from Supabase." });
    }
    return res.status(500).json({
      ok: false,
      error: result.error
        ? toErrorMessage(result.error, "Could not publish website")
        : `Publish failed: expected exactly one published website row to be written, but ${updateCount} rows were returned.`,
      code: "WEBSITE_PUBLISH_WRITE_ROW_COUNT_MISMATCH",
      expectedRowCount: 1,
      actualRowCount: updateCount,
      intendedRowId: existingPublication?.id || null,
    });
  }

  result.data = result.data[0];

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
  const verifiedSummary = summarizePublishSnapshot(verifyResult.data.site_data || {});
  const missingPageId = assembledSummary.pageIds.find((pageId) => !verifiedSummary.pageIds.includes(pageId));
  const missingPageSlug = assembledSummary.pageSlugs.find((pageSlug) => !verifiedSummary.pageSlugs.includes(pageSlug));
  if (missingPageId || missingPageSlug) {
    return res.status(500).json({
      ok: false,
      error: `Published snapshot missing page ${missingPageSlug || missingPageId}`,
      code: "WEBSITE_PUBLISH_READBACK_PAGE_MISSING",
      expected: assembledSummary,
      actual: verifiedSummary,
      publicationRowId: verifyResult.data.id,
    });
  }
  if (verifiedSummary.footerCardCount !== assembledSummary.footerCardCount) {
    return res.status(500).json({
      ok: false,
      error: `Published footer has ${verifiedSummary.footerCardCount} cards but draft footer has ${assembledSummary.footerCardCount}`,
      code: "WEBSITE_PUBLISH_READBACK_FOOTER_CARD_COUNT_MISMATCH",
      expected: assembledSummary,
      actual: verifiedSummary,
      publicationRowId: verifyResult.data.id,
    });
  }
  if (JSON.stringify(videoHeroMediaForPublish) !== JSON.stringify(verifiedVideoHeroMedia)) {
    console.error("[website-publish] Video Hero publish verification failed", {
      projectId,
      slug,
      expected: videoHeroMediaForPublish,
      verified: verifiedVideoHeroMedia,
    });
    return res.status(500).json({
      ok: false,
      error: "Published website verification failed. The published Video Hero URL does not match the saved project.",
      expectedVideoHeroMedia: videoHeroMediaForPublish,
      actualVideoHeroMedia: verifiedVideoHeroMedia,
      publicationRowId: verifyResult.data.id,
    });
  }

  const savedHash = finalSiteDataHash;
  const publishedHash = websitePersistenceHash(verifyResult.data.site_data || {});
  const publishedFullHash = websiteContentHash(verifyResult.data.site_data || {});
  const publishedStructuralHash = publishedFullHash;
  const publishDiffs = savedHash === publishedHash ? [] : diffWebsitePersistence(finalSiteData, verifyResult.data.site_data || {});
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
    finalSiteDataFullHash,
    publishedFullHash,
    publishedStructuralHash,
    pageId: pageSummary.pageId,
    pageName: pageSummary.pageName,
    blockCount: pageSummary.blockCount,
    pageCount: verifiedSummary.pageCount,
    footerCardCount: verifiedSummary.footerCardCount,
  });

  if (savedHash !== publishedHash) {
    return res.status(500).json({
      ok: false,
      error: "Published website verification failed. The live row content hash does not match the assembled rendering snapshot.",
      savedHash,
      publishedHash,
      diffs: publishDiffs.slice(0, 50),
      publicationRowId: verifyResult.data.id,
    });
  }

  const domainReadback = primaryDomain ? await getPublishedWebsiteByDomain(primaryDomain) : null;
  const domainReadbackHash = domainReadback?.site_data ? websitePersistenceHash(domainReadback.site_data) : "";
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
      console.warn("[website-publish] live HTTP verification did not match the written row; database/domain readback remains authoritative", {
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
      publishedStructuralHash,
    },
    verified: {
      ok: true,
      savedHash,
      publishedHash,
      publishedFullHash,
      publishedStructuralHash,
      publicationRowId: verifyResult.data.id,
      domainRowId: domainReadback?.id || null,
      domainHash: domainReadbackHash || null,
      live: liveHttpVerification,
      preview: assembledSummary,
      published: verifiedSummary,
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
