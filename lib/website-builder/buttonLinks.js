export const CTA_LINK_TYPES = Object.freeze(["page", "external", "anchor", "email", "tel", "none"]);

function isValidCtaType(value = "") {
  return CTA_LINK_TYPES.includes(String(value || "").trim().toLowerCase());
}

function isTypeCompatibleWithHref(type = "none", href = "") {
  const inferred = inferCtaLinkType(href, "");
  return inferred === String(type || "").trim().toLowerCase();
}

export function slugifyCtaValue(value = "") {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function buildCtaPageRefs(pages = []) {
  return (Array.isArray(pages) ? pages : [])
    .map((page, index) => {
      const label = String(page?.name || page?.title || page?.pageName || "").trim();
      const slug = slugifyCtaValue(page?.slug || page?.path || label);
      if (!label || !slug) return null;
      return {
        id: String(page?.id || page?.pageId || slug),
        label,
        slug,
        href: slug === "home" ? "/" : `/${slug}`,
        order: Number.isFinite(Number(page?.order)) ? Number(page.order) : index,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);
}

export function inferCtaLinkType(href = "", explicitType = "") {
  const rawType = String(explicitType || "").trim().toLowerCase();
  const rawHref = String(href || "").trim();
  if (isValidCtaType(rawType)) {
    if (!rawHref) return rawType;
    // If stored linkType conflicts with the entered href (legacy stale state),
    // trust the href so "/contact" cannot be coerced into "#contact".
    if (isTypeCompatibleWithHref(rawType, rawHref)) return rawType;
  }
  if (!rawHref) return "none";
  if (rawHref.startsWith("#")) return "anchor";
  if (/^mailto:/i.test(rawHref)) return "email";
  if (/^tel:/i.test(rawHref)) return "tel";
  if (/^https?:\/\//i.test(rawHref)) return "external";
  return "page";
}

export function resolvePreferredCtaHref(canonicalHref = "", legacyHref = "", explicitType = "") {
  const canonical = String(canonicalHref || "").trim();
  const legacy = String(legacyHref || "").trim();
  if (!canonical) return legacy;
  if (!legacy) return canonical;
  if (canonical === legacy) return canonical;

  const explicit = String(explicitType || "").trim().toLowerCase();
  if (isValidCtaType(explicit)) {
    const canonicalMatches = isTypeCompatibleWithHref(explicit, canonical);
    const legacyMatches = isTypeCompatibleWithHref(explicit, legacy);
    if (canonicalMatches && !legacyMatches) return canonical;
    if (legacyMatches && !canonicalMatches) return legacy;
  }

  // Legacy href fields are still written by multiple editor paths.
  // Prefer legacy when values disagree so user edits are preserved.
  return legacy;
}

export function normalizePageHref(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^(https?:|mailto:|tel:|#)/i.test(raw)) return raw;
  if (raw === "/") return "/";
  if (raw.startsWith("/")) return raw;
  return `/${raw.replace(/^\.\/+/, "")}`;
}

export function normalizeAnchorHref(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("#")) return raw;
  const slug = slugifyCtaValue(raw.replace(/^\/+/, ""));
  return slug ? `#${slug}` : "";
}

export function normalizeEmailHref(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const clean = raw.replace(/^mailto:/i, "").trim();
  return clean ? `mailto:${clean}` : "";
}

export function normalizeTelHref(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const clean = raw.replace(/^tel:/i, "").trim();
  return clean ? `tel:${clean}` : "";
}

export function normalizeHrefByType(linkType = "none", href = "") {
  const type = inferCtaLinkType(href, linkType);
  if (type === "none") return "";
  if (type === "page") return normalizePageHref(href);
  if (type === "anchor") return normalizeAnchorHref(href);
  if (type === "email") return normalizeEmailHref(href);
  if (type === "tel") return normalizeTelHref(href);
  return String(href || "").trim();
}

export function resolveCtaPageRef(cta = {}, pages = []) {
  const pageRefs = buildCtaPageRefs(pages);
  const keys = [cta?.pageId, cta?.slug, cta?.pageSlug, cta?.href]
    .map((value) => slugifyCtaValue(String(value || "").replace(/^\/+/, "").split(/[?#]/)[0]))
    .filter(Boolean);
  return pageRefs.find((page) => keys.includes(page.id) || keys.includes(page.slug)) || null;
}

export function resolveRenderedCtaHref(cta = {}, navigationContext = null) {
  const linkType = inferCtaLinkType(cta?.href || "", cta?.linkType || "");
  const rawHref = normalizeHrefByType(linkType, cta?.href || "");
  if (linkType === "none") return "";
  if (linkType === "page") {
    if (rawHref && rawHref !== "#") return rawHref;
    const pageMap = navigationContext?.pageMap;
    const key = String(cta?.pageId || "").trim();
    const match = pageMap instanceof Map ? pageMap.get(key) : pageMap?.[key];
    const mapHref = match && typeof match === "object" ? match.href : match;
    return String(mapHref || "").trim();
  }
  return rawHref;
}