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

const FOOTER_NAVIGATION_PROP_ALIASES = [
  "navLinks",
  "footerLinks",
  "localNavigation",
  "editorNavigation",
  "resolvedNavigation",
  "matchedLinks",
  "links",
];

const FOOTER_MAIN_NAV_ORDER = [
  "home",
  "modules",
  "email",
  "sms",
  "crm",
  "funnels",
  "website-builder",
  "social-media",
  "project-hub",
  "about-us",
  "pricing",
  "contact-us",
];
const FOOTER_CANONICAL_SLUGS = new Set(FOOTER_MAIN_NAV_ORDER);

export const GR8_RESULT_FOOTER_NAVIGATION_LINKS = [
  { label: "Home", href: "/" },
  { label: "Modules", href: "/modules" },
  { label: "Email", href: "/email" },
  { label: "SMS", href: "/sms" },
  { label: "CRM", href: "/crm" },
  { label: "Funnels", href: "/funnels" },
  { label: "Website Builder", href: "/website-builder" },
  { label: "Social Media", href: "/social-media" },
  { label: "Project Hub", href: "/project-hub" },
  { label: "About Us", href: "/about-us" },
  { label: "Pricing", href: "/pricing" },
  { label: "Contact Us", href: "/contact-us" },
];

export const GR8_RESULT_FOOTER_NAVIGATION_GROUP_ID = "footer-navigation-card";

export const DEFAULT_FOOTER_COMPANY_LINKS = [
  { label: "Blog", href: "/blog" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms", href: "/terms" },
];

export const GR8_AUSTRALIAN_FOOTER_PANEL = {
  id: "footer-australian-company-panel",
  type: "australian-company-panel",
  heading: "Proudly Australian",
  body: "Gr8 Result Digital Solutions is proudly Australian owned and operated. Our platform development and customer support are handled by our Australian team.",
  location: "Sunshine Coast, Queensland",
  timezone: "UTC+10",
  flagImageUrl: "data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%20360%20240%27%3E%3Crect%20width%3D%27360%27%20height%3D%27240%27%20rx%3D%2724%27%20fill%3D%27%23012249%27/%3E%3Cpath%20d%3D%27M0%200h176v112H0z%27%20fill%3D%27%23012169%27/%3E%3Cpath%20d%3D%27M0%200l176%20112M176%200L0%20112%27%20stroke%3D%27%23fff%27%20stroke-width%3D%2720%27/%3E%3Cpath%20d%3D%27M0%200l176%20112M176%200L0%20112%27%20stroke%3D%27%23c8102e%27%20stroke-width%3D%2710%27/%3E%3Cpath%20d%3D%27M88%200v112M0%2056h176%27%20stroke%3D%27%23fff%27%20stroke-width%3D%2734%27/%3E%3Cpath%20d%3D%27M88%200v112M0%2056h176%27%20stroke%3D%27%23c8102e%27%20stroke-width%3D%2720%27/%3E%3Cg%20fill%3D%27%23f8d15c%27%3E%3Cpath%20d%3D%27M271%2039l7%2020h21l-17%2012%206%2020-17-12-17%2012%206-20-17-12h21z%27/%3E%3Cpath%20d%3D%27M230%20111l5%2014h15l-12%209%205%2014-13-9-12%209%205-14-12-9h15z%27/%3E%3Cpath%20d%3D%27M307%20120l5%2015h16l-13%209%205%2015-13-9-13%209%205-15-13-9h16z%27/%3E%3Cpath%20d%3D%27M269%20173l6%2018h19l-15%2011%206%2018-16-11-15%2011%206-18-16-11h19z%27/%3E%3Cpath%20d%3D%27M315%2069l4%2011h12l-10%207%204%2012-10-7-10%207%204-12-10-7h12z%27/%3E%3C/g%3E%3C/svg%3E",
};

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeAustralianFooterPanel(panel = {}) {
  const source = panel && typeof panel === "object" ? panel : {};
  return {
    ...GR8_AUSTRALIAN_FOOTER_PANEL,
    ...source,
    id: safeString(source.id) || GR8_AUSTRALIAN_FOOTER_PANEL.id,
    type: "australian-company-panel",
    role: "australian-company",
    heading: safeString(source.heading || source.title || source.label) || GR8_AUSTRALIAN_FOOTER_PANEL.heading,
    body: safeString(source.body || source.text || source.description) || GR8_AUSTRALIAN_FOOTER_PANEL.body,
    location: safeString(source.location) || GR8_AUSTRALIAN_FOOTER_PANEL.location,
    timezone: safeString(source.timezone) || GR8_AUSTRALIAN_FOOTER_PANEL.timezone,
    flagImageUrl: safeString(source.flagImageUrl || source.imageUrl || source.iconUrl) || GR8_AUSTRALIAN_FOOTER_PANEL.flagImageUrl,
  };
}

function buildGr8NavigationFooterGroup(context = {}) {
  context = resolveFooterNavigationContext(context);
  const pageMap = context?.pageMap;
  const links = GR8_RESULT_FOOTER_NAVIGATION_LINKS.map((link) => {
    const slug = slugifyFooterNavValue(link.href === "/" ? "home" : link.href);
    const matchedPage = pageMap?.get(slug) || pageMap?.get(link.href.replace(/^\/+/, "")) || null;
    return {
      id: `footer-nav-${slug}`,
      role: "navigation-link",
      pageId: matchedPage?.id || slug,
      slug: matchedPage?.slug || slug,
      label: matchedPage?.label || link.label,
      href: matchedPage?.href || link.href,
    };
  });

  return {
    id: GR8_RESULT_FOOTER_NAVIGATION_GROUP_ID,
    role: "navigation",
    type: "navigation-links",
    heading: "Navigation",
    links,
  };
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
  return !!name && !!slug && !OBJECT_LABEL_PATTERN.test(name) && !FAKE_LABEL_PATTERN.test(name);
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
      id: safeString(page.id || page.pageId || page.page_id) || slug,
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

function resolveFooterNavigationContext(context = {}) {
  if (context?.pageMap?.size) return context;
  if (context?.pageMap && typeof context.pageMap === "object") {
    const pageMap = new Map(Object.entries(context.pageMap).map(([key, value]) => {
      if (value && typeof value === "object") return [key, value];
      const href = safeString(value);
      const slug = slugifyFooterNavValue(key);
      return [key, { id: slug, slug, label: key, href }];
    }));
    return { ...context, pageMap };
  }
  if (Array.isArray(context?.pages)) {
    return buildFooterNavigationContext({ pages: context.pages, logInvalid: context.logInvalid });
  }
  return context || {};
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

function extractPageId(item) {
  if (!item || typeof item !== "object") return "";
  return safeString(item.pageId)
    || safeString(item.page_id)
    || safeString(item.internalPageId)
    || safeString(item.targetPageId)
    || safeString(item.target_page_id)
    || safeString(item.linkedPageId)
    || safeString(item.page?.id)
    || "";
}

function extractHref(item) {
  if (!item || typeof item !== "object") return "";
  return safeString(item.href)
    || safeString(item.url)
    || safeString(item.path)
    || safeString(item.slug)
    || safeString(item.pageSlug)
    || safeString(item.page?.slug)
    || safeString(item.page?.path);
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
    keys.push(
      item.pageId,
      item.page_id,
      item.internalPageId,
      item.targetPageId,
      item.target_page_id,
      item.linkedPageId,
      item.id,
      item.slug,
      item.pageSlug,
      item.path,
      item.url,
      item.href,
      item.page?.id,
      item.page?.slug,
      item.page?.path,
      item.page?.name,
      item.page?.title
    );
  }
  keys.push(label, href, safeString(href).replace(/^\/+/, "").split(/[?#]/)[0]);
  for (const value of keys) {
    const key = slugifyFooterNavValue(value) || safeString(value);
    if (key && pageMap.has(key)) return pageMap.get(key);
  }
  return null;
}

function isAllowedInternalHref(href, matchedPage, context) {
  if (!href) return true;
  if (matchedPage) return true;
  if (/^(https?:|mailto:|tel:|#)/i.test(href)) return true;
  if (!href.startsWith("/")) return false;
  const slug = slugifyFooterNavValue(href.replace(/^\/+/, "").split(/[?#]/)[0]);
  if (!slug || slug === "home") return true;
  if (UTILITY_SLUGS.has(slug)) return true;
  if (FOOTER_CANONICAL_SLUGS.has(slug)) return true;
  return !!context?.pageMap?.has(slug);
}

export function normalizeFooterNavItem(item, context = {}, meta = {}) {
  context = resolveFooterNavigationContext(context);
  if (!item) return null;
  if (typeof item !== "string" && typeof item !== "object") {
    if (context.logInvalid) logInvalidFooterNavItem(item, { ...meta, reason: "unsupported-type" });
    return null;
  }
  if (typeof item === "object" && isArchivedOrDeleted(item)) {
    if (context.logInvalid) logInvalidFooterNavItem(item, { ...meta, reason: "deleted-or-archived" });
    return null;
  }

  const rawLabel = extractLabel(item);
  const rawHref = extractHref(item);
  if (OBJECT_LABEL_PATTERN.test(rawLabel) || FAKE_LABEL_PATTERN.test(rawLabel)) {
    if (context.logInvalid) {
      logInvalidFooterNavItem(item, {
        ...meta,
        reason: OBJECT_LABEL_PATTERN.test(rawLabel) ? "object-label" : "fake-page-label",
      });
    }
    return null;
  }
  const matchedPage = findMatchingPage(item, rawLabel, rawHref, context);
  const label = safeString(rawLabel) || safeString(matchedPage?.label);
  const href = normalizeHref(rawHref, label, rawHref ? null : matchedPage);
  const isFakeFallback = FAKE_LABEL_PATTERN.test(label) && !matchedPage;

  if (!label || (OBJECT_LABEL_PATTERN.test(label) && !matchedPage) || isFakeFallback || !isAllowedInternalHref(href, matchedPage, context)) {
    if (context.logInvalid) {
      logInvalidFooterNavItem(item, {
        ...meta,
        reason: !label ? "empty-label" : OBJECT_LABEL_PATTERN.test(label) ? "object-label" : isFakeFallback ? "fake-page-label" : "missing-target-page",
      });
    }
    return null;
  }

  return typeof item === "object"
    ? { ...item, label, href }
    : { label, href };
}

export function normalizeFooterNavItems(items, context = {}, meta = {}) {
  context = resolveFooterNavigationContext(context);
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

function normalizeFooterLinkGroups(groups = [], context = {}) {
  context = resolveFooterNavigationContext(context);
  return (Array.isArray(groups) ? groups : [])
    .map((group, index) => {
      if (!group || typeof group !== "object") return null;
      if (safeString(group.type) === "australian-company-panel") {
        return normalizeAustralianFooterPanel(group);
      }
      const heading = safeString(group.heading || group.title || group.label || group.name) || "Links";
      const links = normalizeFooterNavItems(group.links || group.items || group.children, context, {
        source: "footer.props.linkGroups",
        groupIndex: index,
      });
      if (!links.length) return null;
      return {
        ...group,
        role: safeString(group.role) || (heading.toLowerCase() === "navigation" ? "navigation" : undefined),
        heading,
        links,
      };
    })
    .filter(Boolean);
}

export function applyGr8AustralianFooterPanel(block = {}, context = {}) {
  if (!block || typeof block !== "object" || block.type !== "footer") return block;
  const props = normalizeFooterNavigationProps(block.props || {}, context);
  const legalLinks = normalizeFooterNavItems(props.companyLinks?.length ? props.companyLinks : DEFAULT_FOOTER_COMPANY_LINKS, context, {
    source: "footer.props.companyLinks",
  });
  const groups = Array.isArray(props.linkGroups) ? props.linkGroups : [];
  const navigationGroup = groups.find((group) => safeString(group?.role) === "navigation" || /^(nav|navigation|navigate|pages)$/i.test(safeString(group?.heading || group?.title || group?.label || group?.name)));
  const withoutOldCompany = groups.filter((group) => {
    const type = safeString(group?.type);
    const role = safeString(group?.role);
    const heading = safeString(group?.heading || group?.title || group?.label || group?.name);
    return role === "navigation" || type === "australian-company-panel" || !/^(company|legal)$/i.test(heading);
  });
  const existingPanel = groups.find((group) => safeString(group?.type) === "australian-company-panel");
  const panel = normalizeAustralianFooterPanel(existingPanel);
  const requiredNavigationGroup = buildGr8NavigationFooterGroup(context);
  const navigationLinks = Array.isArray(navigationGroup?.links) ? navigationGroup.links : [];
  const navPanel = navigationGroup && navigationLinks.length >= GR8_RESULT_FOOTER_NAVIGATION_LINKS.length
    ? { ...navigationGroup, id: navigationGroup.id || GR8_RESULT_FOOTER_NAVIGATION_GROUP_ID, role: "navigation", type: navigationGroup.type || "navigation-links", heading: navigationGroup.heading || "Navigation" }
    : requiredNavigationGroup;
  const nextGroups = [
    navPanel,
    ...withoutOldCompany.filter((group) => safeString(group?.role) !== "navigation" && safeString(group?.type) !== "australian-company-panel"),
    panel,
  ];

  return {
    ...block,
    props: {
      ...props,
      linkGroups: nextGroups,
      footerCardOrder: ["contact", "navigation", "australian-company", "newsletter"],
      contactRole: "contact",
      newsletterRole: "newsletter",
      companyLinks: legalLinks,
      extraLinks: legalLinks,
      australianCompanyPanel: panel,
      footerNavManual: true,
    },
  };
}

function linksFromFooterGroup(groups = [], headingPattern) {
  const group = (Array.isArray(groups) ? groups : []).find((entry) => headingPattern.test(safeString(entry?.heading || entry?.title || entry?.label || entry?.name)));
  return Array.isArray(group?.links) ? group.links : null;
}

export function normalizeFooterNavigationProps(props = {}, context = {}) {
  context = resolveFooterNavigationContext(context);
  const nextProps = { ...(props && typeof props === "object" ? props : {}) };
  const explicitLinkGroups = normalizeFooterLinkGroups(nextProps.linkGroups, context);
  const rawNavigationLinks = Array.isArray(nextProps.navigationLinks)
    ? nextProps.navigationLinks
    : FOOTER_NAVIGATION_PROP_ALIASES.reduce((found, key) => found || (Array.isArray(nextProps[key]) ? nextProps[key] : null), null)
      || linksFromFooterGroup(explicitLinkGroups, /^(nav|navigation|navigate|pages)$/i);
  nextProps.navigationLinks = normalizeFooterNavItems(rawNavigationLinks, context, { source: "footer.props.navigationLinks" });
  const rawCompanyLinks = Array.isArray(nextProps.companyLinks) ? nextProps.companyLinks : null;
  const rawExtraLinks = rawCompanyLinks
    || nextProps.extraLinks
    || linksFromFooterGroup(explicitLinkGroups, /^(company|legal|resources|about)$/i);
  nextProps.companyLinks = normalizeFooterNavItems(rawExtraLinks, context, { source: "footer.props.companyLinks" });
  nextProps.extraLinks = nextProps.companyLinks;
  if (explicitLinkGroups.length) nextProps.linkGroups = explicitLinkGroups;
  FOOTER_NAVIGATION_PROP_ALIASES.forEach((key) => delete nextProps[key]);
  delete nextProps.extraHighlightHeading;
  delete nextProps.extraHighlightText;
  delete nextProps.spotlightHeading;
  delete nextProps.spotlightText;
  delete nextProps.highlightHeading;
  delete nextProps.highlightText;
  nextProps.spotlightItems = (Array.isArray(nextProps.spotlightItems) ? nextProps.spotlightItems : [])
    .filter((item) => {
      const text = safeString(item);
      return text
        && !OBJECT_LABEL_PATTERN.test(text)
        && !FAKE_LABEL_PATTERN.test(text)
        && !/^highlights$/i.test(text)
        && !/add a stronger closing note here/i.test(text);
    });
  return nextProps;
}

export function normalizeFooterNavigationBlock(block, context = {}) {
  context = resolveFooterNavigationContext(context);
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

function orderedFooterNavigationLinks(links = []) {
  const rank = new Map(FOOTER_MAIN_NAV_ORDER.map((slug, index) => [slug, index]));
  return [...links].sort((a, b) => {
    const aSlug = footerNavigationOrderSlug(a);
    const bSlug = footerNavigationOrderSlug(b);
    const aRank = rank.has(aSlug) ? rank.get(aSlug) : Number.MAX_SAFE_INTEGER;
    const bRank = rank.has(bSlug) ? rank.get(bSlug) : Number.MAX_SAFE_INTEGER;
    return (aRank - bRank) || String(a.label || "").localeCompare(String(b.label || ""));
  });
}

function footerNavigationOrderSlug(link = {}) {
  if (link.href === "/") return "home";
  return slugifyFooterNavValue(link.slug || link.href || link.label);
}

export function buildFooterLinksFromMainNavigation(mainLinks = [], pages = [], context = {}) {
  context = resolveFooterNavigationContext(context);
  if (!context?.pageMap?.size) context = buildFooterNavigationContext({ pages, logInvalid: context.logInvalid });
  const flattenedMainLinks = normalizeFooterNavItems(flattenNavigationLinks(mainLinks), context, { source: "footer.mainNavigation.flattened" });
  const pageLinks = buildFooterLinksFromPages(pages);
  const bySlug = new Map();
  [...flattenedMainLinks, ...pageLinks].forEach((link) => {
    const slug = slugifyFooterNavValue(link.slug || link.href || link.label);
    if (!slug || bySlug.has(slug)) return;
    bySlug.set(slug, {
      label: link.label,
      href: link.href,
    });
  });
  return orderedFooterNavigationLinks(Array.from(bySlug.values()));
}

export function footerBlockToGlobalFooter(block = {}, context = {}) {
  if (!block || typeof block !== "object" || block.type !== "footer") return null;
  const props = normalizeFooterNavigationProps(block.props || {}, context);
  return {
    navigationLinks: Array.isArray(props.navigationLinks) ? props.navigationLinks : [],
    companyLinks: Array.isArray(props.companyLinks) ? props.companyLinks : [],
    linkGroups: Array.isArray(props.linkGroups) ? props.linkGroups : [],
    australianCompanyPanel: props.australianCompanyPanel || null,
    contact: {
      heading: props.contactHeading || "",
      email: props.contactEmail || "",
      phone: props.contactPhone || "",
      address: props.contactAddress || "",
    },
    subscriberForm: {
      show: props.showNewsletter !== false,
      heading: props.newsletterHeading || "",
      subtitle: props.newsletterSubtitle || "",
      buttonText: props.newsletterButtonText || "",
    },
    branding: {
      brand: props.brand || "",
      tagline: props.tagline || "",
      copyrightText: props.copyrightText || "",
      logoWidth: props.logoWidth || "",
    },
  };
}

export function globalFooterToFooterBlock(globalFooter = {}, baseBlock = null) {
  if (!globalFooter || typeof globalFooter !== "object") return baseBlock;
  const props = {
    ...((baseBlock && typeof baseBlock === "object" ? baseBlock.props : {}) || {}),
    navigationLinks: Array.isArray(globalFooter.navigationLinks) ? globalFooter.navigationLinks : [],
    companyLinks: Array.isArray(globalFooter.companyLinks) ? globalFooter.companyLinks : [],
    extraLinks: Array.isArray(globalFooter.companyLinks) ? globalFooter.companyLinks : [],
    linkGroups: Array.isArray(globalFooter.linkGroups) ? globalFooter.linkGroups : baseBlock?.props?.linkGroups,
    australianCompanyPanel: globalFooter.australianCompanyPanel || baseBlock?.props?.australianCompanyPanel || null,
    contactHeading: globalFooter.contact?.heading || baseBlock?.props?.contactHeading || "",
    contactEmail: globalFooter.contact?.email || baseBlock?.props?.contactEmail || "",
    contactPhone: globalFooter.contact?.phone || baseBlock?.props?.contactPhone || "",
    contactAddress: globalFooter.contact?.address || baseBlock?.props?.contactAddress || "",
    showNewsletter: globalFooter.subscriberForm?.show ?? baseBlock?.props?.showNewsletter,
    newsletterHeading: globalFooter.subscriberForm?.heading || baseBlock?.props?.newsletterHeading || "",
    newsletterSubtitle: globalFooter.subscriberForm?.subtitle || baseBlock?.props?.newsletterSubtitle || "",
    newsletterButtonText: globalFooter.subscriberForm?.buttonText || baseBlock?.props?.newsletterButtonText || "",
    brand: globalFooter.branding?.brand || baseBlock?.props?.brand || "",
    tagline: globalFooter.branding?.tagline || baseBlock?.props?.tagline || "",
    copyrightText: globalFooter.branding?.copyrightText || baseBlock?.props?.copyrightText || "",
    logoWidth: globalFooter.branding?.logoWidth || baseBlock?.props?.logoWidth || "",
  };
  return {
    ...(baseBlock || { id: "global-footer", type: "footer" }),
    type: "footer",
    props,
  };
}

export function matchFooterLinksToMainNavigationOrder(footerLinks = [], mainLinks = [], context = {}) {
  const normalizedFooter = normalizeFooterNavItems(footerLinks, context, { source: "footer.match.footerLinks" });
  const mainOrder = normalizeFooterNavItems(flattenNavigationLinks(mainLinks), context, { source: "footer.match.mainLinks" });
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

export function flattenNavigationLinks(links = []) {
  const flattened = [];
  const visit = (items) => {
    (Array.isArray(items) ? items : []).forEach((item) => {
      if (!item || typeof item !== "object") {
        if (item) flattened.push(item);
        return;
      }
      const children = Array.isArray(item.children) ? item.children : Array.isArray(item.items) ? item.items : [];
      const href = safeString(item.href || item.url || item.path || item.slug || item.pageSlug);
      const hasNavigableSelf = href && href !== "#" && !item.separator && !item.submenuOnly;
      if (hasNavigableSelf || !children.length) flattened.push(item);
      if (children.length) visit(children);
    });
  };
  visit(links);
  return flattened;
}
