export const PAGE_WIDTH_CONTAINED = "contained";
export const PAGE_WIDTH_FULL = "full";
export const PAGE_WIDTH_MODES = new Set([PAGE_WIDTH_CONTAINED, PAGE_WIDTH_FULL]);

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
  return normalizePageWidthMode(page?.pageWidthMode);
}
