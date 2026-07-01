export const FULL_WIDTH_TEMPLATE_BLOCKS = new Set([
  "nav-bar",
  "hero",
  "parallax",
  "text",
  "cta-button",
  "feature-list",
  "testimonial",
  "pricing-table",
  "contact-form",
  "image-gallery",
  "columns-2",
  "columns-3",
  "stats",
  "team",
  "faq",
  "newsletter",
  "trust-badges",
  "marquee-strip",
  "image-stack",
  "footer",
]);

export const section = (type, props = {}) => ({
  direct: true,
  type,
  props: {
    baseLayoutWidth: 1500,
    ...(FULL_WIDTH_TEMPLATE_BLOCKS.has(type) ? { fullWidthBackground: props.fullWidthBackground ?? true } : {}),
    ...props,
  },
});

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export const TEMPLATE_VISUAL_SYSTEMS = {
  default: {
    nav: {
      variant: "boxed-brand",
      stickyMode: "sticky-solid",
      backgroundColor: "#081120",
      textColor: "#e2e8f0",
      buttonColor: "#ffffff",
      buttonTextColor: "#0f172a",
    },
    footer: {
      backgroundColor: "#081120",
      textColor: "#e2e8f0",
      linkColor: "#94a3b8",
      borderColor: "rgba(148,163,184,0.2)",
      newsletterButtonColor: "#38bdf8",
      newsletterButtonTextColor: "#081120",
      showNewsletter: true,
    },
    hero: {
      heroVariant: "split",
      backgroundColor: "#081120",
      textColor: "#e2e8f0",
      headlineColor: "#ffffff",
      buttonColor: "#22c55e",
      buttonTextColor: "#081120",
    },
    ctaStyle: "split-banner",
    galleryVariant: "balanced-grid",
    testimonialVariant: "wall",
    pricingVariant: "premium",
  },
  "website-business-agency": {
    nav: { variant: "split-dark", stickyMode: "sticky-transparent", backgroundColor: "#071521", textColor: "#d7f4ff", buttonColor: "linear-gradient(135deg,#34d399,#22c55e)", buttonTextColor: "#052e1a" },
    footer: { backgroundColor: "#071521", textColor: "#e0f2fe", linkColor: "#7dd3fc", borderColor: "rgba(125,211,252,0.18)", newsletterButtonColor: "#34d399", newsletterButtonTextColor: "#052e1a", showNewsletter: true },
    hero: { heroVariant: "split", backgroundColor: "#071521", textColor: "#d7f4ff", headlineColor: "#ffffff", buttonColor: "#34d399", buttonTextColor: "#052e1a" },
    ctaStyle: "spotlight-pill",
    galleryVariant: "editorial-strip",
    testimonialVariant: "spotlight",
  },
  "website-coach-personal-brand": {
    nav: { variant: "minimal-line", stickyMode: "sticky-solid", backgroundColor: "#2b1707", textColor: "#fff5e6", buttonColor: "#f59e0b", buttonTextColor: "#2b1707" },
    footer: { backgroundColor: "#1f1207", textColor: "#fff7ed", linkColor: "#fdba74", borderColor: "rgba(245,158,11,0.18)", newsletterButtonColor: "#f59e0b", newsletterButtonTextColor: "#2b1707", showNewsletter: false },
    hero: { heroVariant: "editorial", backgroundColor: "#3b1f0f", textColor: "#fff5e6", headlineColor: "#fff7ed", buttonColor: "#f59e0b", buttonTextColor: "#2b1707" },
    ctaStyle: "editorial-outline",
    galleryVariant: "editorial-strip",
    testimonialVariant: "spotlight",
  },
  "website-local-service": {
    nav: { variant: "boxed-brand", stickyMode: "sticky-solid", backgroundColor: "#062a24", textColor: "#ecfeff", buttonColor: "#14b8a6", buttonTextColor: "#042f2e" },
    footer: { backgroundColor: "#05231f", textColor: "#dffaf7", linkColor: "#7dd3c7", borderColor: "rgba(20,184,166,0.18)", newsletterButtonColor: "#14b8a6", newsletterButtonTextColor: "#042f2e", showNewsletter: false },
    hero: { heroVariant: "framed", backgroundColor: "#0b3b33", textColor: "#e6fffb", headlineColor: "#ffffff", buttonColor: "#14b8a6", buttonTextColor: "#042f2e" },
    ctaStyle: "split-banner",
    testimonialVariant: "cards",
  },
  "website-saas-simple": {
    nav: { variant: "split-dark", stickyMode: "sticky-transparent", backgroundColor: "#0b1020", textColor: "#dbeafe", buttonColor: "linear-gradient(135deg,#22d3ee,#2563eb)", buttonTextColor: "#ffffff" },
    footer: { backgroundColor: "#050914", textColor: "#e0e7ff", linkColor: "#93c5fd", borderColor: "rgba(99,102,241,0.22)", newsletterButtonColor: "#22d3ee", newsletterButtonTextColor: "#082f49", showNewsletter: true },
    hero: { heroVariant: "split", backgroundColor: "#0b1020", textColor: "#dbeafe", headlineColor: "#ffffff", buttonColor: "#22d3ee", buttonTextColor: "#082f49" },
    ctaStyle: "spotlight-pill",
    galleryVariant: "editorial-strip",
    testimonialVariant: "wall",
  },
  "website-restaurant-cafe": {
    nav: { variant: "minimal-line", stickyMode: "sticky-transparent", backgroundColor: "#2f1707", textColor: "#fff7ed", buttonColor: "#fb923c", buttonTextColor: "#431407" },
    footer: { backgroundColor: "#1f0f06", textColor: "#fff7ed", linkColor: "#fdba74", borderColor: "rgba(251,146,60,0.18)", newsletterButtonColor: "#fb923c", newsletterButtonTextColor: "#431407", showNewsletter: false },
    hero: { heroVariant: "editorial", backgroundColor: "#2f1707", textColor: "#fff1e6", headlineColor: "#fff7ed", buttonColor: "#fb923c", buttonTextColor: "#431407" },
    ctaStyle: "editorial-outline",
    galleryVariant: "masonry-overlap",
    testimonialVariant: "spotlight",
  },
  "website-portfolio-creative": {
    nav: { variant: "minimal-line", stickyMode: "sticky-transparent", backgroundColor: "#14112b", textColor: "#f5f3ff", buttonColor: "#c4b5fd", buttonTextColor: "#1e1b4b" },
    footer: { backgroundColor: "#120f25", textColor: "#f5f3ff", linkColor: "#c4b5fd", borderColor: "rgba(196,181,253,0.18)", newsletterButtonColor: "#c4b5fd", newsletterButtonTextColor: "#1e1b4b", showNewsletter: false },
    hero: { heroVariant: "editorial", backgroundColor: "#1f1a42", textColor: "#ede9fe", headlineColor: "#ffffff", buttonColor: "#c4b5fd", buttonTextColor: "#1e1b4b" },
    ctaStyle: "spotlight-pill",
    galleryVariant: "masonry-overlap",
    testimonialVariant: "cards",
  },
  "website-medical-clinic": {
    nav: { variant: "centered-light", stickyMode: "sticky-solid", backgroundColor: "#edf8ff", textColor: "#0f2f4d", buttonColor: "#38bdf8", buttonTextColor: "#083344" },
    footer: { backgroundColor: "#e0f2fe", textColor: "#0f2f4d", linkColor: "#0369a1", borderColor: "rgba(56,189,248,0.22)", newsletterButtonColor: "#38bdf8", newsletterButtonTextColor: "#083344", showNewsletter: false },
    hero: { heroVariant: "framed", backgroundColor: "#dff4ff", textColor: "#0f2f4d", headlineColor: "#082f49", buttonColor: "#38bdf8", buttonTextColor: "#083344" },
    ctaStyle: "split-banner",
  },
  "website-law-firm": {
    nav: { variant: "minimal-line", stickyMode: "sticky-solid", backgroundColor: "#141c2c", textColor: "#f8fafc", buttonColor: "#d4af37", buttonTextColor: "#23180a" },
    footer: { backgroundColor: "#101827", textColor: "#f8fafc", linkColor: "#cbd5e1", borderColor: "rgba(212,175,55,0.18)", newsletterButtonColor: "#d4af37", newsletterButtonTextColor: "#23180a", showNewsletter: false },
    hero: { heroVariant: "split", backgroundColor: "#1b2233", textColor: "#e2e8f0", headlineColor: "#ffffff", buttonColor: "#d4af37", buttonTextColor: "#23180a" },
    ctaStyle: "split-banner",
    galleryVariant: "balanced-grid",
    testimonialVariant: "cards",
  },
  "website-real-estate": {
    nav: { variant: "split-dark", stickyMode: "sticky-transparent", backgroundColor: "#13293d", textColor: "#f8fafc", buttonColor: "#c08457", buttonTextColor: "#1f130a" },
    footer: { backgroundColor: "#102235", textColor: "#f8fafc", linkColor: "#bfdbfe", borderColor: "rgba(191,219,254,0.18)", newsletterButtonColor: "#c08457", newsletterButtonTextColor: "#1f130a", showNewsletter: false },
    hero: { heroVariant: "framed", backgroundColor: "#183b56", textColor: "#e0f2fe", headlineColor: "#ffffff", buttonColor: "#c08457", buttonTextColor: "#1f130a" },
    ctaStyle: "split-banner",
    galleryVariant: "editorial-strip",
    testimonialVariant: "spotlight",
  },
  "website-salon-spa": {
    nav: { variant: "centered-light", stickyMode: "sticky-solid", backgroundColor: "#fff7f5", textColor: "#6b3f3b", buttonColor: "#d97786", buttonTextColor: "#fff7f5" },
    footer: { backgroundColor: "#fff1ee", textColor: "#6b3f3b", linkColor: "#be6472", borderColor: "rgba(217,119,134,0.18)", newsletterButtonColor: "#d97786", newsletterButtonTextColor: "#fff7f5", showNewsletter: false },
    hero: { heroVariant: "editorial", backgroundColor: "#fff4f0", textColor: "#6b3f3b", headlineColor: "#3b1f22", buttonColor: "#d97786", buttonTextColor: "#fff7f5" },
    ctaStyle: "editorial-outline",
    galleryVariant: "masonry-overlap",
    testimonialVariant: "spotlight",
  },
  "website-fitness-gym": {
    nav: { variant: "split-dark", stickyMode: "sticky-solid", backgroundColor: "#111827", textColor: "#f8fafc", buttonColor: "#ef4444", buttonTextColor: "#fff7ed" },
    footer: { backgroundColor: "#0b1120", textColor: "#f8fafc", linkColor: "#fca5a5", borderColor: "rgba(239,68,68,0.18)", newsletterButtonColor: "#ef4444", newsletterButtonTextColor: "#fff7ed", showNewsletter: false },
    hero: { heroVariant: "split", backgroundColor: "#151c2f", textColor: "#e5e7eb", headlineColor: "#ffffff", buttonColor: "#ef4444", buttonTextColor: "#fff7ed" },
    ctaStyle: "spotlight-pill",
    galleryVariant: "editorial-strip",
    testimonialVariant: "wall",
    pricingVariant: "premium",
  },
  "website-home-renovation": {
    nav: { variant: "boxed-brand", stickyMode: "sticky-solid", backgroundColor: "#1b1b1b", textColor: "#f8fafc", buttonColor: "#f59e0b", buttonTextColor: "#1c1917" },
    footer: { backgroundColor: "#141414", textColor: "#f8fafc", linkColor: "#fdba74", borderColor: "rgba(245,158,11,0.18)", newsletterButtonColor: "#f59e0b", newsletterButtonTextColor: "#1c1917", showNewsletter: false },
    hero: { heroVariant: "framed", backgroundColor: "#262626", textColor: "#f5f5f4", headlineColor: "#ffffff", buttonColor: "#f59e0b", buttonTextColor: "#1c1917" },
    ctaStyle: "split-banner",
    galleryVariant: "balanced-grid",
    testimonialVariant: "cards",
  },
  "website-accounting-bookkeeping": {
    nav: { variant: "centered-light", stickyMode: "sticky-solid", backgroundColor: "#f8fafc", textColor: "#1e293b", buttonColor: "#0f766e", buttonTextColor: "#ecfeff" },
    footer: { backgroundColor: "#e2e8f0", textColor: "#0f172a", linkColor: "#0f766e", borderColor: "rgba(15,118,110,0.18)", newsletterButtonColor: "#0f766e", newsletterButtonTextColor: "#ecfeff", showNewsletter: false },
    hero: { heroVariant: "framed", backgroundColor: "#f1f5f9", textColor: "#334155", headlineColor: "#0f172a", buttonColor: "#0f766e", buttonTextColor: "#ecfeff" },
    ctaStyle: "split-banner",
    testimonialVariant: "cards",
  },
  "website-plumbing-company": {
    nav: { variant: "boxed-brand", stickyMode: "sticky-solid", backgroundColor: "#082f49", textColor: "#e0f2fe", buttonColor: "#38bdf8", buttonTextColor: "#082f49" },
    footer: { backgroundColor: "#082032", textColor: "#e0f2fe", linkColor: "#7dd3fc", borderColor: "rgba(56,189,248,0.18)", newsletterButtonColor: "#38bdf8", newsletterButtonTextColor: "#082f49", showNewsletter: false },
    hero: { heroVariant: "framed", backgroundColor: "#0b3b5b", textColor: "#e0f2fe", headlineColor: "#ffffff", buttonColor: "#38bdf8", buttonTextColor: "#082f49" },
    ctaStyle: "split-banner",
    galleryVariant: "balanced-grid",
    testimonialVariant: "cards",
  },
  "website-electrician-company": {
    nav: { variant: "split-dark", stickyMode: "sticky-solid", backgroundColor: "#111827", textColor: "#f9fafb", buttonColor: "#fbbf24", buttonTextColor: "#1f2937" },
    footer: { backgroundColor: "#0f172a", textColor: "#f8fafc", linkColor: "#fcd34d", borderColor: "rgba(251,191,36,0.18)", newsletterButtonColor: "#fbbf24", newsletterButtonTextColor: "#1f2937", showNewsletter: false },
    hero: { heroVariant: "split", backgroundColor: "#111827", textColor: "#e5e7eb", headlineColor: "#ffffff", buttonColor: "#fbbf24", buttonTextColor: "#1f2937" },
    ctaStyle: "spotlight-pill",
    galleryVariant: "editorial-strip",
    testimonialVariant: "wall",
  },
  "website-hvac-air-conditioning": {
    nav: { variant: "split-dark", stickyMode: "sticky-transparent", backgroundColor: "#0c4a6e", textColor: "#e0f2fe", buttonColor: "#67e8f9", buttonTextColor: "#083344" },
    footer: { backgroundColor: "#082f49", textColor: "#e0f2fe", linkColor: "#67e8f9", borderColor: "rgba(103,232,249,0.18)", newsletterButtonColor: "#67e8f9", newsletterButtonTextColor: "#083344", showNewsletter: false },
    hero: { heroVariant: "split", backgroundColor: "#075985", textColor: "#e0f2fe", headlineColor: "#ffffff", buttonColor: "#67e8f9", buttonTextColor: "#083344" },
    ctaStyle: "spotlight-pill",
    galleryVariant: "editorial-strip",
    testimonialVariant: "wall",
  },
  "website-roofing-company": {
    nav: { variant: "minimal-line", stickyMode: "sticky-solid", backgroundColor: "#3f1d0d", textColor: "#fff7ed", buttonColor: "#fb923c", buttonTextColor: "#431407" },
    footer: { backgroundColor: "#2c160b", textColor: "#fff7ed", linkColor: "#fdba74", borderColor: "rgba(251,146,60,0.18)", newsletterButtonColor: "#fb923c", newsletterButtonTextColor: "#431407", showNewsletter: false },
    hero: { heroVariant: "editorial", backgroundColor: "#4a2410", textColor: "#ffedd5", headlineColor: "#ffffff", buttonColor: "#fb923c", buttonTextColor: "#431407" },
    ctaStyle: "editorial-outline",
    galleryVariant: "masonry-overlap",
    testimonialVariant: "spotlight",
  },
  "website-cleaning-services": {
    nav: { variant: "centered-light", stickyMode: "sticky-solid", backgroundColor: "#f7fdfc", textColor: "#134e4a", buttonColor: "#14b8a6", buttonTextColor: "#ecfeff" },
    footer: { backgroundColor: "#ecfdf5", textColor: "#134e4a", linkColor: "#0f766e", borderColor: "rgba(20,184,166,0.18)", newsletterButtonColor: "#14b8a6", newsletterButtonTextColor: "#ecfeff", showNewsletter: false },
    hero: { heroVariant: "framed", backgroundColor: "#dffaf7", textColor: "#134e4a", headlineColor: "#0f172a", buttonColor: "#14b8a6", buttonTextColor: "#ecfeff" },
    ctaStyle: "split-banner",
    galleryVariant: "balanced-grid",
    testimonialVariant: "cards",
  },
  "website-landscaping-lawn-care": {
    nav: { variant: "boxed-brand", stickyMode: "sticky-transparent", backgroundColor: "#163020", textColor: "#ecfdf5", buttonColor: "#84cc16", buttonTextColor: "#1a2e05" },
    footer: { backgroundColor: "#132a1b", textColor: "#ecfdf5", linkColor: "#bef264", borderColor: "rgba(132,204,22,0.18)", newsletterButtonColor: "#84cc16", newsletterButtonTextColor: "#1a2e05", showNewsletter: false },
    hero: { heroVariant: "framed", backgroundColor: "#1f4d2b", textColor: "#ecfdf5", headlineColor: "#ffffff", buttonColor: "#84cc16", buttonTextColor: "#1a2e05" },
    ctaStyle: "split-banner",
    galleryVariant: "masonry-overlap",
    testimonialVariant: "cards",
  },
  "website-pest-control": {
    nav: { variant: "split-dark", stickyMode: "sticky-solid", backgroundColor: "#1f2937", textColor: "#f9fafb", buttonColor: "#22c55e", buttonTextColor: "#052e16" },
    footer: { backgroundColor: "#111827", textColor: "#f9fafb", linkColor: "#86efac", borderColor: "rgba(34,197,94,0.18)", newsletterButtonColor: "#22c55e", newsletterButtonTextColor: "#052e16", showNewsletter: false },
    hero: { heroVariant: "split", backgroundColor: "#1f2937", textColor: "#e5e7eb", headlineColor: "#ffffff", buttonColor: "#22c55e", buttonTextColor: "#052e16" },
    ctaStyle: "spotlight-pill",
    galleryVariant: "editorial-strip",
    testimonialVariant: "wall",
  },
  "website-solar-energy": {
    nav: { variant: "split-dark", stickyMode: "sticky-transparent", backgroundColor: "#0f172a", textColor: "#f8fafc", buttonColor: "#facc15", buttonTextColor: "#422006" },
    footer: { backgroundColor: "#111827", textColor: "#f8fafc", linkColor: "#fde68a", borderColor: "rgba(250,204,21,0.18)", newsletterButtonColor: "#facc15", newsletterButtonTextColor: "#422006", showNewsletter: false },
    hero: { heroVariant: "split", backgroundColor: "#1e293b", textColor: "#e2e8f0", headlineColor: "#ffffff", buttonColor: "#facc15", buttonTextColor: "#422006" },
    ctaStyle: "spotlight-pill",
    galleryVariant: "editorial-strip",
    testimonialVariant: "wall",
  },
  "website-pool-service": {
    nav: { variant: "centered-light", stickyMode: "sticky-transparent", backgroundColor: "#ecfeff", textColor: "#155e75", buttonColor: "#06b6d4", buttonTextColor: "#ecfeff" },
    footer: { backgroundColor: "#cffafe", textColor: "#164e63", linkColor: "#0891b2", borderColor: "rgba(6,182,212,0.18)", newsletterButtonColor: "#06b6d4", newsletterButtonTextColor: "#ecfeff", showNewsletter: false },
    hero: { heroVariant: "framed", backgroundColor: "#dff9ff", textColor: "#155e75", headlineColor: "#0f172a", buttonColor: "#06b6d4", buttonTextColor: "#ecfeff" },
    ctaStyle: "split-banner",
    galleryVariant: "masonry-overlap",
    testimonialVariant: "cards",
  },
  "website-auto-repair": {
    nav: { variant: "split-dark", stickyMode: "sticky-solid", backgroundColor: "#111827", textColor: "#f9fafb", buttonColor: "#f97316", buttonTextColor: "#fff7ed" },
    footer: { backgroundColor: "#0f172a", textColor: "#f8fafc", linkColor: "#fdba74", borderColor: "rgba(249,115,22,0.18)", newsletterButtonColor: "#f97316", newsletterButtonTextColor: "#fff7ed", showNewsletter: false },
    hero: { heroVariant: "split", backgroundColor: "#1f2937", textColor: "#e5e7eb", headlineColor: "#ffffff", buttonColor: "#f97316", buttonTextColor: "#fff7ed" },
    ctaStyle: "spotlight-pill",
    galleryVariant: "editorial-strip",
    testimonialVariant: "wall",
  },
  "website-painting-decorating": {
    nav: { variant: "minimal-line", stickyMode: "sticky-transparent", backgroundColor: "#2f241f", textColor: "#fff7ed", buttonColor: "#f59e0b", buttonTextColor: "#422006" },
    footer: { backgroundColor: "#241b17", textColor: "#fff7ed", linkColor: "#fdba74", borderColor: "rgba(245,158,11,0.18)", newsletterButtonColor: "#f59e0b", newsletterButtonTextColor: "#422006", showNewsletter: false },
    hero: { heroVariant: "editorial", backgroundColor: "#3b2d27", textColor: "#fff7ed", headlineColor: "#ffffff", buttonColor: "#f59e0b", buttonTextColor: "#422006" },
    ctaStyle: "editorial-outline",
    galleryVariant: "masonry-overlap",
    testimonialVariant: "spotlight",
  },
  "website-concreting-company": {
    nav: { variant: "boxed-brand", stickyMode: "sticky-solid", backgroundColor: "#20252d", textColor: "#f8fafc", buttonColor: "#fb923c", buttonTextColor: "#431407" },
    footer: { backgroundColor: "#161a20", textColor: "#f8fafc", linkColor: "#fdba74", borderColor: "rgba(251,146,60,0.18)", newsletterButtonColor: "#fb923c", newsletterButtonTextColor: "#431407", showNewsletter: false },
    hero: { heroVariant: "split", backgroundColor: "#2a303a", textColor: "#e5e7eb", headlineColor: "#ffffff", buttonColor: "#fb923c", buttonTextColor: "#431407" },
    ctaStyle: "spotlight-pill",
    galleryVariant: "editorial-strip",
    testimonialVariant: "wall",
  },
  "website-fencing-gates": {
    nav: { variant: "boxed-brand", stickyMode: "sticky-solid", backgroundColor: "#304137", textColor: "#f0fdf4", buttonColor: "#a3e635", buttonTextColor: "#1a2e05" },
    footer: { backgroundColor: "#22302a", textColor: "#f0fdf4", linkColor: "#bef264", borderColor: "rgba(163,230,53,0.18)", newsletterButtonColor: "#a3e635", newsletterButtonTextColor: "#1a2e05", showNewsletter: false },
    hero: { heroVariant: "framed", backgroundColor: "#3a5246", textColor: "#f0fdf4", headlineColor: "#ffffff", buttonColor: "#a3e635", buttonTextColor: "#1a2e05" },
    ctaStyle: "split-banner",
    galleryVariant: "balanced-grid",
    testimonialVariant: "cards",
  },
  "website-flooring-tiling": {
    nav: { variant: "centered-light", stickyMode: "sticky-solid", backgroundColor: "#faf7f2", textColor: "#3f3a35", buttonColor: "#b45309", buttonTextColor: "#fff7ed" },
    footer: { backgroundColor: "#f5efe6", textColor: "#3f3a35", linkColor: "#b45309", borderColor: "rgba(180,83,9,0.18)", newsletterButtonColor: "#b45309", newsletterButtonTextColor: "#fff7ed", showNewsletter: false },
    hero: { heroVariant: "editorial", backgroundColor: "#f7f0e7", textColor: "#57534e", headlineColor: "#292524", buttonColor: "#b45309", buttonTextColor: "#fff7ed" },
    ctaStyle: "editorial-outline",
    galleryVariant: "masonry-overlap",
    testimonialVariant: "spotlight",
  },
  "website-garage-door-services": {
    nav: { variant: "split-dark", stickyMode: "sticky-solid", backgroundColor: "#111827", textColor: "#f8fafc", buttonColor: "#fbbf24", buttonTextColor: "#1f2937" },
    footer: { backgroundColor: "#0f172a", textColor: "#f8fafc", linkColor: "#fcd34d", borderColor: "rgba(251,191,36,0.18)", newsletterButtonColor: "#fbbf24", newsletterButtonTextColor: "#1f2937", showNewsletter: false },
    hero: { heroVariant: "split", backgroundColor: "#1f2937", textColor: "#e5e7eb", headlineColor: "#ffffff", buttonColor: "#fbbf24", buttonTextColor: "#1f2937" },
    ctaStyle: "spotlight-pill",
    galleryVariant: "editorial-strip",
    testimonialVariant: "wall",
  },
  "website-glass-glazing": {
    nav: { variant: "centered-light", stickyMode: "sticky-transparent", backgroundColor: "#eff6ff", textColor: "#1e3a8a", buttonColor: "#38bdf8", buttonTextColor: "#083344" },
    footer: { backgroundColor: "#dbeafe", textColor: "#1e3a8a", linkColor: "#0284c7", borderColor: "rgba(56,189,248,0.18)", newsletterButtonColor: "#38bdf8", newsletterButtonTextColor: "#083344", showNewsletter: false },
    hero: { heroVariant: "framed", backgroundColor: "#e0f2fe", textColor: "#0f2f4d", headlineColor: "#082f49", buttonColor: "#38bdf8", buttonTextColor: "#083344" },
    ctaStyle: "split-banner",
    galleryVariant: "masonry-overlap",
    testimonialVariant: "cards",
  },
  "website-mortgage-broker": {
    nav: { variant: "centered-light", stickyMode: "sticky-solid", backgroundColor: "#f8fafc", textColor: "#1e293b", buttonColor: "#1d4ed8", buttonTextColor: "#eff6ff" },
    footer: { backgroundColor: "#e2e8f0", textColor: "#0f172a", linkColor: "#1d4ed8", borderColor: "rgba(29,78,216,0.18)", newsletterButtonColor: "#1d4ed8", newsletterButtonTextColor: "#eff6ff", showNewsletter: false },
    hero: { heroVariant: "framed", backgroundColor: "#eff6ff", textColor: "#1e3a8a", headlineColor: "#0f172a", buttonColor: "#1d4ed8", buttonTextColor: "#eff6ff" },
    ctaStyle: "split-banner",
    galleryVariant: "balanced-grid",
    testimonialVariant: "cards",
  },
  "website-ecommerce-store": {
    nav: { variant: "minimal-line", stickyMode: "sticky-transparent", backgroundColor: "#111111", textColor: "#fafaf9", buttonColor: "#f97316", buttonTextColor: "#fff7ed" },
    footer: { backgroundColor: "#0f0f0f", textColor: "#fafaf9", linkColor: "#fdba74", borderColor: "rgba(249,115,22,0.18)", newsletterButtonColor: "#f97316", newsletterButtonTextColor: "#fff7ed", showNewsletter: true },
    hero: { heroVariant: "editorial", backgroundColor: "#18181b", textColor: "#fafaf9", headlineColor: "#ffffff", buttonColor: "#f97316", buttonTextColor: "#fff7ed" },
    ctaStyle: "editorial-outline",
    galleryVariant: "masonry-overlap",
    testimonialVariant: "spotlight",
  },
};

export function getVisualSystem(templateSlug) {
  return {
    ...TEMPLATE_VISUAL_SYSTEMS.default,
    ...(TEMPLATE_VISUAL_SYSTEMS[templateSlug] || {}),
    nav: {
      ...TEMPLATE_VISUAL_SYSTEMS.default.nav,
      ...((TEMPLATE_VISUAL_SYSTEMS[templateSlug] || {}).nav || {}),
    },
    footer: {
      ...TEMPLATE_VISUAL_SYSTEMS.default.footer,
      ...((TEMPLATE_VISUAL_SYSTEMS[templateSlug] || {}).footer || {}),
    },
    hero: {
      ...TEMPLATE_VISUAL_SYSTEMS.default.hero,
      ...((TEMPLATE_VISUAL_SYSTEMS[templateSlug] || {}).hero || {}),
    },
  };
}

export function cloneLinks(links = []) {
  return Array.isArray(links) ? links.map((link) => ({ ...link })) : [];
}

export function buildFooterContactDetails(profile) {
  const companyToken = String(profile?.siteName || "your-company")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/^[-]+|[-]+$/g, "") || "yourcompany";

  const templateSlug = String(profile?.templateSlug || "");
  const emailPrefix = (() => {
    switch (templateSlug) {
      case "website-law-firm":
        return "intake";
      case "website-mortgage-broker":
        return "loans";
      case "website-medical-clinic":
        return "appointments";
      case "website-restaurant-cafe":
        return "bookings";
      default:
        return "hello";
    }
  })();

  const contactAddress = (() => {
    switch (templateSlug) {
      case "website-law-firm":
        return "Private consultations available in your city";
      case "website-mortgage-broker":
        return "Supporting buyers, refinancers, and investors across your market";
      case "website-saas-simple":
        return "Remote onboarding and support for teams in your market";
      case "website-medical-clinic":
        return "Appointments available across your local area";
      case "website-real-estate":
        return "Local market guidance for buyers and sellers";
      default:
        return "Serving clients across your market";
    }
  })();

  return {
    contactHeading: "Contact",
    contactEmail: `${emailPrefix}@${companyToken}.com`,
    contactPhone: "(555) 010-2026",
    contactAddress,
  };
}

export function buildFooterDefaults(profile) {
  const siteName = String(profile?.siteName || "Your Brand");
  const objective = String(profile?.home?.objective || "").trim().replace(/[.]+$/, "");
  const genericTagline = objective
    ? `A sharper digital presence built to ${objective.charAt(0).toLowerCase()}${objective.slice(1)}.`
    : `${siteName} presented with more clarity, credibility, and next-step momentum.`;

  switch (profile?.templateSlug) {
    case "website-saas-simple":
      return {
        footerEyebrow: "Platform close",
        tagline: "Built to turn product interest into trials, demos, and faster day-one clarity.",
        newsletterHeading: "Product updates",
        newsletterSubtitle: "Use the signup to share launches, feature drops, and proof that keeps the product story moving.",
      };
    case "website-law-firm":
      return {
        footerEyebrow: "Credibility close",
        tagline: "Measured legal guidance, clearer next steps, and a more credible path into the first consultation.",
        newsletterHeading: "Legal updates",
        newsletterSubtitle: "Share insights, announcements, or firm updates without making the footer feel promotional.",
      };
    case "website-mortgage-broker":
      return {
        footerEyebrow: "Finance close",
        tagline: "Borrower-first finance guidance designed to make lending decisions feel clearer and easier to start.",
        newsletterHeading: "Rate and lending updates",
        newsletterSubtitle: "Use the footer signup for market updates, borrower tips, or changes that help prospects feel more prepared.",
      };
    default:
      return {
        footerEyebrow: "Closing note",
        tagline: genericTagline,
        newsletterHeading: "Stay in the loop",
        newsletterSubtitle: "Use the footer signup for updates, offers, or announcements that keep the site feeling active.",
      };
  }
}

export function resolveFooterVariant(templateSlug = "") {
  switch (templateSlug) {
    case "website-saas-simple":
    case "website-business-agency":
    case "website-ecommerce-store":
      return "split-newsletter";
    case "website-law-firm":
    case "website-mortgage-broker":
    case "website-accounting-bookkeeping":
    case "website-medical-clinic":
    case "website-real-estate":
      return "trust-columns";
    case "website-restaurant-cafe":
    case "website-portfolio-creative":
    case "website-salon-spa":
    case "website-coach-personal-brand":
      return "editorial";
    default:
      return "service-grid";
  }
}

export function buildFooterSpotlight(profile, pages = []) {
  const pageLinks = pages
    .filter((page) => !["privacy", "terms"].includes(String(page?.slug || "")))
    .map((page) => ({
      label: page.title,
      href: page.slug === "home" ? "/" : `/${page.slug}`,
    }));
  const serviceItems = asArray(profile?.home?.services?.items)
    .map((item) => item?.title)
    .filter(Boolean)
    .slice(0, 3);
  const featureItems = asArray(profile?.home?.features?.items)
    .map((item) => item?.title)
    .filter(Boolean)
    .slice(0, 3);
  const defaultItems = serviceItems.length ? serviceItems : featureItems;

  switch (profile?.templateSlug) {
    case "website-saas-simple":
      return {
        spotlightHeading: "Product story",
        spotlightText: "Keep the footer product-led so the site closes with activation, clarity, and next-step momentum instead of filler.",
        spotlightItems: defaultItems.length ? defaultItems : ["Automation flows", "Reporting clarity", "Team collaboration"],
        linkGroups: [
          { heading: "Product", links: pageLinks.slice(0, 3) },
          { heading: "Company", links: pageLinks.slice(3) },
        ],
      };
    case "website-law-firm":
      return {
        spotlightHeading: "Practice focus",
        spotlightText: "The footer should finish with calm authority, not generic startup language.",
        spotlightItems: defaultItems.length ? defaultItems : ["Confidential advice", "Principal-led matters", "Clear consultation steps"],
        linkGroups: [
          { heading: "Practice areas", links: pageLinks.slice(0, 3) },
          { heading: "Firm information", links: pageLinks.slice(3) },
        ],
      };
    case "website-mortgage-broker":
      return {
        spotlightHeading: "Borrower pathways",
        spotlightText: "Close with lending clarity and borrower readiness so the footer still feels useful.",
        spotlightItems: defaultItems.length ? defaultItems : ["First-home buyers", "Refinancing", "Investment lending"],
        linkGroups: [
          { heading: "Loan pathways", links: pageLinks.slice(0, 3) },
          { heading: "Before you enquire", links: pageLinks.slice(3) },
        ],
      };
    default:
      return {
        spotlightHeading: "What this site should reinforce",
        spotlightText: profile?.home?.objective || "Use the footer to close with credibility, direction, and a cleaner path to contact.",
        spotlightItems: defaultItems.length ? defaultItems : ["Clear navigation", "Trust signals", "Stronger contact flow"],
        linkGroups: [
          { heading: "Explore", links: pageLinks.slice(0, Math.ceil(pageLinks.length / 2)) },
          { heading: "More", links: pageLinks.slice(Math.ceil(pageLinks.length / 2)) },
        ],
      };
  }
}

export function collectDistinctImagePool(profile, preferred = []) {
  const seen = new Set();
  const images = [];

  const pushImage = (value) => {
    const next = String(value || "").trim();
    if (!next || seen.has(next)) return;
    seen.add(next);
    images.push(next);
  };

  preferred.forEach(pushImage);
  buildProfileImagePool(profile).forEach(pushImage);

  return images;
}

export function pickImageWindow(pool, start, count) {
  const source = Array.isArray(pool) ? pool.filter(Boolean) : [];
  if (!source.length || count <= 0) return [];

  const result = [];
  for (let index = 0; index < source.length && result.length < count; index += 1) {
    const candidate = source[(start + index) % source.length];
    if (!candidate || result.includes(candidate)) continue;
    result.push(candidate);
  }

  return result;
}

export function buildNav(profile, pages, system) {
  const primaryPages = pages.filter((page) => !["privacy", "terms"].includes(String(page?.slug || "")));

  return section("nav-bar", {
    variant: system.nav.variant,
    stickyMode: system.nav.stickyMode,
    fullWidthBackground: true,
    mobileMenuStyle: "hamburger",
    showLogo: true,
    brand: profile.siteName,
    links: primaryPages.map((page) => ({
      label: page.title,
      href: page.slug === "home" ? "/" : `/${page.slug}`,
    })),
    ctaText: profile.navCtaLabel || "Contact",
    ctaLink: profile.navCtaHref || "/contact",
    backgroundColor: system.nav.backgroundColor,
    textColor: system.nav.textColor,
    buttonColor: system.nav.buttonColor,
    buttonTextColor: system.nav.buttonTextColor,
  });
}

export function buildFooter(profile, pages, system) {
  const primaryNavLinks = pages
    .filter((page) => !["privacy", "terms"].includes(String(page?.slug || "")))
    .map((page) => ({
      label: page.title,
      href: page.slug === "home" ? "/" : `/${page.slug}`,
    }));
  const contactDetails = buildFooterContactDetails(profile);
  const footerStory = buildFooterSpotlight(profile, pages);
  const footerVariant = system.footer.footerVariant || resolveFooterVariant(profile.templateSlug);
  const footerDefaults = buildFooterDefaults(profile);

  return section("footer", {
    backgroundColor: system.footer.backgroundColor,
    textColor: system.footer.textColor,
    linkColor: system.footer.linkColor,
    borderColor: system.footer.borderColor,
    newsletterButtonColor: system.footer.newsletterButtonColor,
    newsletterButtonTextColor: system.footer.newsletterButtonTextColor,
    showNewsletter: system.footer.showNewsletter ?? true,
    footerVariant,
    brand: profile.siteName,
    footerEyebrow: system.footer.footerEyebrow || footerDefaults.footerEyebrow,
    tagline: system.footer.tagline || footerDefaults.tagline,
    contactHeading: system.footer.contactHeading || contactDetails.contactHeading,
    contactEmail: system.footer.contactEmail || contactDetails.contactEmail,
    contactPhone: system.footer.contactPhone || contactDetails.contactPhone,
    contactAddress: system.footer.contactAddress || contactDetails.contactAddress,
    navLinks: primaryNavLinks,
    navHeading: system.footer.navHeading || "Navigate",
    extraHeading: system.footer.extraHeading || "Legal",
    extraLinks: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
    linkGroups: footerStory.linkGroups,
    spotlightHeading: system.footer.spotlightHeading || footerStory.spotlightHeading,
    spotlightText: system.footer.spotlightText || footerStory.spotlightText,
    spotlightItems: system.footer.spotlightItems || footerStory.spotlightItems,
    newsletterHeading: system.footer.newsletterHeading || footerDefaults.newsletterHeading,
    newsletterSubtitle: system.footer.newsletterSubtitle || footerDefaults.newsletterSubtitle,
    newsletterButtonText: system.footer.newsletterButtonText || "Subscribe",
    copyrightText: `© ${new Date().getFullYear()} ${profile.siteName}. All rights reserved.`,
  });
}

export function buildHero(hero = {}, overrides = {}, system = TEMPLATE_VISUAL_SYSTEMS.default) {
  const hasEnableParallaxOverride = Object.prototype.hasOwnProperty.call(overrides, "enableParallax");

  return section("hero", {
    fullWidthBackground: overrides.fullWidthBackground ?? true,
    heroVariant: overrides.heroVariant || system.hero.heroVariant || "split",
    backgroundStyle: hero.imageUrl ? "image" : "gradient",
    backgroundImage: hero.imageUrl || "",
    backgroundPosition: overrides.backgroundPosition || hero.backgroundPosition || "center center",
    backgroundColor: overrides.backgroundColor || system.hero.backgroundColor || "#0f172a",
    minHeight: overrides.minHeight || "76vh",
    enableParallax: hasEnableParallaxOverride ? !!overrides.enableParallax : !!hero.imageUrl,
    sectionAnimation: overrides.sectionAnimation || "blur-in",
    sectionAnimationDelay: overrides.sectionAnimationDelay ?? 0,
    sectionAnimationSpeed: overrides.sectionAnimationSpeed || 1.05,
  });
}

export function buildLegalHeroSection(profile, title, subtitle, system) {
  const heroImage = getProfileImage(profile, 0, profile?.home?.hero?.imageUrl || "");
  const floatingImage = getProfileImage(profile, 1, profile?.about?.imageUrl || heroImage);

  return buildHero(
    {
      title,
      subtitle,
      primaryLabel: "Contact us",
      primaryHref: "/contact",
      imageUrl: heroImage,
    },
    {
      heroVariant: "split",
      backgroundColor: system.hero.backgroundColor || "#0f172a",
      textColor: system.hero.textColor || "#e2e8f0",
      headlineColor: system.hero.headlineColor || "#ffffff",
      buttonColor: system.hero.buttonColor || "#22c55e",
      buttonTextColor: system.hero.buttonTextColor || "#081120",
      floatingImage,
      floatingX: 77,
      floatingY: 52,
      floatingWidth: 320,
      floatingHeight: 320,
      minHeight: "540px",
      enableParallax: true,
      textAnimation: "fade-up",
      subheadlineAnimation: "fade-in",
    },
    system
  );
}

export function buildParallax(config = {}, system = TEMPLATE_VISUAL_SYSTEMS.default) {
  return section("parallax", {
    fullWidthBackground: config.fullWidthBackground ?? true,
    headline: config.title || "Parallax headline",
    subheadline: config.subtitle || "Use this section to add atmosphere and momentum between conversion-heavy sections.",
    ctaText: config.buttonLabel || "Explore",
    ctaLink: config.buttonHref || "#contact",
    headlineAlignment: config.alignment || "left",
    headlineColor: config.headlineColor || system.hero.headlineColor || "#ffffff",
    textColor: config.textColor || system.hero.textColor || "#e2e8f0",
    buttonColor: config.buttonColor || system.hero.buttonColor || "#22c55e",
    buttonTextColor: config.buttonTextColor || system.hero.buttonTextColor || "#081120",
    backgroundStyle: "image",
    backgroundImage: config.imageUrl || "",
    backgroundColor: config.backgroundColor || system.hero.backgroundColor || "#0f172a",
    contentX: config.contentX ?? 28,
    contentY: config.contentY ?? 50,
    contentWidth: config.contentWidth ?? 620,
    contentHeight: config.contentHeight ?? 220,
    verticalAlign: config.verticalAlign || "center",
    floatingImage: config.floatingImage || "",
    floatingX: config.floatingX ?? 76,
    floatingY: config.floatingY ?? 56,
    floatingWidth: config.floatingWidth ?? 260,
    floatingHeight: config.floatingHeight ?? 260,
    minHeight: config.minHeight || "72vh",
    textAnimation: "fade-up",
    enableParallax: true,
  });
}

export function buildText(title, body, options = {}) {
  const parts = [
    title ? `<strong>${title}</strong>` : "",
    body || "",
  ].filter(Boolean);

  return section("text", {
    text: parts.join("<br/><br/>"),
    alignment: options.alignment || "left",
    backgroundColor: options.backgroundColor || "#ffffff",
    textColor: options.textColor || "#0f172a",
    textFontSize: options.textFontSize || 18,
    minHeight: options.minHeight || "220px",
  });
}

export function buildFeatureList(config = {}, options = {}) {
  const fallbackImages = Array.isArray(options.fallbackImages) ? options.fallbackImages.filter(Boolean) : [];

  return section("feature-list", {
    sectionAnimation: options.sectionAnimation || "fade-up",
    sectionAnimationDelay: options.sectionAnimationDelay || 0,
    title: config.title || "Highlights",
    layout: options.layout || "columns",
    featureVariant: options.featureVariant || "cards",
    items: (config.items || []).map((item, index) => ({
      title: item.title || "Item",
      body: item.text || item.body || "Add supporting copy.",
      image: item.image || item.src || fallbackImages[index % fallbackImages.length] || options.fallbackImage || "",
    })),
  });
}

export function buildDecorativeDivider(system = TEMPLATE_VISUAL_SYSTEMS.default, style = "dots") {
  return section("divider", {
    style,
    color: system.footer.linkColor || system.hero.buttonColor || "#94a3b8",
  });
}

export function buildStats(config = {}) {
  const defaultStats = [
    {
      number: "1",
      label: "All-In-One Platform",
      detail: "Build websites, funnels, landing pages, CRM, bookings, email and automation inside one workspace.",
    },
    {
      number: "24/7",
      label: "Lead Capture & Follow-Up",
      detail: "Capture enquiries around the clock and keep prospects moving with automated follow-up.",
    },
    {
      number: "0",
      label: "Code Needed",
      detail: "Update pages, forms, content and campaigns without waiting on a developer.",
    },
    {
      number: "100%",
      label: "Owned Inside Gr8 Result",
      detail: "Keep your website, marketing tools, leads and business systems together in Gr8 Result.",
    },
  ];
  const configItems = Array.isArray(config.items) && config.items.length ? config.items : defaultStats;

  return section("stats", {
    sectionAnimation: config.sectionAnimation || "fade-up",
    sectionAnimationDelay: config.sectionAnimationDelay || 0.04,
    statsVariant: config.statsVariant || "split-scoreboard",
    title: config.title || "A website should be the start of the sales system",
    subtitle: config.subtitle || "Built to help you launch faster, capture more leads, and manage follow-up from one connected platform.",
    stats: configItems.map((item) => ({
      number: item.value || item.number || "0",
      label: item.label || item.text || "Metric",
      detail: item.detail || item.description || item.body || item.supportingText || item.text || item.label || "",
    })),
  });
}

export function buildGallery(config = {}, variant = "balanced-grid") {
  return section("image-gallery", {
    sectionAnimation: config.sectionAnimation || "fade-up",
    sectionAnimationDelay: config.sectionAnimationDelay || 0.06,
    title: config.title || "Gallery",
    galleryVariant: variant,
    columns: config.columns || 3,
    images: (config.images || []).map((image) => ({
      src: image.src || image.image || "",
      alt: image.alt || "Gallery image",
      caption: image.caption || "",
    })),
  });
}

export function buildTestimonials(config = {}, variant = "cards") {
  const items = (config.items || []).map((item) => ({
    text: item.quote || item.text || "Add customer proof here.",
    author: item.name || item.author || "Client Name",
    role: item.role || "Customer",
    rating: item.rating || 5,
  }));

  while (items.length > 0 && items.length < 3) {
    const seed = items[items.length - 1] || items[0];
    items.push({
      ...seed,
      author: `${seed.author || "Client"} ${items.length + 1}`,
    });
  }

  return section("testimonial", {
    sectionAnimation: config.sectionAnimation || "fade-up",
    sectionAnimationDelay: config.sectionAnimationDelay || 0.08,
    title: config.title || "Testimonials",
    testimonialVariant: variant,
    items,
  });
}

export function buildPricing(config = {}, variant = "premium") {
  return section("pricing-table", {
    sectionAnimation: config.sectionAnimation || "fade-up",
    sectionAnimationDelay: config.sectionAnimationDelay || 0.08,
    title: config.title || "Pricing",
    pricingVariant: variant,
    plans: (config.plans || []).map((plan, index) => ({
      id: `plan-${index + 1}`,
      name: plan.name || "Plan",
      price: `${plan.price || ""}${plan.period || ""}`,
      description: plan.description || "",
      includedFeatures: Array.isArray(plan.bullets || plan.features) ? (plan.bullets || plan.features).map((entry) => String(entry)) : [],
      features: Array.isArray(plan.bullets || plan.features) ? (plan.bullets || plan.features).map((entry) => String(entry)) : [],
      extras: Array.isArray(plan.extras) ? plan.extras.map((entry) => String(entry)) : [],
      cta: plan.cta || "Choose Plan",
      highlighted: !!plan.primary,
    })),
  });
}

export function buildFaq(config = {}) {
  return section("faq", {
    sectionAnimation: config.sectionAnimation || "fade-up",
    sectionAnimationDelay: config.sectionAnimationDelay || 0.1,
    title: config.title || "Frequently Asked Questions",
    items: (config.items || []).map((item) => ({
      question: item.q || item.question || "Question",
      answer: item.a || item.answer || "Answer",
    })),
  });
}

export function buildTrustBadges(labels = []) {
  return section("trust-badges", {
    sectionAnimation: "fade-up",
    sectionAnimationDelay: 0.02,
    badges: labels.map((label) => ({ icon: "✓", label })),
  });
}

export function buildMarqueeStrip(items = [], options = {}) {
  const labels = items.map((item) => String(item || "").trim()).filter(Boolean);
  return section("marquee-strip", {
    sectionAnimation: options.sectionAnimation || "fade-in",
    sectionAnimationDelay: options.sectionAnimationDelay || 0.04,
    backgroundColor: options.backgroundColor || "#081120",
    textColor: options.textColor || "#f8fafc",
    accentColor: options.accentColor || "#7dd3fc",
    speed: options.speed || 24,
    items: labels,
  });
}

export function buildShowcaseStack(config = {}) {
  const images = Array.isArray(config.images) ? config.images.filter(Boolean) : [];

  return section("image-stack", {
    title: config.title || "Visual Storyboard",
    minHeight: config.minHeight || "82vh",
    baseLayoutWidth: config.baseLayoutWidth || 1280,
    backgroundColor: config.backgroundColor || "#f8fafc",
    sectionAnimation: config.sectionAnimation || "zoom",
    sectionAnimationDelay: config.sectionAnimationDelay || 0.05,
    images: [
      {
        id: `${config.idPrefix || "showcase"}-image-a`,
        kind: "image",
        src: images[0] || "",
        x: 10,
        y: 16,
        width: 360,
        height: 250,
        rotation: -7,
        radius: 24,
        zIndex: 1,
      },
      {
        id: `${config.idPrefix || "showcase"}-copy`,
        kind: "text",
        content: config.copy || "Use layered media to make the page feel art-directed instead of flat.",
        x: 34,
        y: 28,
        width: 470,
        height: 210,
        rotation: 0,
        radius: 22,
        zIndex: 3,
        fontSize: config.fontSize || 30,
        fontWeight: "700",
        textAlign: "left",
        verticalAlign: "center",
        textColor: config.textColor || "#0f172a",
        background: config.copyBackground || "rgba(255,255,255,0.93)",
      },
      {
        id: `${config.idPrefix || "showcase"}-image-b`,
        kind: "image",
        src: images[1] || images[0] || "",
        x: 66,
        y: 14,
        width: 350,
        height: 260,
        rotation: 7,
        radius: 24,
        zIndex: 2,
      },
      {
        id: `${config.idPrefix || "showcase"}-image-c`,
        kind: "image",
        src: images[2] || images[1] || images[0] || "",
        x: 18,
        y: 62,
        width: 320,
        height: 230,
        rotation: -5,
        radius: 22,
        zIndex: 4,
      },
    ],
  });
}

export function getIndustryTrustBadges(profile) {
  switch (profile?.templateSlug) {
    case "website-business-agency":
      return ["Funnel-first strategy", "Paid traffic ready", "Senior-led execution", "Clear reporting cadence"];
    case "website-coach-personal-brand":
      return ["Signature method", "High-touch support", "Application-led fit", "Premium offer framing"];
    case "website-local-service":
      return ["Licensed and insured", "Fast quote turnaround", "Local suburb coverage", "Clear call-out process"];
    case "website-saas-simple":
      return ["Fast onboarding", "Workflow automations", "Team-level visibility", "Scales with growth"];
    case "website-restaurant-cafe":
      return ["Seasonal menu direction", "Private dining options", "Warm service standards", "Booking-first flow"];
    case "website-portfolio-creative":
      return ["Curated portfolio", "Creative direction", "High-touch collaboration", "Commercially clear offers"];
    case "website-medical-clinic":
      return ["Qualified practitioners", "Patient-first communication", "Clear booking steps", "Professional care pathways"];
    case "website-law-firm":
      return ["Principal-led advice", "Confidential matters", "Plain-English guidance", "Clear consultation steps"];
    case "website-real-estate":
      return ["Local market insight", "Vendor strategy", "Buyer follow-up", "Appraisal-ready flow"];
    case "website-salon-spa":
      return ["Premium client care", "Treatment-led bookings", "Studio aesthetic", "Repeat-visit friendly"];
    case "website-fitness-gym":
      return ["Coach-led training", "Structured programs", "Visible member progress", "Strong community culture"];
    case "website-home-renovation":
      return ["Licensed trades", "Project-managed delivery", "Clear quote process", "Craftsmanship-led finish"];
    case "website-accounting-bookkeeping":
      return ["Xero and cloud-ready", "On-time compliance", "Commercial advisory", "Responsive monthly support"];
    default:
      return ["Fast turnaround", "Clear process", "Launch-ready starter", "Editable in builder"];
  }
}

export function getIndustryContactFields(profile) {
  switch (profile?.templateSlug) {
    case "website-business-agency":
      return [
        { name: "name", label: "Full Name", type: "text", required: true, placeholder: "Talia Reed" },
        { name: "email", label: "Work Email", type: "email", required: true, placeholder: "talia@company.com" },
        { name: "businessType", label: "Business Type", type: "text", required: false, placeholder: "SaaS, eCommerce, service business..." },
        { name: "trafficSource", label: "Current Traffic Source", type: "text", required: false, placeholder: "Meta ads, Google ads, outbound, organic..." },
        { name: "goal", label: "Main Conversion Goal", type: "textarea", required: true, placeholder: "More booked calls, stronger lead quality, better ROAS..." },
      ];
    case "website-coach-personal-brand":
      return [
        { name: "name", label: "Full Name", type: "text", required: true, placeholder: "Nina Park" },
        { name: "email", label: "Email", type: "email", required: true, placeholder: "nina@example.com" },
        { name: "goal", label: "Primary Goal", type: "text", required: true, placeholder: "Leadership confidence, business growth, personal clarity..." },
        { name: "urgency", label: "Why Now?", type: "textarea", required: false, placeholder: "What is changing or feeling urgent right now?" },
        { name: "fit", label: "Best-Fit Notes", type: "textarea", required: false, placeholder: "Anything that would help assess fit before a call?" },
      ];
    case "website-local-service":
      return [
        { name: "name", label: "Name", type: "text", required: true, placeholder: "Lisa Brown" },
        { name: "phone", label: "Best Phone Number", type: "tel", required: true, placeholder: "0400 000 000" },
        { name: "suburb", label: "Suburb", type: "text", required: true, placeholder: "Bondi" },
        { name: "serviceType", label: "Service Needed", type: "text", required: true, placeholder: "Emergency repair, install, maintenance..." },
        { name: "urgency", label: "How Urgent Is It?", type: "text", required: false, placeholder: "Today, this week, flexible..." },
        { name: "jobDetails", label: "Job Details", type: "textarea", required: false, placeholder: "Describe the issue, fault, or work required." },
      ];
    case "website-saas-simple":
      return [
        { name: "name", label: "Full Name", type: "text", required: true, placeholder: "Arun Patel" },
        { name: "email", label: "Work Email", type: "email", required: true, placeholder: "arun@company.com" },
        { name: "teamSize", label: "Team Size", type: "text", required: false, placeholder: "1-5, 6-20, 20+" },
        { name: "currentStack", label: "Current Tool Stack", type: "text", required: false, placeholder: "HubSpot, spreadsheets, Slack, Airtable..." },
        { name: "workflow", label: "Workflow You Want to Improve", type: "textarea", required: true, placeholder: "Lead handoff, onboarding, reporting, follow-up..." },
      ];
    case "website-restaurant-cafe":
      return [
        { name: "name", label: "Name", type: "text", required: true, placeholder: "Sophie Grant" },
        { name: "email", label: "Email", type: "email", required: true, placeholder: "sophie@example.com" },
        { name: "date", label: "Preferred Date", type: "text", required: true, placeholder: "Friday 14 June" },
        { name: "partySize", label: "Party Size", type: "text", required: true, placeholder: "4 guests" },
        { name: "occasion", label: "Occasion", type: "text", required: false, placeholder: "Dinner, birthday, private event..." },
        { name: "notes", label: "Booking Notes", type: "textarea", required: false, placeholder: "Dietaries, seating preference, event details..." },
      ];
    case "website-portfolio-creative":
      return [
        { name: "name", label: "Name", type: "text", required: true, placeholder: "Ruby West" },
        { name: "email", label: "Email", type: "email", required: true, placeholder: "ruby@brand.com" },
        { name: "brandStage", label: "Brand Stage", type: "text", required: false, placeholder: "New launch, refresh, campaign, ongoing..." },
        { name: "deliverables", label: "Deliverables Needed", type: "text", required: false, placeholder: "Identity, campaign creative, site design..." },
        { name: "brief", label: "Project Brief", type: "textarea", required: true, placeholder: "What are you creating, and what should the work help achieve?" },
      ];
    case "website-medical-clinic":
      return [
        { name: "name", label: "Patient Name", type: "text", required: true, placeholder: "Claire Sutton" },
        { name: "email", label: "Email", type: "email", required: true, placeholder: "claire@example.com" },
        { name: "phone", label: "Phone", type: "tel", required: false, placeholder: "0400 000 000" },
        { name: "appointmentType", label: "Appointment Type", type: "text", required: true, placeholder: "Initial consult, review, treatment..." },
        { name: "availability", label: "Preferred Availability", type: "text", required: false, placeholder: "Weekdays, mornings, next week..." },
        { name: "notes", label: "Anything We Should Know", type: "textarea", required: false, placeholder: "Symptoms, referral, treatment interest..." },
      ];
    case "website-law-firm":
      return [
        { name: "name", label: "Full Name", type: "text", required: true, placeholder: "Julia Kent" },
        { name: "email", label: "Email", type: "email", required: true, placeholder: "julia@example.com" },
        { name: "matterType", label: "Matter Type", type: "text", required: true, placeholder: "Commercial, employment, property, private client..." },
        { name: "urgency", label: "Urgency", type: "text", required: false, placeholder: "Immediate, this week, exploratory..." },
        { name: "summary", label: "Matter Summary", type: "textarea", required: true, placeholder: "Share a brief summary so the team can triage the enquiry properly." },
      ];
    case "website-real-estate":
      return [
        { name: "name", label: "Full Name", type: "text", required: true, placeholder: "Sarah Lowe" },
        { name: "email", label: "Email", type: "email", required: true, placeholder: "sarah@example.com" },
        { name: "suburb", label: "Property Suburb", type: "text", required: true, placeholder: "Paddington" },
        { name: "propertyType", label: "Property Type", type: "text", required: false, placeholder: "House, apartment, investment..." },
        { name: "timing", label: "Likely Timing", type: "text", required: false, placeholder: "Selling soon, appraisal only, buying now..." },
        { name: "goal", label: "How Can We Help?", type: "textarea", required: false, placeholder: "Appraisal, campaign strategy, buyer support..." },
      ];
    case "website-salon-spa":
      return [
        { name: "name", label: "Name", type: "text", required: true, placeholder: "Olivia Hart" },
        { name: "email", label: "Email", type: "email", required: true, placeholder: "olivia@example.com" },
        { name: "treatment", label: "Treatment Interest", type: "text", required: true, placeholder: "Facial, brows, skin consult, package..." },
        { name: "availability", label: "Preferred Date or Time", type: "text", required: false, placeholder: "Thursday afternoon, next week..." },
        { name: "concerns", label: "Beauty or Skin Goals", type: "textarea", required: false, placeholder: "Glow prep, skin concerns, regular maintenance..." },
      ];
    case "website-fitness-gym":
      return [
        { name: "name", label: "Name", type: "text", required: true, placeholder: "Lachlan Grey" },
        { name: "email", label: "Email", type: "email", required: true, placeholder: "lachlan@example.com" },
        { name: "goal", label: "Primary Goal", type: "text", required: true, placeholder: "Strength, fat loss, routine, event prep..." },
        { name: "experience", label: "Training Experience", type: "text", required: false, placeholder: "Beginner, returning, experienced..." },
        { name: "availability", label: "Availability", type: "text", required: false, placeholder: "Mornings, evenings, weekends..." },
      ];
    case "website-home-renovation":
      return [
        { name: "name", label: "Full Name", type: "text", required: true, placeholder: "Megan Holt" },
        { name: "email", label: "Email", type: "email", required: true, placeholder: "megan@example.com" },
        { name: "suburb", label: "Project Location", type: "text", required: true, placeholder: "Manly" },
        { name: "projectType", label: "Project Type", type: "text", required: true, placeholder: "Kitchen renovation, extension, bathroom..." },
        { name: "stage", label: "Planning Stage", type: "text", required: false, placeholder: "Researching, ready to quote, plans drafted..." },
        { name: "scope", label: "Project Scope", type: "textarea", required: false, placeholder: "Describe the work, goals, and expected timing." },
      ];
    case "website-accounting-bookkeeping":
      return [
        { name: "name", label: "Full Name", type: "text", required: true, placeholder: "Karen Holt" },
        { name: "email", label: "Email", type: "email", required: true, placeholder: "karen@business.com" },
        { name: "businessType", label: "Business Type", type: "text", required: false, placeholder: "Agency, trades, eCommerce, consulting..." },
        { name: "software", label: "Current Finance Software", type: "text", required: false, placeholder: "Xero, MYOB, QuickBooks, spreadsheets..." },
        { name: "supportNeeded", label: "Support Needed", type: "textarea", required: true, placeholder: "Bookkeeping, BAS, payroll, cleanup, advisory..." },
      ];
    default:
      return [
        { name: "name", label: "Full Name", type: "text", required: true, placeholder: "Jane Smith" },
        { name: "email", label: "Email", type: "email", required: true, placeholder: "jane@example.com" },
        { name: "project", label: "Project or Goal", type: "textarea", required: false, placeholder: "What do you want this site to help you achieve?" },
        { name: "timeline", label: "Timeline", type: "text", required: false, placeholder: "When do you want to launch?" },
      ];
  }
}

export function buildColumns2(config = {}) {
  return section("columns-2", {
    ratio: config.ratio || "50-50",
    title: config.title || "",
    leftTitle: config.leftTitle || "",
    leftContent: config.leftContent || "",
    leftImage: config.leftImage || "",
    leftColumnContentType: config.leftColumnContentType || "text",
    rightTitle: config.rightTitle || "",
    rightContent: config.rightContent || "",
    rightImage: config.rightImage || "",
    rightColumnContentType: config.rightColumnContentType || "text",
    backgroundColor: config.backgroundColor || "transparent",
    cardBackgroundColor: config.cardBackgroundColor || "#ffffff",
    textColor: config.textColor || "#0f172a",
    columnGap: config.columnGap || 18,
  });
}

export function buildCta(config = {}, style = "spotlight-pill") {
  return section("cta-button", {
    eyebrow: config.eyebrow || "READY WHEN YOU ARE",
    title: config.title || "Take the next step",
    description: config.subtitle || config.description || "Guide visitors toward a clear next action.",
    text: config.buttonLabel || config.text || "Get Started",
    link: config.buttonHref || config.link || "#contact",
    note: config.note || "Fast setup, clearer offer, better conversion.",
    style,
  });
}

export function buildContact(config = {}, formFields = []) {
  return section("contact-form", {
    title: config.title || "Contact",
    subtitle: config.subtitle || "Share your details and we will get back to you.",
    mediaPosition: config.mediaImage ? "right" : "none",
    mediaImage: config.mediaImage || "",
    fields: formFields.length
      ? formFields
      : [
          { name: "name", label: "Your Name", type: "text", required: true, placeholder: "Jane Smith" },
          { name: "email", label: "Email", type: "email", required: true, placeholder: "jane@example.com" },
          { name: "message", label: "Message", type: "textarea", required: false, placeholder: "Tell us about your project" },
        ],
    submitText: config.submitText || "Send Details",
  });
}

export function buildPage(slug, title, objective, sections) {
  return {
    slug,
    title,
    objective,
    sections: sections.filter(Boolean),
  };
}

export function buildTemplatePageHref(slug = "home") {
  return `?page=${encodeURIComponent(String(slug || "home"))}`;
}

export function normalizeBlueprintHref(href, pageSlugs) {
  const raw = String(href || "").trim();
  if (!raw) return raw;
  if (raw.startsWith("#") || raw.startsWith("?page=") || /^[a-z]+:/i.test(raw)) return raw;
  if (raw === "/") return buildTemplatePageHref("home");

  const normalizedPath = raw.split("?")[0].split("#")[0].replace(/^\/+|\/+$/g, "").toLowerCase();
  if (!normalizedPath) return buildTemplatePageHref("home");
  if (pageSlugs.has(normalizedPath)) return buildTemplatePageHref(normalizedPath);

  return raw;
}

export function normalizeBlueprintLinks(blueprint) {
  const pages = Array.isArray(blueprint?.pages) ? blueprint.pages : [];
  const pageSlugs = new Set(
    pages
      .map((page) => String(page?.slug || "").trim().toLowerCase())
      .filter(Boolean)
  );
  if (!pageSlugs.size) return blueprint;

  const linkKeys = new Set(["href", "ctaHref", "ctaLink", "buttonHref", "link", "primaryHref", "secondaryHref"]);

  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;

    Object.entries(value).forEach(([key, entry]) => {
      if (typeof entry === "string" && linkKeys.has(key)) {
        value[key] = normalizeBlueprintHref(entry, pageSlugs);
        return;
      }
      visit(entry);
    });
  };

  visit(blueprint);
  return blueprint;
}

export function findPage(blueprint, slug) {
  return blueprint?.pages?.find((page) => page.slug === slug) || null;
}

export function insertAfterSectionType(page, type, sections) {
  if (!page || !Array.isArray(page.sections)) return;
  const items = (Array.isArray(sections) ? sections : [sections]).filter(Boolean);
  if (!items.length) return;
  const index = page.sections.findIndex((entry) => entry?.type === type);
  const nextSectionType = index >= 0 ? page.sections[index + 1]?.type : "";
  const insertAt = index >= 0
    ? index + (type === "hero" && nextSectionType === "marquee-strip" ? 2 : 1)
    : 0;
  page.sections.splice(insertAt, 0, ...items);
}

export function insertBeforeFooter(page, sections) {
  if (!page || !Array.isArray(page.sections)) return;
  const items = (Array.isArray(sections) ? sections : [sections]).filter(Boolean);
  if (!items.length) return;
  const footerIndex = page.sections.findIndex((entry) => entry?.type === "footer");
  page.sections.splice(footerIndex >= 0 ? footerIndex : page.sections.length, 0, ...items);
}

export function updateContactFormFields(page, fields) {
  if (!page || !Array.isArray(page.sections)) return;
  const formSection = page.sections.find((entry) => entry?.type === "contact-form");
  if (formSection) {
    formSection.props = {
      ...formSection.props,
      fields,
    };
  }
}

export function buildTeamMemberImagePool(templateSlug) {
  switch (templateSlug) {
    case "website-business-agency":
      return [
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=1200&q=80",
      ];
    case "website-coach-personal-brand":
      return [
        "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80",
      ];
    case "website-local-service":
      return [
        "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80",
      ];
    case "website-saas-simple":
      return [
        "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80",
      ];
    case "website-restaurant-cafe":
      return [
        "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1546961329-78bef0414d7c?auto=format&fit=crop&w=1200&q=80",
      ];
    case "website-portfolio-creative":
      return [
        "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80",
      ];
    case "website-medical-clinic":
      return [
        "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1612277795421-9bc7706a4a41?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1200&q=80",
      ];
    case "website-law-firm":
      return [
        "https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80",
      ];
    case "website-real-estate":
      return [
        "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1200&q=80",
      ];
    case "website-salon-spa":
      return [
        "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=1200&q=80",
      ];
    case "website-fitness-gym":
      return [
        "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=1200&q=80",
      ];
    case "website-home-renovation":
      return [
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80",
      ];
    case "website-accounting-bookkeeping":
      return [
        "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1200&q=80",
      ];
    default:
      return [
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=1200&q=80",
      ];
  }
}

export function attachTeamMemberImages(profile) {
  const members = profile?.about?.team?.members;
  if (!Array.isArray(members) || !members.length) return profile;

  const imagePool = buildTeamMemberImagePool(profile.templateSlug);
  return {
    ...profile,
    about: {
      ...profile.about,
      team: {
        ...profile.about.team,
        members: members.map((member, index) => {
          if (member?.image) return member;
          return {
            ...member,
            image: imagePool[index % imagePool.length],
            imageX: typeof member?.imageX === "number" ? member.imageX : 50,
            imageY: typeof member?.imageY === "number" ? member.imageY : 28,
          };
        }),
      },
    },
  };
}

export function buildLegalHero(pageTitle, profile, description) {
  return {
    eyebrow: "LEGAL",
    title: `${pageTitle} for ${profile.siteName}`,
    subtitle: description,
    primaryLabel: profile.navCtaLabel || "Contact",
    primaryHref: profile.navCtaHref || "/contact",
    secondaryLabel: "Back to Home",
    secondaryHref: "/",
    imageUrl: profile.about?.imageUrl || profile.home?.hero?.imageUrl || "",
  };
}

export function buildLegalTextSection(text) {
  return section("text", {
    text,
    alignment: "left",
    backgroundColor: "#ffffff",
    textColor: "#0f172a",
    textFontSize: 16,
    minHeight: "auto",
    paddingTop: 40,
    paddingBottom: 40,
  });
}

export function buildPrivacyPolicyText(profile) {
  const siteName = profile.siteName || "[Business Name]";
  return [
    `<strong>Privacy Policy</strong><br/><br/>Effective Date: [Effective Date]<br/>Last Updated: [Last Updated Date]<br/><br/>This Privacy Policy applies to [Business Legal Name], trading as ${siteName}, together with its affiliates, contractors, and service providers where applicable. It explains how ${siteName} collects, uses, stores, discloses, and protects personal information when a person visits this website, submits an enquiry, requests a quote, books a service, subscribes to marketing communications, purchases a product or service, or otherwise interacts with the business online or offline.` ,
    `<strong>1. Who We Are</strong><br/><br/>For the purposes of privacy and data protection laws, the data controller or business responsible for handling personal information is [Business Legal Name], located at [Business Address], with a primary privacy contact available at [Privacy Contact Email] and [Privacy Contact Phone]. If the business operates in more than one jurisdiction, insert the appropriate legal entity and compliance contact details for each region where customers are served.` ,
    `<strong>2. Information We Collect</strong><br/><br/>${siteName} may collect personal information that a person provides directly, including name, email address, phone number, company name, billing details, job title, service requirements, appointment preferences, uploaded files, payment information, and any message content submitted through forms, bookings, checkout pages, support channels, or account creation flows. The business may also collect technical and usage information automatically, including IP address, browser type, device information, operating system, referral URLs, pages viewed, actions taken on the website, approximate location, cookies, and analytics data. Where relevant, the business may also receive information from social platforms, payment processors, CRM systems, booking systems, ad platforms, or other third-party tools used to operate the website and deliver services.` ,
    `<strong>3. How We Use Personal Information</strong><br/><br/>${siteName} uses personal information to respond to enquiries, prepare proposals, provide booked or purchased services, process payments, send transactional communications, verify identity where required, manage accounts, maintain records, deliver customer support, improve website performance, personalise user experience, carry out analytics, protect the website from misuse, comply with legal obligations, and send marketing communications where permitted by law or consent. Personal information may also be used for internal reporting, service improvement, fraud prevention, complaint handling, and enforcing contractual rights.` ,
    `<strong>4. Legal Bases for Processing</strong><br/><br/>Where privacy law requires a legal basis for processing, ${siteName} relies on one or more of the following: consent, where a person has opted in to receive marketing or agreed to the use of optional cookies; performance of a contract, where the information is needed to provide requested services or fulfil an order; legitimate interests, where the business uses information to improve operations, maintain security, analyse demand, or respond to general business enquiries; and compliance with legal obligations, where records must be kept or disclosures must be made to regulators, courts, taxation authorities, or other lawful bodies.` ,
    `<strong>5. Cookies, Analytics, and Tracking Technologies</strong><br/><br/>This website may use cookies, pixels, tags, session storage, and related technologies to keep the site functioning, remember user preferences, measure performance, understand traffic sources, and support advertising or remarketing. Insert a list of the technologies actually used on the website, such as Google Analytics, Meta Pixel, Hotjar, Microsoft Clarity, Stripe, booking widgets, chat tools, or CRM tracking scripts. If regional laws require cookie consent banners or opt-out tools, those mechanisms should be implemented and described here. A person can usually control cookies through browser settings, but doing so may affect how some features work.` ,
    `<strong>6. When We Share Information</strong><br/><br/>${siteName} does not sell personal information in the ordinary course of business. Personal information may be shared with trusted third parties only where reasonably necessary to run the business or meet legal requirements. These third parties may include website hosts, cloud storage providers, payment processors, banks, accountants, lawyers, email service providers, CRM providers, advertising partners, booking systems, analytics vendors, contractors, subcontractors, and customer support tools. Information may also be disclosed where required by law, to respond to lawful requests, to protect rights and safety, to investigate suspected fraud or abuse, or in connection with a sale, merger, restructuring, or transfer of the business.` ,
    `<strong>7. International Transfers</strong><br/><br/>If ${siteName} uses software, contractors, or service providers located outside the country in which a person is based, personal information may be transferred to and processed in other jurisdictions. Where required by law, ${siteName} will use appropriate safeguards for those transfers, such as contractual protections, vendor due diligence, or equivalent lawful transfer mechanisms. Insert the relevant transfer language here if the business collects information from residents of jurisdictions with cross-border data transfer restrictions.` ,
    `<strong>8. Data Retention</strong><br/><br/>${siteName} keeps personal information only for as long as reasonably necessary to fulfil the purposes described in this Privacy Policy, including delivering services, resolving disputes, maintaining business and tax records, meeting legal requirements, enforcing agreements, and protecting the business from fraud or complaints. Retention periods should reflect the actual systems used by the business. Once information is no longer needed, it should be securely deleted, anonymised, or archived in accordance with internal record-keeping requirements and applicable law.` ,
    `<strong>9. Security Measures</strong><br/><br/>${siteName} takes reasonable administrative, technical, and physical steps to protect personal information from unauthorised access, misuse, interference, loss, disclosure, or alteration. These measures may include access controls, password protections, software updates, encryption, restricted staff access, vendor screening, and secure payment handling. No online system can be guaranteed completely secure, so the business cannot promise absolute security, but it will take commercially reasonable steps to protect the information it handles.` ,
    `<strong>10. Individual Rights</strong><br/><br/>Depending on the laws that apply, a person may have the right to request access to personal information, correction of inaccurate data, deletion of information, restriction of processing, objection to certain uses, portability of eligible data, withdrawal of consent, or a complaint to a privacy regulator. ${siteName} will assess and respond to rights requests in accordance with applicable law. To exercise a privacy right, a person should contact [Privacy Contact Email] and provide enough information for identity verification and request handling.` ,
    `<strong>11. Marketing Communications</strong><br/><br/>If a person subscribes to updates or otherwise consents to marketing, ${siteName} may send promotional emails, SMS, newsletters, offers, launch announcements, or service-related campaigns. A person can opt out of marketing at any time by using the unsubscribe mechanism in the message or by contacting the business directly. Operational emails about active services, invoices, bookings, legal notices, or account matters may still be sent where necessary even if marketing preferences are withdrawn.` ,
    `<strong>12. Children’s Privacy</strong><br/><br/>This website is not intended for children under [Minimum Age Required by Applicable Law], and ${siteName} does not knowingly collect personal information from children without lawful authority or parental consent where required. If the business becomes aware that personal information has been collected from a child contrary to law, it will take appropriate steps to delete that information.` ,
    `<strong>13. Third-Party Websites and Services</strong><br/><br/>This website may contain links to third-party websites, booking tools, payment providers, social media platforms, embedded content, or external applications. ${siteName} is not responsible for the privacy or security practices of those third parties. Users should review the privacy policies of any external platform they interact with through this website.` ,
    `<strong>14. Changes to This Privacy Policy</strong><br/><br/>${siteName} may update this Privacy Policy from time to time to reflect changes in business operations, technology, legal requirements, or data practices. The updated version should be published on this page with a revised effective date. Where required by law, users will be given additional notice or asked for fresh consent before material changes take effect.` ,
    `<strong>15. Contact Us</strong><br/><br/>Questions, concerns, access requests, correction requests, deletion requests, and privacy complaints should be directed to:<br/><br/>[Business Legal Name]<br/>Trading as ${siteName}<br/>[Business Address]<br/>[Privacy Contact Email]<br/>[Privacy Contact Phone]<br/><br/>If the business is subject to a specific privacy regulator or supervisory authority, insert the relevant jurisdiction and complaint escalation details here.` ,
  ].join("<br/><br/>");
}

export function buildTermsText(profile) {
  const siteName = profile.siteName || "[Business Name]";
  return [
    `<strong>Terms of Service</strong><br/><br/>Effective Date: [Effective Date]<br/>Last Updated: [Last Updated Date]<br/><br/>These Terms of Service govern access to and use of the website operated by [Business Legal Name], trading as ${siteName}, as well as any products, services, digital resources, bookings, proposals, subscriptions, or communications made available through the website. By accessing the website or engaging with ${siteName}, a user agrees to be bound by these Terms of Service and any additional policies, notices, or agreements that are expressly incorporated into them.` ,
    `<strong>1. Parties and Scope</strong><br/><br/>These Terms apply between [Business Legal Name], trading as ${siteName}, and any person or entity who visits the website, submits an enquiry, makes a booking, purchases a product or service, creates an account, or otherwise interacts with the business through this website. If a person is acting on behalf of a company, trust, partnership, or other entity, that person confirms they have authority to bind that entity to these Terms.` ,
    `<strong>2. Website Use</strong><br/><br/>Users may access the website only for lawful purposes and in a way that does not infringe the rights of others, disrupt site availability, interfere with security, introduce malicious code, scrape data without permission, attempt unauthorised access, impersonate another person, or misuse content, forms, systems, or communications. ${siteName} may suspend, restrict, or terminate access to the website at any time if it believes a user has breached these Terms, created risk for the business, or used the website in a way that is unlawful, abusive, misleading, or harmful.` ,
    `<strong>3. Services, Quotes, and Enquiries</strong><br/><br/>Information on this website is provided for general information and marketing purposes unless stated otherwise. A submitted enquiry, contact form, booking request, discovery call, or quote request does not by itself create a binding service agreement unless ${siteName} expressly confirms the engagement in writing. Quotes, estimates, proposals, packages, timelines, deliverables, and pricing shown on the website or in pre-contract discussions are subject to change, confirmation, scoping, availability, and any separate written agreement issued by the business.` ,
    `<strong>4. Bookings, Orders, and Acceptance</strong><br/><br/>If the website allows a user to request a booking, appointment, consultation, trial, reservation, or order, the request is not confirmed until ${siteName} accepts it. The business may reject or reschedule requests at its discretion, including where availability changes, information is incomplete, payment is not received, the request falls outside the business scope, or the user is not a suitable fit for the relevant service. Insert any specific acceptance, intake, screening, waitlist, or approval language that applies to the business model.` ,
    `<strong>5. Payments, Deposits, and Billing</strong><br/><br/>Where payment is required, the user agrees to pay all applicable fees, taxes, charges, and approved expenses in the amount and currency specified by ${siteName}. Insert the actual billing rules that apply to the business here, including whether deposits are required, whether invoices are due on issue or within a set number of days, whether subscriptions renew automatically, whether late fees apply, and whether work may pause if payment is overdue. If the website uses third-party payment processors, payment handling is also subject to the terms of those providers.` ,
    `<strong>6. Cancellations, Rescheduling, and Refunds</strong><br/><br/>Cancellation, rescheduling, refund, and credit entitlements depend on the business model and must be customised before publication. Insert the actual policy that applies to bookings, services, memberships, events, retainers, digital products, or consultations. Unless local law requires otherwise, ${siteName} may retain deposits, charge for work already completed, deduct administrative costs, or refuse refunds for services already delivered, custom work commenced, perishable dates, or digital resources already accessed.` ,
    `<strong>7. User Responsibilities</strong><br/><br/>A user agrees to provide accurate and complete information, respond in a timely way where input is required, maintain the confidentiality of any account credentials, and cooperate with reasonable requests necessary for delivery of services. ${siteName} is not responsible for delays, failures, or extra costs caused by missing information, inaccurate submissions, delayed approvals, third-party provider failures, changes requested after work begins, or circumstances outside the business’s reasonable control.` ,
    `<strong>8. Intellectual Property</strong><br/><br/>Unless otherwise stated in a separate written agreement, all content on this website, including text, designs, branding, graphics, layouts, code, documents, videos, downloads, and other materials, is owned by or licensed to ${siteName} and is protected by intellectual property laws. A user may view the website for personal or internal business evaluation purposes, but may not reproduce, copy, republish, distribute, modify, exploit, reverse engineer, or create derivative works from any content without prior written permission. If the business provides custom deliverables, ownership, licence scope, portfolio rights, and usage rights should be defined in the relevant client agreement.` ,
    `<strong>9. Third-Party Platforms and Integrations</strong><br/><br/>This website may integrate with or link to third-party services such as payment gateways, booking systems, social media platforms, analytics tools, maps, video providers, CRM systems, or external software. ${siteName} is not responsible for the availability, security, functionality, or terms of any third-party service. Use of those services may be subject to separate terms and policies imposed by the relevant provider.` ,
    `<strong>10. Disclaimers</strong><br/><br/>To the maximum extent permitted by law, the website and its content are provided on an “as is” and “as available” basis. ${siteName} does not guarantee uninterrupted access, error-free operation, specific outcomes, or suitability for every purpose. Insert any service-specific disclaimers relevant to the business here, such as educational-not-advice wording, results-not-guaranteed language, consultation limitations, or information-only statements. Nothing in these Terms excludes rights that cannot lawfully be excluded under applicable consumer or contract law.` ,
    `<strong>11. Limitation of Liability</strong><br/><br/>To the maximum extent permitted by law, ${siteName} is not liable for indirect, incidental, consequential, special, punitive, or loss-of-profit damages arising from use of the website, reliance on its content, third-party service failures, unauthorised access, delays, interruptions, or any service relationship except where liability cannot legally be limited. Where liability may be limited by law, ${siteName}'s total liability in connection with a claim relating to the website or services will be limited to the amount paid by the relevant user for the affected service in the [insert relevant time period], or another lawful cap set by the governing agreement or applicable legislation.` ,
    `<strong>12. Indemnity</strong><br/><br/>A user agrees to indemnify and hold harmless ${siteName}, its directors, officers, employees, contractors, and agents from claims, losses, liabilities, damages, costs, and expenses arising from the user’s unlawful conduct, breach of these Terms, misuse of the website, infringement of third-party rights, or provision of inaccurate or misleading information.` ,
    `<strong>13. Suspension and Termination</strong><br/><br/>${siteName} may suspend or terminate access to the website, a user account, a booking pathway, or service-related access where reasonably necessary to protect the business, enforce these Terms, manage risk, address non-payment, investigate misconduct, comply with law, or respond to security issues. Rights and obligations intended to survive termination, including payment obligations, liability limits, indemnities, confidentiality, and intellectual property protections, will continue after termination.` ,
    `<strong>14. Privacy</strong><br/><br/>Use of the website is also subject to the Privacy Policy published by ${siteName}. By using the website, a user acknowledges that personal information may be collected and handled in accordance with that policy.` ,
    `<strong>15. Governing Law and Disputes</strong><br/><br/>These Terms are governed by the laws of [Jurisdiction, State, or Country], unless another mandatory law applies. The parties agree that courts or tribunals located in [Jurisdiction] will have non-exclusive or exclusive jurisdiction, depending on the business’s preferred position and applicable law. Insert any dispute resolution steps required by the business, such as negotiation periods, mediation, venue rules, or consumer complaint processes, before publication.` ,
    `<strong>16. Changes to These Terms</strong><br/><br/>${siteName} may update these Terms from time to time. The updated version will be posted on this page with a revised effective date. Continued use of the website after an update constitutes acceptance of the revised Terms to the extent permitted by law.` ,
    `<strong>17. Contact Details</strong><br/><br/>Questions about these Terms, service conditions, bookings, payments, cancellations, or commercial terms should be directed to:<br/><br/>[Business Legal Name]<br/>Trading as ${siteName}<br/>[Business Address]<br/>[Contact Email]<br/>[Contact Phone]` ,
  ].join("<br/><br/>");
}

export function buildPrivacyPolicyPage(profile, system, nav, footer) {
  return buildPage("privacy", "Privacy Policy", "Explain how visitor and customer data is handled.", [
    nav,
    buildLegalHeroSection(profile, "Privacy Policy", "Explain how visitor, enquiry, and customer information is collected, used, stored, and protected.", system),
    buildDecorativeDivider(system, "dots"),
    buildLegalTextSection(buildPrivacyPolicyText(profile)),
    buildDecorativeDivider(system, "line"),
    footer,
  ]);
}

export function buildTermsPage(profile, system, nav, footer) {
  return buildPage("terms", "Terms of Service", "Set the rules, disclaimers, and commercial boundaries for the site.", [
    nav,
    buildLegalHeroSection(profile, "Terms of Service", "Set the legal rules, commercial terms, disclaimers, and service conditions that apply to this website.", system),
    buildDecorativeDivider(system, "dashes"),
    buildLegalTextSection(buildTermsText(profile)),
    buildDecorativeDivider(system, "line"),
    footer,
  ]);
}

export function uniqueImageList(...values) {
  const seen = new Set();
  return values.filter((value) => {
    const next = String(value || "").trim();
    if (!next || seen.has(next)) return false;
    seen.add(next);
    return true;
  });
}

export const MIN_TEMPLATE_IMAGE_COUNT = 6;

export function buildTemplateFallbackImagePool(templateSlug) {
  return uniqueImageList(
    ...buildTeamMemberImagePool(templateSlug),
    "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=80"
  );
}

export function buildProfileImagePool(profile) {
  return uniqueImageList(
    profile?.home?.hero?.imageUrl,
    ...(profile?.home?.gallery?.images || []).map((image) => image?.src),
    profile?.about?.imageUrl,
    ...(((profile?.about?.team?.members) || []).map((member) => member?.image)),
    ...(profile?.proofPage?.gallery?.images || []).map((image) => image?.src),
    profile?.contactPage?.hero?.imageUrl,
    profile?.servicesPage?.hero?.imageUrl,
    ...buildTemplateFallbackImagePool(profile?.templateSlug)
  );
}

export function createTemplateImagePicker(profile) {
  const pool = buildProfileImagePool(profile);
  let cursor = 0;

  return (fallback = "") => {
    if (!pool.length) return fallback || "";
    const next = pool[cursor % pool.length] || fallback || "";
    cursor += 1;
    return next || fallback || "";
  };
}

export function enrichBlueprintImages(blueprint, profile) {
  if (!blueprint || !Array.isArray(blueprint.pages)) return blueprint;

  const takeImage = createTemplateImagePicker(profile);

  return {
    ...blueprint,
    pages: blueprint.pages.map((page) => ({
      ...page,
      sections: asArray(page?.sections).map((section) => {
        const props = section?.props;
        if (!props) return section;

        switch (section.type) {
          case "hero":
          case "parallax": {
            const backgroundImage = props.backgroundImage || takeImage("");
            const hasExplicitFloatingImage = Object.prototype.hasOwnProperty.call(props, "floatingImage");
            const floatingImage = hasExplicitFloatingImage
              ? props.floatingImage || ""
              : takeImage(backgroundImage);
            return {
              ...section,
              props: {
                ...props,
                backgroundStyle: backgroundImage ? "image" : props.backgroundStyle,
                backgroundImage,
                floatingImage,
              },
            };
          }

          case "feature-list":
            return {
              ...section,
              props: {
                ...props,
                items: asArray(props.items).map((item) => (
                  item && typeof item === "object"
                    ? { ...item, image: item.image || takeImage("") }
                    : item
                )),
              },
            };

          case "image-gallery": {
            const images = asArray(props.images).map((image, index) => ({
              ...image,
              src: image?.src || image?.image || takeImage(""),
              alt: image?.alt || `Gallery image ${index + 1}`,
            }));

            while (images.length < MIN_TEMPLATE_IMAGE_COUNT) {
              images.push({
                src: takeImage(""),
                alt: `Gallery image ${images.length + 1}`,
                caption: "",
              });
            }

            return {
              ...section,
              props: {
                ...props,
                images: images.slice(0, 6),
              },
            };
          }

          case "team":
            return {
              ...section,
              props: {
                ...props,
                members: asArray(props.members).map((member) => ({
                  ...member,
                  image: member?.image || takeImage(""),
                })),
              },
            };

          case "columns-2": {
            const hasVisual = !!(props.leftImage || props.rightImage);
            const nextRightImage = props.rightImage || (!hasVisual ? takeImage("") : "");
            return {
              ...section,
              props: {
                ...props,
                rightImage: nextRightImage,
                rightColumnContentType: nextRightImage ? "image" : props.rightColumnContentType || "text",
              },
            };
          }

          case "contact-form": {
            const mediaImage = props.mediaImage || takeImage("");
            return {
              ...section,
              props: {
                ...props,
                mediaImage,
                mediaPosition: mediaImage ? (props.mediaPosition || "right") : props.mediaPosition,
              },
            };
          }

          case "image-stack":
            return {
              ...section,
              props: {
                ...props,
                images: asArray(props.images).map((layer) => (
                  layer?.kind === "image"
                    ? { ...layer, src: layer.src || takeImage("") }
                    : layer
                )),
              },
            };

          default:
            return section;
        }
      }),
    })),
  };
}

export function getProfileImage(profile, index, fallback = "") {
  const pool = buildProfileImagePool(profile);
  if (!pool.length) return fallback || "";
  return pool[index % pool.length] || fallback || "";
}

export function withHeroMedia(hero = {}, profile, primaryIndex = 0, secondaryIndex = 1) {
  const primaryImage = hero?.imageUrl || getProfileImage(profile, primaryIndex, "");
  const secondaryImage = hero?.floatingImage || getProfileImage(profile, secondaryIndex, primaryImage);

  return {
    ...hero,
    imageUrl: primaryImage,
    floatingImage: secondaryImage,
  };
}

