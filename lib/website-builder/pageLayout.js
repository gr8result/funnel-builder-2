export const PAGE_WIDTH_CONTAINED = "contained";
export const PAGE_WIDTH_FULL = "full";
export const PAGE_WIDTH_MODES = new Set([PAGE_WIDTH_CONTAINED, PAGE_WIDTH_FULL]);

function hasOwnValue(source, key) {
  if (!source || typeof source !== "object") return false;
  if (!Object.prototype.hasOwnProperty.call(source, key)) return false;
  const value = source[key];
  return value !== undefined && value !== null && String(value).trim() !== "";
}

export function normalizePageWidthMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  return PAGE_WIDTH_MODES.has(mode) ? mode : PAGE_WIDTH_CONTAINED;
}

export function isFullWidthPage(value) {
  return normalizePageWidthMode(value) === PAGE_WIDTH_FULL;
}

export function normalizePageLayoutFields(page = {}) {
  return {
    pageWidthMode: normalizePageWidthMode(page?.pageWidthMode || page?.layoutWidthMode || page?.containerMode),
  };
}

export function resolveGlobalPageWidthMode(project = {}) {
  return normalizePageWidthMode(
    project?.pageWidthMode
    || project?.globalPageWidthMode
    || project?.sitePageWidthMode
    || project?.layoutWidthMode
    || project?.pageLayout?.pageWidthMode
    || project?.settings?.pageWidthMode
    || project?.globalSettings?.pageWidthMode
  );
}

export function hasGlobalPageWidthMode(project = {}) {
  return hasOwnValue(project, "pageWidthMode")
    || hasOwnValue(project, "globalPageWidthMode")
    || hasOwnValue(project, "sitePageWidthMode")
    || hasOwnValue(project, "layoutWidthMode")
    || hasOwnValue(project?.pageLayout, "pageWidthMode")
    || hasOwnValue(project?.settings, "pageWidthMode")
    || hasOwnValue(project?.globalSettings, "pageWidthMode");
}

export function hasPageWidthOverride(page = {}) {
  return page?.pageWidthOverride === true
    || page?.layoutOverride === true;
}

export function withPageLayoutDefaults(page = {}) {
  return {
    ...(page && typeof page === "object" ? page : {}),
    ...normalizePageLayoutFields(page),
  };
}

export function resolvePageWidthMode(project = {}, pageNameOrSlug = "") {
  const hasGlobalMode = hasGlobalPageWidthMode(project);
  const globalMode = resolveGlobalPageWidthMode(project);
  const requested = String(pageNameOrSlug || "").trim().toLowerCase();
  const pages = Array.isArray(project?.pages) ? project.pages : [];
  const page = pages.find((entry) => {
    const keys = [entry?.name, entry?.slug, entry?.title, entry?.id]
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean);
    return requested ? keys.includes(requested) : false;
  }) || pages[0] || {};
  if (!hasGlobalMode || hasPageWidthOverride(page)) return normalizePageWidthMode(page?.pageWidthMode || page?.layoutWidthMode || page?.containerMode);
  return globalMode;
}

export function normalizePageLayoutProject(project = {}) {
  if (!project || typeof project !== "object") return project;
  const sourcePages = Array.isArray(project.pages) ? project.pages : [];
  const hasGlobalMode = hasGlobalPageWidthMode(project);
  const pageWidthMode = hasGlobalMode
    ? resolveGlobalPageWidthMode(project)
    : normalizePageWidthMode(sourcePages[0]?.pageWidthMode || sourcePages[0]?.layoutWidthMode || sourcePages[0]?.containerMode);
  const pages = (Array.isArray(project.pages) ? project.pages : []).map((page) => ({
    ...(page && typeof page === "object" ? page : {}),
    pageWidthMode: hasPageWidthOverride(page) ? normalizePageWidthMode(page?.pageWidthMode || page?.layoutWidthMode || page?.containerMode) : pageWidthMode,
  }));

  return {
    ...project,
    pageWidthMode,
    globalPageWidthMode: pageWidthMode,
    pages,
  };
}
