import { supabaseAdmin } from "../supabaseAdmin";
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
    const name = pageNameFromValue(page) || (index === 0 ? "Home" : `Page ${index + 1}`);
    const slug = slugify(page?.slug || name, index === 0 ? "home" : `page-${index + 1}`);
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    normalized.push({
      ...page,
      id: String(page?.id || slug || `page-${index + 1}`),
      name,
      slug,
      file: page?.file || `${slug}.json`,
      order: Number.isFinite(Number(page?.order)) ? Number(page.order) : normalized.length,
    });
  });

  return normalized.length ? normalized : [{ name: "Home", slug: "home", id: "home", file: "home.json", order: 0 }];
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

function buildSiteDocument(project, accountId, siteId) {
  const pages = normalizePages(project);
  const site = stripPageMaps(project);
  return {
    ...site,
    id: siteId,
    accountId,
    name: project?.name || "Untitled Website",
    pages,
    pageOrder: pages.map((page) => page.id || page.slug || page.name),
    pageSlugs: Object.fromEntries(pages.map((page) => [page.name, page.slug])),
    globalNavBlock: project?.globalNavBlock || null,
    globalFooterBlock: project?.globalFooterBlock || null,
    publication: project?.publication || null,
    published: !!project?.published,
    updatedAt: project?.updatedAt || new Date().toISOString(),
    storageVersion: 3,
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
    pageBlocks: {},
    pagesContent: {},
    chaiData: {},
  };

  for (const page of pages) {
    const row = byPageId.get(String(page.id)) || bySlug.get(String(page.slug));
    const pageData = row?.page_data && typeof row.page_data === "object" ? row.page_data : {};
    const name = page.name || pageData.name || row?.name || "";
    if (!name) continue;
    project.pageBlocks[name] = Array.isArray(row?.blocks) ? row.blocks : [];
    project.pagesContent[name] = row?.html || "";
    if (row?.chai_data) project.chaiData[name] = row.chai_data;
  }

  return project;
}

function buildPageDocument(project, page, existingPage = null) {
  const name = page.name;
  const incomingBlocks = Array.isArray(project?.pageBlocks?.[name])
    ? project.pageBlocks[name]
    : Array.isArray(project?.chaiData?.[name]?.blocks)
      ? project.chaiData[name].blocks
      : null;
  const blocks = incomingBlocks || (Array.isArray(existingPage?.blocks) ? existingPage.blocks : []);
  const chaiData = Object.prototype.hasOwnProperty.call(project?.chaiData || {}, name)
    ? project.chaiData[name] || null
    : existingPage?.chai_data || null;
  const html = Array.isArray(blocks) && blocks.length
    ? ""
    : (Object.prototype.hasOwnProperty.call(project?.pagesContent || {}, name) ? project.pagesContent[name] || "" : existingPage?.html || "");

  return {
    id: page.id,
    name,
    slug: page.slug,
    seo: page.seo || page.seoSettings || {},
    sections: Array.isArray(page.sections) ? page.sections : [],
    widgets: Array.isArray(page.widgets) ? page.widgets : [],
    styles: page.styles || page.pageStyles || {},
    assets: page.assets || page.assetRefs || [],
    objective: page.objective || "",
    blocks,
    chaiData,
    html,
    updatedAt: project?.updatedAt || new Date().toISOString(),
  };
}

function shouldPreserveExistingPageBlocks(existingBlocks, incomingBlocks, source = "") {
  const sourceKey = String(source || "").toLowerCase();
  if (!sourceKey.includes("autosave")) return false;
  if (!Array.isArray(existingBlocks)) return false;
  if (!Array.isArray(incomingBlocks)) return existingBlocks.length > 0;
  if (existingBlocks.length <= incomingBlocks.length) return false;

  const incomingTypes = new Set(incomingBlocks.map((block) => String(block?.type || "")));
  return existingBlocks.some((block) => !incomingTypes.has(String(block?.type || "")));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function blocksMatchForStorage(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  return stableJson(JSON.parse(JSON.stringify(left))) === stableJson(JSON.parse(JSON.stringify(right)));
}

function summarizeBlocksForStorage(blocks = []) {
  const safeBlocks = Array.isArray(blocks) ? blocks : [];
  return {
    count: safeBlocks.length,
    textBlocks: safeBlocks
      .map((block, index) => {
        if (block?.type !== "text") return null;
        const text = String(block?.props?.text || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        return { index, id: block?.id || "", textLength: text.length, textPreview: text.slice(0, 80) };
      })
      .filter(Boolean),
  };
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
  const siteId = String(project?.id || options?.siteId || "").trim().replace(/^draft:/, "");
  if (!accountId || !siteId) throw new Error("accountId and siteId are required for website storage");

  try {
    const now = new Date().toISOString();
    const backupSource = options?.backupSource || options?.source || (options?.siteOnly ? "site-save" : "page-save");
    const existingSite = await fetchSiteRow(accountId, siteId);
    const existingPages = existingSite ? await fetchPageRows(accountId, siteId) : [];
    const existingByName = new Map(existingPages.map((row) => [String(row.name), row]));
    const site = buildSiteDocument({ ...(existingSite?.site_data || {}), ...(project || {}), id: siteId, updatedAt: now }, accountId, siteId);

    const siteResult = await supabaseAdmin.from(SITES_TABLE).upsert({
      user_id: accountId,
      site_id: siteId,
      name: site.name || "Untitled Website",
      site_data: site,
      updated_at: now,
    }, { onConflict: "user_id,site_id" }).select("*").maybeSingle();
    if (siteResult.error) throw siteResult.error;

    if (options?.siteOnly) {
      const activePageIds = new Set(site.pages.map((page) => String(page.id)));
      const stalePages = existingPages.filter((row) => !activePageIds.has(String(row.page_id)));
      for (const stalePage of stalePages) {
        await writePageVersion(accountId, siteId, stalePage, backupSource || "site-save", "Before deleting website page row");
      }
      if (stalePages.length) {
        const deleteResult = await supabaseAdmin
          .from(PAGES_TABLE)
          .delete()
          .eq("user_id", accountId)
          .eq("site_id", siteId)
          .in("page_id", stalePages.map((row) => row.page_id));
        if (deleteResult.error) throw deleteResult.error;
      }
    }

    if (!options?.siteOnly) {
      const selectedPageName = pageNameFromValue(options?.pageName || "");
      const pagesToSave = selectedPageName
        ? site.pages.filter((page) => page.name === selectedPageName || page.slug === slugify(selectedPageName))
        : site.pages;

      if (selectedPageName && pagesToSave.length === 0) {
        throw new Error(`Cannot save website page "${selectedPageName}" because it is not in the site page list.`);
      }

      for (const page of pagesToSave) {
        const existing = existingByName.get(page.name) || existingPages.find((row) => row.slug === page.slug) || null;
        let incomingProject = project;
        const incomingBlocks = Array.isArray(project?.pageBlocks?.[page.name]) ? project.pageBlocks[page.name] : null;
        const preservingExistingBlocks = shouldPreserveExistingPageBlocks(existing?.blocks, incomingBlocks, backupSource);
        if (preservingExistingBlocks) {
          incomingProject = {
            ...project,
            pageBlocks: { ...(project?.pageBlocks || {}), [page.name]: existing.blocks },
            pagesContent: { ...(project?.pagesContent || {}), [page.name]: existing.html || "" },
            chaiData: existing.chai_data
              ? { ...(project?.chaiData || {}), [page.name]: existing.chai_data }
              : project?.chaiData,
          };
        }

        if (existing) {
          await writePageVersion(accountId, siteId, existing, backupSource, options?.backupReason || "Before website builder save");
        }

        const pageDoc = buildPageDocument({ ...incomingProject, updatedAt: now }, page, existing);
        const pageResult = await supabaseAdmin.from(PAGES_TABLE).upsert({
          user_id: accountId,
          site_id: siteId,
          page_id: page.id,
          name: page.name,
          slug: page.slug,
          page_order: Number.isFinite(Number(page.order)) ? Number(page.order) : 0,
          page_data: pageDoc,
          blocks: pageDoc.blocks,
          chai_data: pageDoc.chaiData,
          html: pageDoc.html || "",
          updated_at: now,
        }, { onConflict: "user_id,site_id,page_id" }).select("page_id, blocks, chai_data, html").maybeSingle();
        if (pageResult.error) throw pageResult.error;
        if (!Array.isArray(pageResult.data?.blocks)) throw new Error(`Website save verification failed for "${page.name}"`);
        if (!preservingExistingBlocks && !blocksMatchForStorage(pageDoc.blocks, pageResult.data.blocks)) {
          console.error("[website-builder storage] page save verification mismatch", {
            siteId,
            pageName: page.name,
            source: backupSource,
            expected: summarizeBlocksForStorage(pageDoc.blocks),
            stored: summarizeBlocksForStorage(pageResult.data.blocks),
          });
          throw new Error(`Website save verification failed for "${page.name}": stored blocks did not match submitted blocks.`);
        }
        if (preservingExistingBlocks) {
          console.warn("[website-builder storage] ignored stale autosave payload and preserved newer stored page blocks", {
            siteId,
            pageName: page.name,
            source: backupSource,
            incoming: summarizeBlocksForStorage(incomingBlocks || []),
            preserved: summarizeBlocksForStorage(pageResult.data.blocks),
          });
        }
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
  return { ...project, pageBlocks: {}, pagesContent: {}, chaiData: {} };
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
