function slugifyPreviewValue(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function canonicalPreviewPageSlug(value) {
  return slugifyPreviewValue(value);
}

export function resolveCanonicalPreviewPageSlug(page = {}, options = {}) {
  const slugMap = options?.project?.pageSlugs && typeof options.project.pageSlugs === "object"
    ? options.project.pageSlugs
    : {};

  return canonicalPreviewPageSlug(
    page?.slug
    || slugMap[page?.id]
    || slugMap[page?.pageId]
    || slugMap[page?.name]
    || page?.pageSlug
    || page?.routeSlug
    || page?.name
    || ""
  );
}

export function buildWebsitePreviewUrl({
  projectId,
  pageSlug = "",
  pageName = "",
  viewport = "desktop",
  previewToken = "",
  emergencyDraft = false,
} = {}) {
  const id = String(projectId || "").trim();
  if (!id) return "";

  const params = new URLSearchParams();
  params.set("projectId", id);

  const resolvedViewport = ["mobile", "tablet", "desktop"].includes(String(viewport || "").toLowerCase())
    ? String(viewport).toLowerCase()
    : "desktop";
  params.set("viewport", resolvedViewport);

  const slug = canonicalPreviewPageSlug(pageSlug || pageName);
  if (slug && slug !== "home" && slug !== "index") {
    params.set("page", slug);
  }

  if (previewToken) {
    params.set("previewToken", String(previewToken));
  }

  if (String(emergencyDraft || "") === "1" || emergencyDraft === true) {
    params.set("emergencyDraft", "1");
  }

  return `/modules/website-builder/preview?${params.toString()}`;
}
