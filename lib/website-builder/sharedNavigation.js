import { BlockTypes } from "./pageBlockComponents";
import { normalizeVideoHeroBlock } from "./videoHero";

const PRIMARY_NAV_ROLE = "primary-navigation";
const GLOBAL_HEADER_SCHEMA_VERSION = 1;

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  if (value == null) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function stableSiteId(project = {}) {
  return String(project?.id || project?.projectId || project?.slug || project?.name || "website")
    .replace(/^draft:/, "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/(^-|-$)/g, "")
    || "website";
}

export function primaryNavigationSharedComponentId(project = {}) {
  return `shared-primary-navigation-${stableSiteId(project)}`;
}

function navTypeMatches(type = "") {
  return String(type || "") === BlockTypes.NAV_BAR || String(type || "") === "nav-bar" || String(type || "") === "navigation-bar";
}

function slugifyNavValue(value = "") {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeNavPath(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw === "/") return "/";
  if (/^(mailto:|tel:|https?:\/\/)/i.test(raw) || raw.startsWith("#") || raw.startsWith("/")) return raw;
  const clean = raw.replace(/^\.?\/+/, "");
  return clean ? `/${clean}` : "";
}

function buildPageLookup(project = {}) {
  const lookup = new Map();
  (Array.isArray(project?.pages) ? project.pages : []).forEach((page) => {
    const id = String(page?.id || "").trim();
    const slug = slugifyNavValue(page?.slug || page?.name || id);
    const name = String(page?.name || "").trim();
    const label = name || slug || id;
    const href = slug === "home" ? "/" : `/${slug}`;
    const ref = { id: id || slug, slug, label, href };
    [id, slug, name, label, href, `/${slug}`].forEach((key) => {
      const normalized = slugifyNavValue(String(key || "").replace(/^\/+/, "").split(/[?#]/)[0]);
      if (normalized) lookup.set(normalized, ref);
    });
    if (href === "/") lookup.set("/", ref);
  });
  return lookup;
}

function pageIsVisibleInNavigation(page = {}) {
  return page?.hidden !== true
    && page?.navHidden !== true
    && page?.showInNavigation !== false;
}

function pageSortValue(page = {}, index = 0) {
  const navOrder = Number(page?.navigationOrder);
  if (Number.isFinite(navOrder)) return navOrder;
  const order = Number(page?.order);
  if (Number.isFinite(order)) return order;
  return index;
}

function buildPageNavRef(page = {}, index = 0) {
  const name = String(page?.name || page?.title || "").trim();
  const slug = slugifyNavValue(page?.slug || name || page?.id || `page-${index + 1}`);
  if (!slug || !name) return null;
  const id = String(page?.id || slug).trim() || slug;
  return {
    id,
    slug,
    label: String(page?.navigationLabel || page?.navLabel || name).trim() || name,
    href: slug === "home" ? "/" : `/${slug}`,
    order: pageSortValue(page, index),
  };
}

function findPageRef(item = {}, pageLookup = new Map()) {
  const candidates = [
    item.pageId,
    item.page_id,
    item.internalPageId,
    item.targetPageId,
    item.linkedPageId,
    item.page?.id,
    item.slug,
    item.pageSlug,
    item.href,
    item.url,
    item.path,
  ];
  for (const candidate of candidates) {
    const raw = String(candidate || "").trim();
    if (!raw) continue;
    if (raw === "/" && pageLookup.has("/")) return pageLookup.get("/");
    const key = slugifyNavValue(raw.replace(/^\/+/, "").split(/[?#]/)[0]);
    if (key && pageLookup.has(key)) return pageLookup.get(key);
  }
  return null;
}

function canonicalNavKey(item = {}, pageRef = null) {
  if (pageRef?.id) return `page:${pageRef.id}`;
  if (pageRef?.slug) return `slug:${pageRef.slug}`;
  const href = normalizeNavPath(item.href || item.url || item.path || "");
  if (href && !href.startsWith("#")) return `href:${href.toLowerCase()}`;
  return `label:${slugifyNavValue(item.label || item.name || item.title || href)}`;
}

export function normalizeSharedNavigationLinks(links = [], project = {}) {
  const pageLookup = buildPageLookup(project);

  const normalizeItem = (item, index, childIndex = null) => {
    if (!item || typeof item !== "object") return null;
    const pageRef = findPageRef(item, pageLookup);
    const fallbackLabel = String(item.label || item.name || item.title || "").trim();
    const label = fallbackLabel || pageRef?.label || "Link";
    const pageId = pageRef?.id || String(item.pageId || item.page_id || "").trim();
    const slug = pageRef?.slug || slugifyNavValue(item.slug || item.pageSlug || label);
    const explicitHref = normalizeNavPath(item.href || item.url || item.path || "");
    const href = explicitHref || pageRef?.href || "";
    const children = (Array.isArray(item.children) ? item.children : [])
      .map((child, idx) => normalizeItem(child, index, idx))
      .filter(Boolean);

    return {
      ...item,
      label,
      href,
      ...(item.id ? { id: item.id } : {}),
      ...(item.linkType ? { linkType: item.linkType } : {}),
      ...(item.pageId || item.page_id ? { pageId: item.pageId || item.page_id } : {}),
      ...(item.slug || item.pageSlug ? { slug: item.slug || item.pageSlug } : {}),
      ...(children.length ? { children } : {}),
    };
  };

  const normalized = (Array.isArray(links) ? links : []).map((item, index) => normalizeItem(item, index)).filter(Boolean);
  return normalized;
}

export function isPrimaryNavigationBlock(block) {
  return navTypeMatches(block?.type)
    && block?.props?.detachedFromSharedNavigation !== true;
}

function normalizeStickyMode(value = "") {
  const mode = String(value || "").toLowerCase().trim();
  if (mode === "normal" || mode === "static" || mode === "none" || mode === "off") return "normal";
  if (mode === "sticky-solid" || mode === "solid") return "sticky-solid";
  if (mode === "sticky-transparent" || mode === "transparent") return "sticky-transparent";
  return "sticky";
}

function stickyEnabledFromProps(props = {}) {
  if (props.sticky === false || props.positionSticky === false) return false;
  return normalizeStickyMode(props.stickyMode || props.position || (props.sticky || props.positionSticky ? "sticky" : "sticky")) !== "normal";
}

function normalizeCanonicalNavigationBlock(block, project = {}, options = {}) {
  if (!isPrimaryNavigationBlock(block)) return null;
  const sharedComponentId = primaryNavigationSharedComponentId(project);
  const props = block.props || {};
  const previousRevision = String(props.globalHeaderRevision || block.globalHeaderRevision || "").trim();
  const revision = options.revision || previousRevision || nowIso();
  const stickyMode = normalizeStickyMode(options.forceSticky === true ? "sticky" : (props.stickyMode || (stickyEnabledFromProps(props) ? "sticky" : "normal")));
  const normalizedLinks = normalizeSharedNavigationLinks(props.links || props.navigationLinks || [], project);
  const navigationManual = props.navigationManual !== false;
  return normalizeVideoHeroBlock({
    ...clone(block),
    id: sharedComponentId,
    type: BlockTypes.NAV_BAR,
    role: PRIMARY_NAV_ROLE,
    sharedComponentId,
    globalHeaderRevision: revision,
    props: {
      ...props,
      role: PRIMARY_NAV_ROLE,
      sharedComponentId,
      globalHeaderSchemaVersion: GLOBAL_HEADER_SCHEMA_VERSION,
      globalHeaderRevision: revision,
      useGlobalHeader: true,
      navigationManual,
      syncPagesToNavigation: false,
      sticky: stickyMode !== "normal",
      positionSticky: stickyMode !== "normal",
      stickyMode,
      links: normalizedLinks,
      navigationLinks: normalizedLinks,
    },
  });
}

function navigationCandidates(project = {}) {
  const pageBlocks = project?.pageBlocks && typeof project.pageBlocks === "object" ? project.pageBlocks : {};
  const pages = Array.isArray(project?.pages) ? project.pages : [];
  const orderedPageNames = [
    ...pages.map((page) => page?.name).filter(Boolean),
    ...Object.keys(pageBlocks).filter((name) => !pages.some((page) => page?.name === name)),
  ];
  return orderedPageNames.flatMap((pageName, pageIndex) => (
    (Array.isArray(pageBlocks[pageName]) ? pageBlocks[pageName] : [])
      .filter(isPrimaryNavigationBlock)
      .map((block, blockIndex) => ({ block, pageName, pageIndex, blockIndex }))
  ));
}

function scoreNavigationCandidate(entry, project = {}) {
  const block = entry?.block || null;
  const props = block?.props || {};
  const links = Array.isArray(props.links) ? props.links : Array.isArray(props.navigationLinks) ? props.navigationLinks : [];
  const hasLogo = !!String(props.logo || props.logoUrl || props.src || "").trim();
  const sticky = stickyEnabledFromProps(props);
  const shared = !!(block?.sharedComponentId || props.sharedComponentId || block?.role === PRIMARY_NAV_ROLE || props.role === PRIMARY_NAV_ROLE);
  const pageRegistryCount = (Array.isArray(project?.pages) ? project.pages : []).filter(pageIsVisibleInNavigation).length;
  const pageCoverageScore = Math.min(links.length, pageRegistryCount || links.length) * 10;
  const globalScore = entry?.global ? 1000 : 0;
  return globalScore
    + pageCoverageScore
    + (sticky ? 80 : 0)
    + (hasLogo ? 40 : 0)
    + (shared ? 30 : 0)
    - Number(entry?.pageIndex || 0);
}

function selectCanonicalNavigation(project = {}) {
  if (isPrimaryNavigationBlock(project?.globalNavBlock)) {
    return project.globalNavBlock;
  }
  const candidates = [
    ...navigationCandidates(project),
  ];
  if (!candidates.length) return null;
  return candidates
    .map((entry) => ({ ...entry, score: scoreNavigationCandidate(entry, project) }))
    .sort((a, b) => b.score - a.score || a.pageIndex - b.pageIndex || a.blockIndex - b.blockIndex)[0]?.block || null;
}

function stripPrimaryNavigationBlocks(pageBlocks = {}) {
  if (!pageBlocks || typeof pageBlocks !== "object") return pageBlocks;
  return Object.fromEntries(
    Object.entries(pageBlocks).map(([pageName, blocks]) => [
      pageName,
      Array.isArray(blocks) ? blocks.filter((block) => !isPrimaryNavigationBlock(block)) : blocks,
    ])
  );
}

export function normalizeSharedPrimaryNavigation(project = {}) {
  if (!project || typeof project !== "object") return project;
  const existingRevision = String(project?.globalNavBlock?.props?.globalHeaderRevision || project?.globalNavBlock?.globalHeaderRevision || "").trim();
  const canonicalSource = selectCanonicalNavigation(project);
  const canonical = normalizeCanonicalNavigationBlock(canonicalSource, project, { revision: existingRevision || undefined }) || null;

  const pageBlocks = stripPrimaryNavigationBlocks(project.pageBlocks || {});
  const chaiData = project.chaiData && typeof project.chaiData === "object"
    ? Object.fromEntries(
        Object.entries(project.chaiData).map(([pageName, pageData]) => [
          pageName,
          pageData && typeof pageData === "object" && Array.isArray(pageData.blocks)
            ? { ...pageData, blocks: pageData.blocks.filter((block) => !isPrimaryNavigationBlock(block)) }
            : pageData,
        ])
      )
    : project.chaiData;

  return {
    ...project,
    pages: Array.isArray(project.pages)
      ? project.pages.map((page) => ({ ...page, useGlobalHeader: page?.useGlobalHeader !== false, headerOverrideBlockId: page?.headerOverrideBlockId || "" }))
      : project.pages,
    pageBlocks,
    chaiData,
    ...(canonical ? { globalNavBlock: canonical } : {}),
    globalHeader: canonical ? {
      id: canonical.id,
      enabled: true,
      logoUrl: canonical.props?.logo || canonical.props?.logoUrl || "",
      logoWidth: canonical.props?.logoWidth,
      siteName: canonical.props?.brand || canonical.props?.siteName || project?.name || "",
      menuItems: canonical.props?.links || [],
      sticky: canonical.props?.stickyMode !== "normal",
      supportButton: {
        enabled: canonical.props?.showCta !== false,
        label: canonical.props?.ctaText || "",
        href: canonical.props?.ctaLink || "",
      },
      styles: canonical.props || {},
      responsive: canonical.props?.responsive || {},
      revision: canonical.props?.globalHeaderRevision || "",
      updatedAt: canonical.props?.globalHeaderRevision || "",
    } : project.globalHeader || null,
  };
}
