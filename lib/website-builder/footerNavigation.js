const FAKE_LABEL_PATTERN = /^page\s+\d+$/i;
const OBJECT_LABEL_PATTERN = /^\[object\s+object\]$/i;
const UTILITY_SLUGS = new Set([
  "blog",
  "privacy",
  "privacy-policy",
  "terms",
  "terms-of-use",
  "terms-and-conditions",
]);

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function slugifyFooterNavValue(value = "") {
  return safeString(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function isArchivedOrDeleted(item) {
  const status = safeString(item?.status || item?.state).toLowerCase();
  return item?.deleted === true
    || item?.isDeleted === true
    || item?.archived === true
    || status === "deleted"
    || status === "archived";
}

function isVisiblePage(page) {
  if (!page || typeof page !== "object") return false;
  if (isArchivedOrDeleted(page)) return false;
  if (page.hidden === true || page.navHidden === true || page.showInNavigation === false) return false;
  const pageId = safeString(page.id || page.pageId || page.page_id);
  const name = safeString(page.name || page.title || page.pageName);
  const slug = slugifyFooterNavValue(page.slug || page.path || name);
  return !!pageId && !!name && !!slug && !OBJECT_LABEL_PATTERN.test(name);
}

export function buildFooterNavigationContext({ pages = [], logInvalid = false } = {}) {
  const pageRefs = [];
  const pageMap = new Map();

  (Array.isArray(pages) ? pages : []).forEach((page, index) => {
    if (!isVisiblePage(page)) {
      if (logInvalid && page) logInvalidFooterNavItem(page, { source: "pages", index, reason: "invalid-page-record" });
      return;
    }
    const label = safeString(page.name || page.title || page.pageName);
    const slug = slugifyFooterNavValue(page.slug || page.path || label);
    const ref = {
      id: safeString(page.id || page.pageId || page.page_id),
      label,
      slug,
      href: slug === "home" ? "/" : `/${slug}`,
      order: Number.isFinite(Number(page.order)) ? Number(page.order) : index,
    };
    pageRefs.push(ref);
    [ref.id, ref.slug, slugifyFooterNavValue(ref.label), ref.href.replace(/^\/+/, "")].forEach((key) => {
      if (key) pageMap.set(key, ref);
    });
  });

  return {
    pageRefs: pageRefs.sort((a, b) => a.order - b.order),
    pageMap,
    logInvalid,
  };
}

function logInvalidFooterNavItem(rawValue, details = {}) {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") return;
  const raw = rawValue && typeof rawValue === "object" ? rawValue : {};
  console.warn("[website-builder footer nav] skipped invalid item", {
    rawValue,
    type: rawValue === null ? "null" : typeof rawValue,
    pageId: safeString(raw.pageId || raw.page_id || raw.id),
    pageName: safeString(raw.pageName || raw.name || raw.title),
    slug: safeString(raw.slug || raw.pageSlug || raw.path),
    label: typeof raw.label === "string" ? raw.label : raw.label,
    href: typeof raw.href === "string" ? raw.href : raw.href,
    sourceCollection: details.source || "",
    reason: details.reason || "",
    index: details.index,
  });
}

function extractLabel(item) {
  if (typeof item === "string") return item.trim();
  if (!item || typeof item !== "object") return "";
  return safeString(item.label)
    || safeString(item.title)
    || safeString(item.name)
    || safeString(item.pageName)
    || safeString(item.text);
}

function extractHref(item) {
  if (!item || typeof item !== "object") return "";
  return safeString(item.href)
    || safeString(item.url)
    || safeString(item.path)
    || safeString(item.slug)
    || safeString(item.pageSlug);
}

function normalizeHref(rawHref, label, matchedPage) {
  if (matchedPage?.href) return matchedPage.href;
  const href = safeString(rawHref);
  if (!href) return "";
  if (/^(https?:|mailto:|tel:|#)/i.test(href)) return href;
  if (href.startsWith("/")) return href;
  const slug = slugifyFooterNavValue(href || label);
  return slug ? `/${slug}` : "";
}

function findMatchingPage(item, label, href, context) {
  const pageMap = context?.pageMap;
  if (!pageMap || !pageMap.size) return null;
  const keys = [];
  if (item && typeof item === "object") {
    keys.push(item.pageId, item.page_id, item.id, item.slug, item.pageSlug, item.path);
  }
  keys.push(label, href, safeString(href).replace(/^\/+/, "").split(/[?#]/)[0]);
  for (const value of keys) {
    const key = slugifyFooterNavValue(value) || safeString(value);
    if (key && pageMap.has(key)) return pageMap.get(key);
  }
  return null;
}

function isAllowedInternalHref(href, matchedPage, context) {
  if (!href || matchedPage) return !!matchedPage;
  if (/^(https?:|mailto:|tel:|#)/i.test(href)) return true;
  if (!href.startsWith("/")) return false;
  const slug = slugifyFooterNavValue(href.replace(/^\/+/, "").split(/[?#]/)[0]);
  if (!slug || slug === "home") return true;
  if (UTILITY_SLUGS.has(slug)) return true;
  return !!context?.pageMap?.has(slug);
}

export function normalizeFooterNavItem(item, context = {}, meta = {}) {
  if (!item) return null;
  if (typeof item !== "string" && typeof item !== "object") {
    if (context.logInvalid) logInvalidFooterNavItem(item, { ...meta, reason: "unsupported-type" });
    return null;
  }
  if (typeof item === "object" && isArchivedOrDeleted(item)) {
    if (context.logInvalid) logInvalidFooterNavItem(item, { ...meta, reason: "deleted-or-archived" });
    return null;
  }

  const label = extractLabel(item);
  const rawHref = extractHref(item);
  const matchedPage = findMatchingPage(item, label, rawHref, context);
  const href = normalizeHref(rawHref, label, matchedPage);
  const isFakeFallback = FAKE_LABEL_PATTERN.test(label) && !matchedPage;

  if (!label || OBJECT_LABEL_PATTERN.test(label) || isFakeFallback || !href || !isAllowedInternalHref(href, matchedPage, context)) {
    if (context.logInvalid) {
      logInvalidFooterNavItem(item, {
        ...meta,
        reason: !label ? "empty-label" : OBJECT_LABEL_PATTERN.test(label) ? "object-label" : isFakeFallback ? "fake-page-label" : !href ? "empty-href" : "missing-target-page",
      });
    }
    return null;
  }

  return {
    ...(typeof item === "object" ? item : {}),
    id: safeString(item?.id) || safeString(item?.pageId || item?.page_id) || `footer-link-${slugifyFooterNavValue(label || href)}`,
    label,
    href,
    ...(matchedPage?.id ? { pageId: matchedPage.id } : {}),
    ...(matchedPage?.slug ? { slug: matchedPage.slug } : {}),
  };
}

export function normalizeFooterNavItems(items, context = {}, meta = {}) {
  const seen = new Set();
  return (Array.isArray(items) ? items : [])
    .map((item, index) => normalizeFooterNavItem(item, context, { ...meta, index }))
    .filter((item) => {
      if (!item) return false;
      const key = `${item.pageId || ""}|${slugifyFooterNavValue(item.slug || item.href)}|${slugifyFooterNavValue(item.label)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function normalizeFooterNavigationProps(props = {}, context = {}) {
  const nextProps = { ...(props && typeof props === "object" ? props : {}) };
  nextProps.navLinks = normalizeFooterNavItems(nextProps.navLinks, context, { source: "footer.props.navLinks" });
  nextProps.extraLinks = normalizeFooterNavItems(nextProps.extraLinks, context, { source: "footer.props.extraLinks" });
  if (Array.isArray(nextProps.linkGroups)) {
    nextProps.linkGroups = nextProps.linkGroups
      .map((group, groupIndex) => ({
        ...(group && typeof group === "object" ? group : {}),
        heading: safeString(group?.heading) || "Links",
        links: normalizeFooterNavItems(group?.links, context, { source: `footer.props.linkGroups[${groupIndex}].links` }),
      }))
      .filter((group) => group.links.length);
  }
  return nextProps;
}

export function normalizeFooterNavigationBlock(block, context = {}) {
  if (!block || typeof block !== "object" || block.type !== "footer") return block;
  return {
    ...block,
    props: normalizeFooterNavigationProps(block.props || {}, context),
  };
}

export function normalizeFooterNavigationBlocks(blocks, context = {}) {
  if (!Array.isArray(blocks)) return blocks;
  return blocks.map((block) => normalizeFooterNavigationBlock(block, context));
}

export function buildFooterLinksFromPages(pages = []) {
  const context = buildFooterNavigationContext({ pages });
  return context.pageRefs.map((page) => ({
    id: `footer-page-${page.slug}`,
    pageId: page.id,
    slug: page.slug,
    label: page.label,
    href: page.href,
  }));
}

export function matchFooterLinksToMainNavigationOrder(footerLinks = [], mainLinks = [], context = {}) {
  const normalizedFooter = normalizeFooterNavItems(footerLinks, context, { source: "footer.match.footerLinks" });
  const mainOrder = normalizeFooterNavItems(mainLinks, context, { source: "footer.match.mainLinks" });
  const rank = new Map();
  mainOrder.forEach((link, index) => {
    [link.pageId, link.slug, link.href, slugifyFooterNavValue(link.label)].forEach((value) => {
      const key = slugifyFooterNavValue(value) || safeString(value);
      if (key && !rank.has(key)) rank.set(key, index);
    });
  });

  return normalizedFooter
    .map((link, originalIndex) => {
      const keys = [link.pageId, link.slug, link.href, slugifyFooterNavValue(link.label)];
      const order = keys.reduce((best, value) => {
        const key = slugifyFooterNavValue(value) || safeString(value);
        return key && rank.has(key) ? Math.min(best, rank.get(key)) : best;
      }, Number.POSITIVE_INFINITY);
      return { link, originalIndex, order };
    })
    .sort((a, b) => (a.order - b.order) || (a.originalIndex - b.originalIndex))
    .map((entry) => entry.link);
}
