export const PAGE_WIDTH_CONTAINED = "contained";
export const PAGE_WIDTH_FULL = "full";
export const PAGE_WIDTH_MODES = new Set([PAGE_WIDTH_CONTAINED, PAGE_WIDTH_FULL]);

function hasOwnValue(source, key) {
  if (!source || typeof source !== "object") return false;
  if (!Object.prototype.hasOwnProperty.call(source, key)) return false;
  const value = source[key];
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function hasOwn(value, key) {
  return !!(value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, key));
}

function readPageWidthMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  return PAGE_WIDTH_MODES.has(mode) ? mode : "";
}

export function normalizePageWidthMode(value) {
  const mode = readPageWidthMode(value);
  return mode || PAGE_WIDTH_CONTAINED;
}

function readSiteWidthMode(project = {}) {
  return readPageWidthMode(project?.globalPageWidthMode)
    || readPageWidthMode(project?.pageWidthMode)
    || readPageWidthMode(project?.sitePageWidthMode)
    || readPageWidthMode(project?.layoutWidthMode)
    || readPageWidthMode(project?.pageLayout?.pageWidthMode)
    || readPageWidthMode(project?.siteSettings?.globalPageWidthMode)
    || readPageWidthMode(project?.siteSettings?.pageWidthMode)
    || readPageWidthMode(project?.settings?.pageWidthMode)
    || readPageWidthMode(project?.globalSettings?.pageWidthMode)
    || "";
}

export function hasExplicitPageWidthOverride(page = {}) {
  if (!page || typeof page !== "object") return false;
  if (
    page.pageWidthModeOverride === true
    || page.overrideGlobalPageWidthMode === true
    || page.useGlobalPageWidthMode === false
    || page.pageWidthOverride === true
    || page.layoutOverride === true
  ) {
    return true;
  }
  return hasOwn(page, "layoutWidthMode") || hasOwn(page, "containerMode");
}

export function isFullWidthPage(value) {
  return normalizePageWidthMode(value) === PAGE_WIDTH_FULL;
}

export function normalizePageLayoutFields(page = {}) {
  const explicitMode = readPageWidthMode(
    page?.pageWidthMode || page?.layoutWidthMode || page?.containerMode
  );

  return explicitMode && hasExplicitPageWidthOverride(page)
    ? {
        pageWidthMode: explicitMode,
        pageWidthModeOverride: true,
        pageWidthOverride: true,
      }
    : {};
}

export function resolveGlobalPageWidthMode(project = {}) {
  return normalizePageWidthMode(readSiteWidthMode(project));
}

export function hasGlobalPageWidthMode(project = {}) {
  return hasOwnValue(project, "pageWidthMode")
    || hasOwnValue(project, "globalPageWidthMode")
    || hasOwnValue(project, "sitePageWidthMode")
    || hasOwnValue(project, "layoutWidthMode")
    || hasOwnValue(project?.pageLayout, "pageWidthMode")
    || hasOwnValue(project?.siteSettings, "globalPageWidthMode")
    || hasOwnValue(project?.siteSettings, "pageWidthMode")
    || hasOwnValue(project?.settings, "pageWidthMode")
    || hasOwnValue(project?.globalSettings, "pageWidthMode");
}

export function hasPageWidthOverride(page = {}) {
  return hasExplicitPageWidthOverride(page);
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
    return normalizePageWidthMode(
      page?.pageWidthMode
      || page?.layoutWidthMode
      || page?.containerMode
      || siteMode
    );
  }

  return normalizePageWidthMode(siteMode || page?.pageWidthMode);
}

export function normalizePageLayoutProject(project = {}) {
  if (!project || typeof project !== "object") return project;

  const sourcePages = Array.isArray(project.pages) ? project.pages : [];
  const siteMode = readSiteWidthMode(project);

  const pageWidthMode = normalizePageWidthMode(
    siteMode
    || sourcePages[0]?.pageWidthMode
    || sourcePages[0]?.layoutWidthMode
    || sourcePages[0]?.containerMode
  );

  const pages = sourcePages.map((page) => {
    const {
      pageWidthMode: _pageWidthMode,
      layoutWidthMode: _layoutWidthMode,
      containerMode: _containerMode,
      ...rest
    } = page && typeof page === "object" ? page : {};

    if (!hasExplicitPageWidthOverride(page)) {
      return rest;
    }

    return {
      ...rest,
      pageWidthOverride: true,
      pageWidthModeOverride: true,
      pageWidthMode: normalizePageWidthMode(
        page?.pageWidthMode
        || page?.layoutWidthMode
        || page?.containerMode
        || pageWidthMode
      ),
    };
  });

  return {
    ...project,
    pageWidthMode,
    globalPageWidthMode: pageWidthMode,
    pages,
  };
}
