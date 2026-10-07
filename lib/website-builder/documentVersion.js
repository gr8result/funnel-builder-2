import crypto from "crypto";

export function stableWebsiteJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableWebsiteJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableWebsiteJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function websiteContentHash(value) {
  return crypto.createHash("sha256").update(stableWebsiteJson(value ?? null)).digest("hex");
}

export function canonicalWebsitePersistencePayload(project = {}) {
  return {
    pages: project?.pages || [],
    pageBlocks: project?.pageBlocks || {},
    pagesContent: project?.pagesContent || {},
    chaiData: project?.chaiData || {},
    globalNavBlock: project?.globalNavBlock || null,
    globalFooterBlock: project?.globalFooterBlock || null,
    globalFooter: project?.globalFooter || null,
    brandAssets: project?.brandAssets || null,
    customDomain: project?.customDomain || project?.custom_domain || "",
    primaryDomain: project?.primaryDomain || project?.primary_domain || "",
    slug: project?.slug || "",
  };
}

export function websitePersistenceHash(project = {}) {
  return websiteContentHash(canonicalWebsitePersistencePayload(project));
}

function slugifyPersistencePage(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function resolvePersistencePageName(project = {}, pageName = "") {
  const requested = String(pageName || "").trim();
  if (!requested) return "";
  const pages = Array.isArray(project?.pages) ? project.pages : [];
  const requestedSlug = slugifyPersistencePage(requested);
  const page = pages.find((entry) => String(entry?.name || "") === requested)
    || pages.find((entry) => String(entry?.slug || "") === requested)
    || pages.find((entry) => String(entry?.slug || "") === requestedSlug);
  return page?.name || requested;
}

function hasPagePersistenceEntry(mapValue, pageName) {
  return !!mapValue && typeof mapValue === "object" && !!pageName && Object.prototype.hasOwnProperty.call(mapValue, pageName);
}

function pickPagePersistenceEntry(mapValue, pageName) {
  if (!mapValue || typeof mapValue !== "object" || !pageName) return {};
  return Object.prototype.hasOwnProperty.call(mapValue, pageName)
    ? { [pageName]: mapValue[pageName] }
    : {};
}

export function scopeWebsitePersistenceProject(project = {}, pageName = "") {
  const resolvedPageName = resolvePersistencePageName(project, pageName);
  if (!resolvedPageName) return project;
  return {
    ...project,
    pageBlocks: pickPagePersistenceEntry(project?.pageBlocks, resolvedPageName),
    pagesContent: pickPagePersistenceEntry(project?.pagesContent, resolvedPageName),
    chaiData: pickPagePersistenceEntry(project?.chaiData, resolvedPageName),
  };
}

export function buildExpectedWebsitePersistenceProject(baseProject = null, submittedProject = {}, pageName = "") {
  const resolvedPageName = resolvePersistencePageName(submittedProject, pageName)
    || resolvePersistencePageName(baseProject, pageName);
  if (!resolvedPageName || !baseProject || typeof baseProject !== "object") return submittedProject || {};

  const expected = {
    ...(baseProject || {}),
    ...(submittedProject || {}),
    pageBlocks: { ...(baseProject?.pageBlocks || {}) },
    pagesContent: { ...(baseProject?.pagesContent || {}) },
    chaiData: { ...(baseProject?.chaiData || {}) },
  };

  if (hasPagePersistenceEntry(submittedProject?.pageBlocks, resolvedPageName)) {
    expected.pageBlocks[resolvedPageName] = submittedProject.pageBlocks[resolvedPageName];
  }
  if (hasPagePersistenceEntry(submittedProject?.pagesContent, resolvedPageName)) {
    expected.pagesContent[resolvedPageName] = submittedProject.pagesContent[resolvedPageName];
  }
  if (hasPagePersistenceEntry(submittedProject?.chaiData, resolvedPageName)) {
    expected.chaiData[resolvedPageName] = submittedProject.chaiData[resolvedPageName];
  }

  return expected;
}

export function buildExpectedSiteOnlyWebsitePersistenceProject(baseProject = null, submittedProject = {}) {
  if (!baseProject || typeof baseProject !== "object") return submittedProject || {};
  const expected = {
    ...(baseProject || {}),
    ...(submittedProject || {}),
    pageBlocks: baseProject?.pageBlocks || {},
    pagesContent: baseProject?.pagesContent || {},
    chaiData: baseProject?.chaiData || {},
  };

  if (!Object.prototype.hasOwnProperty.call(submittedProject || {}, "brandAssets")) {
    expected.brandAssets = baseProject?.brandAssets;
  }

  return expected;
}

export function buildWebsiteProjectVersion(project, savedAt = new Date().toISOString()) {
  const hash = websitePersistenceHash(project);
  return {
    savedAt,
    projectVersion: `pv_${savedAt.replace(/[^0-9]/g, "").slice(0, 17)}_${hash.slice(0, 12)}`,
    contentHash: hash,
  };
}

function collectBlockIds(blocks = []) {
  const ids = [];
  const visit = (block) => {
    if (!block || typeof block !== "object") return;
    if (block.id) ids.push(String(block.id));
    const children = [
      block.children,
      block.blocks,
      block.props?.children,
      block.props?.blocks,
      block.props?.items,
      block.props?.columns,
      block.props?.linkGroups,
    ];
    children.forEach((entry) => {
      if (Array.isArray(entry)) entry.forEach(visit);
    });
  };
  (Array.isArray(blocks) ? blocks : []).forEach(visit);
  return ids;
}

function footerColumnCount(block = null) {
  if (!block || block.type !== "footer") return 0;
  const props = block.props || {};
  const explicitGroups = Array.isArray(props.linkGroups)
    ? props.linkGroups.filter((group) => Array.isArray(group?.links) && group.links.length)
    : [];
  if (explicitGroups.length) {
    return 1 + explicitGroups.length + (props.showNewsletter === false ? 0 : 1);
  }
  const navLinks = Array.isArray(props.navigationLinks) ? props.navigationLinks : [];
  const extraLinks = Array.isArray(props.extraLinks || props.companyLinks) ? (props.extraLinks || props.companyLinks) : [];
  return 1 + (navLinks.length ? 1 : 0) + (extraLinks.length ? 1 : 0) + (props.showNewsletter === false ? 0 : 1);
}

export function summarizeWebsitePersistence(project = {}, pageName = "") {
  const pages = Array.isArray(project?.pages) ? project.pages : [];
  const page = pages.find((entry) => String(entry?.name || "") === String(pageName || ""))
    || pages.find((entry) => String(entry?.slug || "") === String(pageName || ""))
    || pages[0]
    || null;
  const resolvedPageName = pageName || page?.name || "";
  const pageBlocks = resolvedPageName && Array.isArray(project?.pageBlocks?.[resolvedPageName])
    ? project.pageBlocks[resolvedPageName]
    : [];
  const footerBlock = project?.globalFooterBlock?.type === "footer"
    ? project.globalFooterBlock
    : pageBlocks.find((block) => block?.type === "footer") || null;
  const navBlock = project?.globalNavBlock?.type === "nav-bar"
    ? project.globalNavBlock
    : pageBlocks.find((block) => block?.type === "nav-bar") || null;

  return {
    websiteId: project?.id || project?.websiteId || "",
    projectId: project?.id || project?.projectId || "",
    pageId: page?.id || page?.slug || resolvedPageName || "",
    pageSlug: page?.slug || "",
    draftRevision: project?.projectVersion || "",
    publishedRevision: project?.publishedVersion || project?.publication?.publishedVersion || "",
    blockCount: pageBlocks.length,
    blockIds: pageBlocks.map((block) => String(block?.id || "")).filter(Boolean),
    blockTypes: pageBlocks.map((block) => String(block?.type || "")).filter(Boolean),
    nestedChildCount: collectBlockIds(pageBlocks).length - pageBlocks.length,
    topNavigationSettings: navBlock?.props || {},
    footerSettings: footerBlock?.props || {},
    footerColumnCount: footerColumnCount(footerBlock),
    footerChildBlockIds: collectBlockIds([footerBlock]).filter((id) => id !== String(footerBlock?.id || "")),
    contentHash: websitePersistenceHash(project),
    structuralHash: websiteContentHash({
      page: page || null,
      pageBlocks,
      globalNavBlock: project?.globalNavBlock || null,
      globalFooterBlock: project?.globalFooterBlock || null,
    }),
  };
}

export function diffWebsitePersistence(left, right, basePath = "") {
  const diffs = [];
  const visit = (a, b, path) => {
    if (Object.is(a, b)) return;
    if (Array.isArray(a) || Array.isArray(b)) {
      if (!Array.isArray(a) || !Array.isArray(b)) {
        diffs.push({ path, expected: a, actual: b });
        return;
      }
      const max = Math.max(a.length, b.length);
      for (let index = 0; index < max; index += 1) {
        visit(a[index], b[index], `${path}[${index}]`);
        if (diffs.length >= 50) return;
      }
      return;
    }
    if ((a && typeof a === "object") || (b && typeof b === "object")) {
      if (!a || !b || typeof a !== "object" || typeof b !== "object") {
        diffs.push({ path, expected: a, actual: b });
        return;
      }
      const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
      for (const key of keys) {
        visit(a[key], b[key], path ? `${path}.${key}` : key);
        if (diffs.length >= 50) return;
      }
      return;
    }
    diffs.push({ path, expected: a, actual: b });
  };
  visit(canonicalWebsitePersistencePayload(left), canonicalWebsitePersistencePayload(right), basePath);
  return diffs;
}

export function summarizeWebsitePage(project, pageName = "") {
  const pages = Array.isArray(project?.pages) ? project.pages : [];
  const page = pages.find((entry) => String(entry?.name || "") === String(pageName || ""))
    || pages.find((entry) => String(entry?.slug || "") === String(pageName || ""))
    || pages[0]
    || null;
  const resolvedName = pageName || page?.name || "";
  const blocks = Array.isArray(project?.pageBlocks?.[resolvedName])
    ? project.pageBlocks[resolvedName]
    : Array.isArray(project?.chaiData?.[resolvedName]?.blocks)
      ? project.chaiData[resolvedName].blocks
      : [];
  return {
    pageId: page?.id || page?.slug || resolvedName || "",
    pageName: page?.name || resolvedName || "",
    blockCount: blocks.length,
    pageHash: websiteContentHash(blocks),
  };
}
