import { supabaseAdmin } from "../supabaseAdmin";
import { buildFooterNavigationContext, footerBlockToGlobalFooter, globalFooterToFooterBlock } from "./footerNavigation";
import { withPageLayoutDefaults } from "./pageLayout";
import { resolveCanonicalGlobalFooterBlock, withProjectPublicationIdentity } from "./publishConfig";
import { normalizeSharedPrimaryNavigation } from "./sharedNavigation";
import { normalizeVideoHeroBlocksForPersistence, syncVideoHeroChaiDataBlocks } from "./videoHero";
import * as fileStorage from "./siteStorage";

const SITES_TABLE = "website_builder_sites";
const PAGES_TABLE = "website_builder_pages";
const VERSIONS_TABLE = "website_builder_page_versions";
const IS_PRODUCTION_RUNTIME = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

function pageNameFromValue(value) {
  if (typeof value === "string") {
    const text = value.trim();
    return text && text !== "[object Object]" ? text : "";
  }
  if (value && typeof value === "object") {
    return pageNameFromValue(value.name || value.title || value.slug || "");
  }
  return "";
}

function revisionNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? Math.floor(next) : fallback;
}

function readProjectRevision(project = {}) {
  return revisionNumber(project?.revision ?? project?.saveRevision ?? project?.siteRevision, 0);
}

function staleRevisionError(siteId, expectedRevision, storedRevision, pageName = "") {
  const error = new Error(
    `Rejected stale website save for ${siteId}${pageName ? `/${pageName}` : ""}: expected revision ${expectedRevision}, stored revision ${storedRevision}.`
  );
  error.code = "STALE_WEBSITE_REVISION";
  error.expectedRevision = expectedRevision;
  error.storedRevision = storedRevision;
  error.pageName = pageName;
  error.siteId = siteId;
  return error;
}

function slugify(value, fallback = "page") {
  const cleaned = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

function isMissingTableError(error) {
  const message = String(error?.message || "").toLowerCase();
  return error?.code === "42P01"
    || error?.code === "PGRST205"
    || error?.code === "PGRST116"
    || (message.includes("website_builder_") && (message.includes("schema cache") || message.includes("does not exist") || message.includes("could not find")));
}

function canUseLocalFallback() {
  return !IS_PRODUCTION_RUNTIME;
}

function productionStorageError(error) {
  const wrapped = new Error(
    "Website builder durable storage is unavailable. In production, pages must be saved to Supabase; local filesystem fallback is disabled."
  );
  wrapped.code = "WEBSITE_BUILDER_DURABLE_STORAGE_UNAVAILABLE";
  wrapped.cause = error;
  return wrapped;
}

function normalizePages(project) {
  const pages = Array.isArray(project?.pages) && project.pages.length
    ? project.pages
    : [{ name: "Home", objective: "Build the Home page." }];

  const seen = new Set();
  const normalized = [];
  pages.forEach((page, index) => {
    const name = pageNameFromValue(page) || (index === 0 ? "Home" : "");
    if (!name) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[website-builder pages] skipped unnamed page record", {
          index,
          pageId: page?.id || page?.pageId || page?.page_id || "",
          slug: page?.slug || page?.path || "",
          sourceCollection: "project.pages",
        });
      }
      return;
    }
    const slug = slugify(page?.slug || name, index === 0 ? "home" : `page-${index + 1}`);
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    normalized.push(withPageLayoutDefaults({
      ...page,
      id: String(page?.id || slug || `page-${index + 1}`),
      name,
      slug,
      file: page?.file || `${slug}.json`,
      order: Number.isFinite(Number(page?.order)) ? Number(page.order) : normalized.length,
    }));
  });

  return normalized.length ? normalized : [withPageLayoutDefaults({ name: "Home", slug: "home", id: "home", file: "home.json", order: 0 })];
}

function stripPageMaps(project = {}) {
  const {
    pageBlocks: _pageBlocks,
    pagesContent: _pagesContent,
    chaiData: _chaiData,
    brandAssets: _brandAssets,
    ...site
  } = project || {};
  return site;
}

function hasCanonicalPageBlocks(site = {}) {
  if (!site?.pageBlocks || typeof site.pageBlocks !== "object" || Array.isArray(site.pageBlocks)) return false;
  return Object.values(site.pageBlocks).some((blocks) => Array.isArray(blocks));
}

function normalizeCanonicalPageMaps(project = {}, pages = []) {
  const pageBlocksSource = project?.pageBlocks && typeof project.pageBlocks === "object" && !Array.isArray(project.pageBlocks)
    ? project.pageBlocks
    : {};
  const pagesContentSource = project?.pagesContent && typeof project.pagesContent === "object" && !Array.isArray(project.pagesContent)
    ? project.pagesContent
    : {};
  const chaiDataSource = project?.chaiData && typeof project.chaiData === "object" && !Array.isArray(project.chaiData)
    ? project.chaiData
    : {};
  const pageBlocks = {};
  const pagesContent = {};
  const chaiData = {};

  for (const page of pages) {
    const name = page.name;
    const blocks = Object.prototype.hasOwnProperty.call(pageBlocksSource, name)
      ? (Array.isArray(pageBlocksSource[name]) ? pageBlocksSource[name] : [])
      : [];
    const normalizedBlocks = normalizeVideoHeroBlocksForPersistence(blocks);
    pageBlocks[name] = normalizedBlocks;
    pagesContent[name] = Object.prototype.hasOwnProperty.call(pagesContentSource, name) ? pagesContentSource[name] || "" : "";
    const syncedChaiData = syncVideoHeroChaiDataBlocks(chaiDataSource[name] || null, normalizedBlocks);
    chaiData[name] = {
      ...(syncedChaiData && typeof syncedChaiData === "object" && !Array.isArray(syncedChaiData) ? syncedChaiData : {}),
      blocks: normalizedBlocks,
    };
  }

  return { pageBlocks, pagesContent, chaiData };
}

function buildSiteDocument(project, accountId, siteId) {
  project = normalizeSharedPrimaryNavigation(project || {});
  const pages = normalizePages(project);
  const canonicalMaps = normalizeCanonicalPageMaps(project, pages);
  const site = withProjectPublicationIdentity({
    ...stripPageMaps(project),
    pageBlocks: canonicalMaps.pageBlocks,
    pagesContent: canonicalMaps.pagesContent,
    chaiData: canonicalMaps.chaiData,
    brandAssets: project?.brandAssets || {},
  }, {
    slug: project?.slug || project?.name || siteId,
    customDomain: project?.customDomain || project?.custom_domain || project?.publication?.customDomain || project?.publication?.custom_domain || "",
    primaryDomain: project?.primaryDomain || project?.primary_domain || project?.publication?.primaryDomain || project?.publication?.primary_domain || "",
  });
  const footerContext = buildFooterNavigationContext({ pages });
  const globalFooterBlock = resolveCanonicalGlobalFooterBlock(project, footerContext) || project?.globalFooterBlock || globalFooterToFooterBlock(project?.globalFooter, null) || null;
  return {
    ...site,
    id: siteId,
    accountId,
    name: project?.name || "Untitled Website",
    pages,
    pageOrder: pages.map((page) => page.id || page.slug || page.name),
    pageSlugs: Object.fromEntries(pages.map((page) => [page.name, page.slug])),
    globalNavBlock: project?.globalNavBlock || null,
    globalFooterBlock,
    globalFooter: project?.globalFooter || footerBlockToGlobalFooter(globalFooterBlock, footerContext) || null,
    publication: site.publication || project?.publication || null,
    published: !!project?.published,
    updatedAt: project?.updatedAt || new Date().toISOString(),
    revision: readProjectRevision(project),
    saveRevision: readProjectRevision(project),
    siteRevision: revisionNumber(project?.siteRevision, readProjectRevision(project)),
    pageRevisions: project?.pageRevisions && typeof project.pageRevisions === "object" ? project.pageRevisions : {},
    storageVersion: 4,
    canonicalStorage: true,
    storageProvider: "supabase",
  };
}

function buildProjectFromRows(siteRow, pageRows = []) {
  const site = siteRow?.site_data && typeof siteRow.site_data === "object" ? siteRow.site_data : {};
  const pages = normalizePages({ ...site, pages: site.pages });
  const byPageId = new Map((pageRows || []).map((row) => [String(row.page_id), row]));
  const bySlug = new Map((pageRows || []).map((row) => [String(row.slug), row]));
  const project = {
    ...site,
    id: String(site.site_id || site.id || siteRow?.site_id || "").replace(/^draft:/, ""),
    name: site.name || siteRow?.name || "Untitled Website",
    pages,
    updatedAt: siteRow?.updated_at || site.updatedAt || site.createdAt || new Date().toISOString(),
    __saveBaseUpdatedAt: siteRow?.updated_at || site.updatedAt || site.createdAt || "",
    revision: readProjectRevision(site),
    saveRevision: readProjectRevision(site),
    siteRevision: revisionNumber(site.siteRevision, readProjectRevision(site)),
    pageRevisions: site.pageRevisions && typeof site.pageRevisions === "object" ? { ...site.pageRevisions } : {},
    __saveBaseRevision: readProjectRevision(site),
    pageBlocks: {},
    pagesContent: {},
    chaiData: {},
  };

  if (hasCanonicalPageBlocks(site)) {
    const canonicalMaps = normalizeCanonicalPageMaps(site, pages);
    project.pageBlocks = canonicalMaps.pageBlocks;
    project.pagesContent = canonicalMaps.pagesContent;
    project.chaiData = canonicalMaps.chaiData;
  } else {
    for (const page of pages) {
      const row = byPageId.get(String(page.id)) || bySlug.get(String(page.slug));
      const pageData = row?.page_data && typeof row.page_data === "object" ? row.page_data : {};
      const name = page.name || pageData.name || row?.name || "";
      if (!name) continue;
      const blocks = normalizeVideoHeroBlocksForPersistence(Array.isArray(row?.blocks) ? row.blocks : []);
      const pageRevision = revisionNumber(pageData.revision ?? project.pageRevisions[name], 0);
      project.pageRevisions[name] = pageRevision;
      project.pageBlocks[name] = blocks;
      project.pagesContent[name] = row?.html || "";
      const syncedChaiData = syncVideoHeroChaiDataBlocks(row?.chai_data || null, blocks);
      if (syncedChaiData) project.chaiData[name] = syncedChaiData;
    }
  }

  return normalizeSharedPrimaryNavigation(project);
}

async function fetchSiteRow(accountId, siteId) {
  const result = await supabaseAdmin
    .from(SITES_TABLE)
    .select("*")
    .eq("user_id", accountId)
    .eq("site_id", siteId)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data || null;
}

async function fetchPageRows(accountId, siteId) {
  const result = await supabaseAdmin
    .from(PAGES_TABLE)
    .select("*")
    .eq("user_id", accountId)
    .eq("site_id", siteId)
    .order("page_order", { ascending: true });
  if (result.error) throw result.error;
  return Array.isArray(result.data) ? result.data : [];
}

async function loadSupabaseFullProject(accountId, siteId) {
  const site = await fetchSiteRow(accountId, siteId);
  if (!site) return null;
  return buildProjectFromRows(site, await fetchPageRows(accountId, siteId));
}

async function writePageVersion(accountId, siteId, pageRow, source, reason = "") {
  if (!pageRow?.page_id) return;
  const result = await supabaseAdmin.from(VERSIONS_TABLE).insert({
    user_id: accountId,
    site_id: siteId,
    page_id: pageRow.page_id,
    page_name: pageRow.name || pageRow.page_data?.name || pageRow.page_id,
    page_slug: pageRow.slug || pageRow.page_data?.slug || pageRow.page_id,
    source: source || "save",
    reason,
    snapshot: {
      pageData: pageRow.page_data || {},
      blocks: Array.isArray(pageRow.blocks) ? pageRow.blocks : [],
      chaiData: pageRow.chai_data || null,
      html: pageRow.html || "",
      updatedAt: pageRow.updated_at || new Date().toISOString(),
    },
  });
  if (result.error) throw result.error;
}

export async function saveSplitWebsiteProject(accountId, project, options = {}) {
  project = normalizeSharedPrimaryNavigation(project || {});
  const siteId = String(project?.id || options?.siteId || "").trim().replace(/^draft:/, "");
  if (!accountId || !siteId) throw new Error("accountId and siteId are required for website storage");

  try {
    const now = new Date().toISOString();
    const backupSource = options?.backupSource || options?.source || (options?.siteOnly ? "site-save" : "page-save");
    const existingSite = await fetchSiteRow(accountId, siteId);
    const existingPages = existingSite ? await fetchPageRows(accountId, siteId) : [];
    const currentSiteData = existingSite?.site_data && typeof existingSite.site_data === "object" ? existingSite.site_data : {};
    const currentRevision = readProjectRevision(currentSiteData);
    const baseRevisionRaw = options?.baseRevision ?? project?.__saveBaseRevision ?? project?.baseRevision;
    const hasBaseRevision = baseRevisionRaw !== undefined && baseRevisionRaw !== null && String(baseRevisionRaw).trim() !== "";
    const baseRevision = revisionNumber(baseRevisionRaw, 0);
    if (hasBaseRevision && currentRevision > 0 && baseRevision !== currentRevision) {
      throw staleRevisionError(siteId, baseRevision, currentRevision, options?.pageName || "");
    }
    const nextRevision = currentRevision + 1;
    const currentPageRevisions = currentSiteData.pageRevisions && typeof currentSiteData.pageRevisions === "object" ? currentSiteData.pageRevisions : {};
    const nextPageRevisions = { ...currentPageRevisions };
    const selectedPageNameForRevision = pageNameFromValue(options?.pageName || "");
    const pagesForRevision = normalizePages({ ...(currentSiteData || {}), ...(project || {}), id: siteId });
    const revisionPages = options?.siteOnly
      ? []
      : (selectedPageNameForRevision
        ? pagesForRevision.filter((page) => page.name === selectedPageNameForRevision || page.slug === slugify(selectedPageNameForRevision))
        : pagesForRevision);
    for (const page of revisionPages) {
      const currentPageRevision = revisionNumber(currentPageRevisions[page.name], 0);
      nextPageRevisions[page.name] = currentPageRevision + 1;
    }
    const revisionedProject = {
      ...(project || {}),
      revision: nextRevision,
      saveRevision: nextRevision,
      siteRevision: nextRevision,
      pageRevisions: nextPageRevisions,
      __saveBaseRevision: baseRevision,
    };
    const site = buildSiteDocument({ ...(currentSiteData || {}), ...revisionedProject, id: siteId, updatedAt: now }, accountId, siteId);

    const sitePayload = {
      user_id: accountId,
      site_id: siteId,
      name: site.name || "Untitled Website",
      site_data: site,
      updated_at: now,
    };
    const siteResult = existingSite
      ? await supabaseAdmin.from(SITES_TABLE)
        .update(sitePayload)
        .eq("user_id", accountId)
        .eq("site_id", siteId)
        .eq("updated_at", existingSite.updated_at)
        .select("*")
        .maybeSingle()
      : await supabaseAdmin.from(SITES_TABLE)
        .insert(sitePayload)
        .select("*")
        .maybeSingle();
    if (siteResult.error) throw siteResult.error;
    if (existingSite && !siteResult.data) {
      throw staleRevisionError(siteId, baseRevision || currentRevision, currentRevision + 1, options?.pageName || "");
    }

    if (existingPages.length) {
      const selectedPageName = pageNameFromValue(options?.pageName || "");
      const pagesToBackup = selectedPageName
        ? existingPages.filter((row) => row.name === selectedPageName || row.slug === slugify(selectedPageName))
        : existingPages;
      for (const existingPage of pagesToBackup) {
        await writePageVersion(accountId, siteId, existingPage, backupSource, options?.backupReason || "Legacy page-row recovery backup before canonical save");
      }
    }

    return loadFullSplitWebsiteProject(accountId, siteId);
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
    if (!canUseLocalFallback()) throw productionStorageError(error);
    return fileStorage.saveSplitWebsiteProject(accountId, project, options);
  }
}

export async function loadFullSplitWebsiteProject(accountId, siteId) {
  try {
    const safeSiteId = String(siteId || "").replace(/^draft:/, "");
    const project = await loadSupabaseFullProject(accountId, safeSiteId);
    if (project) return project;
    if (!canUseLocalFallback()) return null;
    const localProject = await fileStorage.loadFullSplitWebsiteProject(accountId, siteId);
    if (!localProject) return null;
    return saveSplitWebsiteProject(accountId, { ...localProject, id: safeSiteId }, { backupSource: "local-migration", backupReason: "Migrated local split files to durable Supabase storage" });
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
    if (!canUseLocalFallback()) throw productionStorageError(error);
    return fileStorage.loadFullSplitWebsiteProject(accountId, siteId);
  }
}

export async function assembleWebsiteForRendering(accountId, siteId, overrides = {}) {
  const safeSiteId = String(siteId || "").replace(/^draft:/, "");
  const project = await loadFullSplitWebsiteProject(accountId, safeSiteId);
  if (!project) return null;
  return normalizeSharedPrimaryNavigation(withProjectPublicationIdentity({
    ...project,
    ...(overrides && typeof overrides === "object" ? overrides : {}),
    id: safeSiteId,
    pageBlocks: project.pageBlocks || {},
    pagesContent: project.pagesContent || {},
    chaiData: project.chaiData || {},
    brandAssets: overrides?.brandAssets || project.brandAssets,
  }, {
    slug: overrides?.slug || project.slug || project.name || safeSiteId,
    customDomain: overrides?.customDomain || overrides?.custom_domain || project.customDomain || project.custom_domain || project.publication?.customDomain || "",
    primaryDomain: overrides?.primaryDomain || overrides?.primary_domain || project.primaryDomain || project.primary_domain || project.publication?.primaryDomain || "",
  }));
}

export async function assembleDraftWebsite(accountId, siteId, overrides = {}) {
  return assembleWebsiteForRendering(accountId, siteId, overrides);
}

export async function loadSplitWebsiteProject(accountId, siteId, pageName = "") {
  const project = await loadFullSplitWebsiteProject(accountId, siteId);
  if (!project) return null;
  const requested = slugify(pageName || project.pages?.[0]?.name || "Home", "home");
  const page = project.pages.find((entry) => slugify(entry.name) === requested || slugify(entry.slug) === requested) || project.pages[0];
  if (!page) return project;
  return {
    ...project,
    pageBlocks: { [page.name]: project.pageBlocks?.[page.name] || [] },
    pagesContent: { [page.name]: project.pagesContent?.[page.name] || "" },
    chaiData: project.chaiData?.[page.name] ? { [page.name]: project.chaiData[page.name] } : {},
  };
}

export async function loadSplitWebsiteProjectSite(accountId, siteId) {
  const project = await loadFullSplitWebsiteProject(accountId, siteId);
  if (!project) return null;
  return normalizeSharedPrimaryNavigation({ ...project, pageBlocks: {}, pagesContent: {}, chaiData: {} });
}

export async function migrateWebsiteProjectToSplitStorage(accountId, project, options = {}) {
  const siteId = String(project?.id || options?.siteId || "").trim().replace(/^draft:/, "");
  if (!accountId || !siteId || !project) return null;
  const existing = await loadFullSplitWebsiteProject(accountId, siteId);
  if (!existing || options?.overwrite === true) {
    return saveSplitWebsiteProject(accountId, { ...project, id: siteId }, { loadPageName: options?.pageName || "", backupSource: "migration-write" });
  }
  return existing;
}

export async function listSplitWebsiteProjects(accountId) {
  try {
    const result = await supabaseAdmin
      .from(SITES_TABLE)
      .select("*")
      .eq("user_id", accountId)
      .order("updated_at", { ascending: false });
    if (result.error) throw result.error;
    const projects = (Array.isArray(result.data) ? result.data : []).map((row) => buildProjectFromRows(row, []));
    if (projects.length) return projects;
    if (!canUseLocalFallback()) return [];
    return fileStorage.listSplitWebsiteProjects(accountId);
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
    if (!canUseLocalFallback()) throw productionStorageError(error);
    return fileStorage.listSplitWebsiteProjects(accountId);
  }
}

export async function deleteSplitWebsiteProject(accountId, siteId) {
  try {
    const result = await supabaseAdmin
      .from(SITES_TABLE)
      .delete()
      .eq("user_id", accountId)
      .eq("site_id", String(siteId || "").replace(/^draft:/, ""));
    if (result.error) throw result.error;
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
    if (!canUseLocalFallback()) throw productionStorageError(error);
  }
  if (canUseLocalFallback()) {
    await fileStorage.deleteSplitWebsiteProject(accountId, siteId);
  }
}
