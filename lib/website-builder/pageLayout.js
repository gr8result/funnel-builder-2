export const PAGE_WIDTH_CONTAINED = "contained";
export const PAGE_WIDTH_FULL = "full";
export const PAGE_WIDTH_MODES = new Set([PAGE_WIDTH_CONTAINED, PAGE_WIDTH_FULL]);

export function normalizePageWidthMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  return PAGE_WIDTH_MODES.has(mode) ? mode : PAGE_WIDTH_CONTAINED;
}

function hasOwn(value, key) {
  return !!(value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, key));
}

function readPageWidthMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  return PAGE_WIDTH_MODES.has(mode) ? mode : "";
}

function readSiteWidthMode(project = {}) {
  return readPageWidthMode(project?.globalPageWidthMode)
    || readPageWidthMode(project?.pageWidthMode)
    || readPageWidthMode(project?.siteSettings?.globalPageWidthMode)
    || readPageWidthMode(project?.siteSettings?.pageWidthMode)
    || readPageWidthMode(project?.globalSettings?.pageWidthMode)
    || "";
}

export function hasExplicitPageWidthOverride(page = {}) {
  if (!page || typeof page !== "object") return false;
  if (page.pageWidthModeOverride === true || page.overrideGlobalPageWidthMode === true || page.useGlobalPageWidthMode === false) return true;
  return hasOwn(page, "layoutWidthMode") || hasOwn(page, "containerMode");
}

export function isFullWidthPage(value) {
  return normalizePageWidthMode(value) === PAGE_WIDTH_FULL;
}

export function normalizePageLayoutFields(page = {}) {
  const explicitMode = readPageWidthMode(page?.pageWidthMode || page?.layoutWidthMode || page?.containerMode);
  return explicitMode && hasExplicitPageWidthOverride(page)
    ? { pageWidthMode: explicitMode, pageWidthModeOverride: true }
    : {};
}

export function withPageLayoutDefaults(page = {}) {
  return {
    ...(page && typeof page === "object" ? page : {}),
    ...normalizePageLayoutFields(page),
  };
}

export function resolvePageWidthMode(project = {}, pageNameOrSlug = "") {
  const requested = String(pageNameOrSlug || "").trim().toLowerCase();
  const pages = Array.isArray(project?.pages) ? project.pages : [];
  const page = pages.find((entry) => {
    const keys = [entry?.name, entry?.slug, entry?.title, entry?.id]
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean);
    return requested ? keys.includes(requested) : false;
  }) || pages[0] || {};
  const siteMode = readSiteWidthMode(project);
  if (hasExplicitPageWidthOverride(page)) {
    return normalizePageWidthMode(page?.pageWidthMode || page?.layoutWidthMode || page?.containerMode || siteMode);
  }
  return normalizePageWidthMode(siteMode || page?.pageWidthMode);
}
