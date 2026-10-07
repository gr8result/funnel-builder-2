const FULL_WIDTH_TEMPLATE_BLOCKS = new Set([
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

const section = (type, props = {}) => ({
  direct: true,
  type,
  props: {
    baseLayoutWidth: 1500,
    ...(FULL_WIDTH_TEMPLATE_BLOCKS.has(type) ? { fullWidthBackground: props.fullWidthBackground ?? true } : {}),
    ...props,
  },
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

const TEMPLATE_VISUAL_SYSTEMS = {
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
  "website-residential-home-builder": {
    nav: { variant: "split-dark", stickyMode: "sticky-solid", backgroundColor: "#1c1a17", textColor: "#f5f1ea", buttonColor: "#c8a97e", buttonTextColor: "#1c1a17" },
    footer: {
      backgroundColor: "#161412",
      textColor: "#cfc8bd",
      linkColor: "#c8a97e",
      borderColor: "rgba(200,169,126,0.18)",
      showNewsletter: false,
      footerEyebrow: "QBCC Licensed Builder · Sunshine Coast, Queensland",
      tagline: "Quality homes, built around the way you live.",
      contactHeading: "Contact",
      contactEmail: "hello@goodbuildhomes.com.au",
      contactPhone: "Phone: 07 XXXX XXXX",
      contactAddress: "Sunshine Coast, Queensland",
      navHeading: "Navigation",
    },
    hero: { heroVariant: "split", backgroundColor: "#1c1a17", textColor: "#e7e1d7", headlineColor: "#ffffff", buttonColor: "#c8a97e", buttonTextColor: "#1c1a17" },
    ctaStyle: "split-banner",
    galleryVariant: "editorial-mosaic",
    testimonialVariant: "cards",
    pricingVariant: "clean",
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

function getVisualSystem(templateSlug) {
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

function cloneLinks(links = []) {
  return Array.isArray(links) ? links.map((link) => ({ ...link })) : [];
}

function buildFooterContactDetails(profile) {
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

function buildFooterDefaults(profile) {
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

function resolveFooterVariant(templateSlug = "") {
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

function buildFooterSpotlight(profile, pages = []) {
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

function collectDistinctImagePool(profile, preferred = []) {
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

function pickImageWindow(pool, start, count) {
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

function buildNav(profile, pages, system) {
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

function buildFooter(profile, pages, system) {
  const primaryNavLinks = pages
    .filter((page) => !["privacy", "terms"].includes(String(page?.slug || "")))
    .map((page) => ({
      label: page.title,
      href: page.slug === "home" ? "/" : `/${page.slug}`,
    }));
  const contactDetails = buildFooterContactDetails(profile);
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
    navigationLinks: primaryNavLinks,
    navHeading: system.footer.navHeading || "Navigate",
    extraHeading: system.footer.extraHeading || "Legal",
    extraLinks: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
    newsletterHeading: system.footer.newsletterHeading || footerDefaults.newsletterHeading,
    newsletterSubtitle: system.footer.newsletterSubtitle || footerDefaults.newsletterSubtitle,
    newsletterButtonText: system.footer.newsletterButtonText || "Subscribe",
    copyrightText: `© ${new Date().getFullYear()} ${profile.siteName}. All rights reserved.`,
  });
}

function buildHero(hero = {}, overrides = {}, system = TEMPLATE_VISUAL_SYSTEMS.default) {
  const hasEnableParallaxOverride = Object.prototype.hasOwnProperty.call(overrides, "enableParallax");

  return section("hero", {
    fullWidthBackground: overrides.fullWidthBackground ?? true,
    heroVariant: overrides.heroVariant || system.hero.heroVariant || "split",
    eyebrow: hero.eyebrow || "",
    headline: hero.title || "Your headline",
    subheadline: hero.subtitle || "Add supporting copy here.",
    ctaText: hero.primaryLabel || "Get Started",
    ctaLink: hero.primaryHref || "#contact",
    secondaryCtaText: hero.secondaryLabel || "",
    secondaryCtaLink: hero.secondaryHref || "",
    backgroundStyle: hero.imageUrl ? "image" : "gradient",
    backgroundImage: hero.imageUrl || "",
    backgroundPosition: overrides.backgroundPosition || hero.backgroundPosition || "center center",
    backgroundColor: overrides.backgroundColor || system.hero.backgroundColor || "#0f172a",
    minHeight: overrides.minHeight || "76vh",
    contentWidth: overrides.contentWidth || 760,
    contentHeight: overrides.contentHeight || 220,
    contentX: overrides.contentX,
    contentY: overrides.contentY,
    verticalAlign: overrides.verticalAlign,
    headlineAlignment: overrides.headlineAlignment,
    headlineFontSize: overrides.headlineFontSize || 72,
    subheadlineFontSize: overrides.subheadlineFontSize || 21,
    textColor: overrides.textColor || system.hero.textColor || "#e2e8f0",
    headlineColor: overrides.headlineColor || system.hero.headlineColor || "#ffffff",
    buttonColor: overrides.buttonColor || system.hero.buttonColor || "#22c55e",
    buttonTextColor: overrides.buttonTextColor || system.hero.buttonTextColor || "#081120",
    enableParallax: hasEnableParallaxOverride ? !!overrides.enableParallax : !!hero.imageUrl,
    sectionAnimation: overrides.sectionAnimation || "blur-in",
    sectionAnimationDelay: overrides.sectionAnimationDelay ?? 0,
    sectionAnimationSpeed: overrides.sectionAnimationSpeed || 1.05,
    textAnimation: overrides.textAnimation || "slide-up",
    textAnimationDelay: overrides.textAnimationDelay ?? 0.08,
    textAnimationSpeed: overrides.textAnimationSpeed || 0.95,
    subheadlineAnimation: overrides.subheadlineAnimation || "fade-up",
    subheadlineAnimationDelay: overrides.subheadlineAnimationDelay ?? 0.16,
    subheadlineAnimationSpeed: overrides.subheadlineAnimationSpeed || 1.05,
    contentBackground: overrides.contentBackground,
    contentPadding: overrides.contentPadding,
    floatingImage: overrides.floatingImage || "",
    floatingX: overrides.floatingX,
    floatingY: overrides.floatingY,
    floatingWidth: overrides.floatingWidth,
    floatingHeight: overrides.floatingHeight,
  });
}

function buildLegalHeroSection(profile, title, subtitle, system) {
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

function buildParallax(config = {}, system = TEMPLATE_VISUAL_SYSTEMS.default) {
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

function buildText(title, body, options = {}) {
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

function buildFeatureList(config = {}, options = {}) {
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

function buildDecorativeDivider(system = TEMPLATE_VISUAL_SYSTEMS.default, style = "dots") {
  return section("divider", {
    style,
    color: system.footer.linkColor || system.hero.buttonColor || "#94a3b8",
  });
}

function buildStats(config = {}) {
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

function buildGallery(config = {}, variant = "balanced-grid") {
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

function buildTestimonials(config = {}, variant = "cards") {
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

function buildPricing(config = {}, variant = "premium") {
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

function buildFaq(config = {}) {
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

function buildTrustBadges(labels = []) {
  return section("trust-badges", {
    sectionAnimation: "fade-up",
    sectionAnimationDelay: 0.02,
    badges: labels.map((label) => ({ icon: "✓", label })),
  });
}

function buildMarqueeStrip(items = [], options = {}) {
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

function buildShowcaseStack(config = {}) {
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

function getIndustryTrustBadges(profile) {
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

function getIndustryContactFields(profile) {
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

function buildColumns2(config = {}) {
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

function buildCta(config = {}, style = "spotlight-pill") {
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

function buildContact(config = {}, formFields = []) {
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

function buildPage(slug, title, objective, sections) {
  return {
    slug,
    title,
    objective,
    sections: sections.filter(Boolean),
  };
}

function buildTemplatePageHref(slug = "home") {
  return `?page=${encodeURIComponent(String(slug || "home"))}`;
}

function normalizeBlueprintHref(href, pageSlugs) {
  const raw = String(href || "").trim();
  if (!raw) return raw;
  if (raw.startsWith("#") || raw.startsWith("?page=") || /^[a-z]+:/i.test(raw)) return raw;
  if (raw === "/") return buildTemplatePageHref("home");

  const normalizedPath = raw.split("?")[0].split("#")[0].replace(/^\/+|\/+$/g, "").toLowerCase();
  if (!normalizedPath) return buildTemplatePageHref("home");
  if (pageSlugs.has(normalizedPath)) return buildTemplatePageHref(normalizedPath);

  return raw;
}

function normalizeBlueprintLinks(blueprint) {
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

function findPage(blueprint, slug) {
  return blueprint?.pages?.find((page) => page.slug === slug) || null;
}

function insertAfterSectionType(page, type, sections) {
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

function insertBeforeFooter(page, sections) {
  if (!page || !Array.isArray(page.sections)) return;
  const items = (Array.isArray(sections) ? sections : [sections]).filter(Boolean);
  if (!items.length) return;
  const footerIndex = page.sections.findIndex((entry) => entry?.type === "footer");
  page.sections.splice(footerIndex >= 0 ? footerIndex : page.sections.length, 0, ...items);
}

function updateContactFormFields(page, fields) {
  if (!page || !Array.isArray(page.sections)) return;
  const formSection = page.sections.find((entry) => entry?.type === "contact-form");
  if (formSection) {
    formSection.props = {
      ...formSection.props,
      fields,
    };
  }
}

function buildGenericPremiumBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  const imageProfile = attachTeamMemberImages(profile);
  const system = getVisualSystem(profile.templateSlug);
  const homePage = findPage(blueprint, "home");
  const aboutPage = findPage(blueprint, profile.about?.slug || "about");

  insertAfterSectionType(homePage, "hero", [
    buildParallax({
      title: "A production-quality starter should feel intentionally art-directed from the first scroll",
      subtitle: "This section adds pacing, visual authority, and a sense of premium depth before the proof and offer sections begin.",
      buttonLabel: "See capabilities",
      buttonHref: "/services",
      imageUrl: getProfileImage(imageProfile, 0, profile.home?.hero?.imageUrl || ""),
      floatingImage: getProfileImage(imageProfile, 1, profile.about?.imageUrl || profile.home?.hero?.imageUrl || ""),
      minHeight: "68vh",
      contentWidth: 600,
    }, system),
    section("image-stack", {
      title: "Brand Storyboard",
      minHeight: "66vh",
      images: [
        { id: "generic-stack-image-1", kind: "image", src: getProfileImage(imageProfile, 2, profile.home?.hero?.imageUrl || ""), x: 14, y: 12, width: 320, height: 220, rotation: -5, radius: 22, zIndex: 1 },
        { id: "generic-stack-text", kind: "text", content: profile.home?.hero?.subtitle || "Position the business with more polish, more hierarchy, and more believable depth.", x: 44, y: 34, width: 420, height: 160, rotation: 0, radius: 18, zIndex: 2, fontSize: 28, fontWeight: "700", textAlign: "left", verticalAlign: "center", textColor: "#0f172a", background: "rgba(255,255,255,0.92)" },
        { id: "generic-stack-image-2", kind: "image", src: getProfileImage(imageProfile, 3, profile.about?.imageUrl || profile.home?.hero?.imageUrl || ""), x: 68, y: 58, width: 280, height: 210, rotation: 6, radius: 22, zIndex: 3 },
      ],
    }),
  ]);

  insertBeforeFooter(aboutPage, buildColumns2({
    ratio: "50-50",
    leftTitle: "How this site should read",
    leftContent: "Confident, commercially clear, and well-structured enough to feel like an already-established business rather than a starter kit.",
    rightTitle: "What to customise first",
    rightContent: "Replace the proof, sharpen the positioning, and update the offer hierarchy before you touch visual polish. Better structure compounds faster than surface tweaks.",
    rightImage: getProfileImage(imageProfile, 4, profile.about?.imageUrl || profile.home?.hero?.imageUrl || ""),
    cardBackgroundColor: "#f8fafc",
  }));

  return blueprint;
}

function buildMedicalBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  const imageProfile = attachTeamMemberImages(profile);
  const system = getVisualSystem(profile.templateSlug);
  const homePage = findPage(blueprint, "home");
  const servicesPage = findPage(blueprint, profile.servicesPage?.slug || "services");
  const contactPage = findPage(blueprint, profile.contactPage?.slug || "contact");

  insertAfterSectionType(homePage, "hero", [
    buildTrustBadges(["Qualified practitioners", "Patient-first care", "Clear next steps", "Easy appointment flow"]),
    buildParallax({
      title: "Patients decide quickly whether a clinic feels safe, clear, and professionally run",
      subtitle: "This section slows the pace down and reinforces calm trust before service explanations and booking prompts appear.",
      buttonLabel: "View services",
      buttonHref: "/services",
      imageUrl: getProfileImage(imageProfile, 0, profile.home?.hero?.imageUrl || ""),
      floatingImage: getProfileImage(imageProfile, 1, profile.about?.imageUrl || profile.home?.hero?.imageUrl || ""),
      minHeight: "64vh",
      backgroundColor: "#dff4ff",
      buttonColor: system.hero.buttonColor,
      buttonTextColor: system.hero.buttonTextColor,
      headlineColor: system.hero.headlineColor,
      textColor: system.hero.textColor,
    }, system),
    buildColumns2({
      ratio: "50-50",
      leftTitle: "What new patients need to know first",
      leftContent: "Who the clinic helps, what happens at the first appointment, and how care is explained in plain language.",
      rightTitle: "What creates confidence",
      rightContent: "Qualified practitioners, clear communication, easier booking, and a site that removes uncertainty before the visit.",
      rightImage: getProfileImage(imageProfile, 2, profile.home?.hero?.imageUrl || profile.about?.imageUrl || ""),
      cardBackgroundColor: "#f0f9ff",
    }),
  ]);

  insertBeforeFooter(servicesPage, buildColumns2({
    ratio: "40-60",
    leftTitle: "Appointment pathway",
    leftContent: "Initial consultation, diagnosis or treatment planning, follow-up support, and clearer expectations around care.",
    rightTitle: "Use this page to reduce uncertainty",
    rightContent: "Patients should finish this page understanding which appointment to book, what to bring, and what kind of support the clinic provides.",
    cardBackgroundColor: "#f0f9ff",
  }));

  updateContactFormFields(contactPage, [
    { name: "name", label: "Full Name", type: "text", required: true, placeholder: "Jamie Smith" },
    { name: "email", label: "Email", type: "email", required: true, placeholder: "jamie@example.com" },
    { name: "phone", label: "Phone", type: "text", required: false, placeholder: "+61 ..." },
    { name: "appointmentType", label: "Appointment Type", type: "text", required: false, placeholder: "Initial consultation, follow-up, treatment" },
    { name: "availability", label: "Preferred Availability", type: "text", required: false, placeholder: "Morning, afternoons, specific dates" },
    { name: "notes", label: "Anything We Should Know", type: "textarea", required: false, placeholder: "Symptoms, referral details, or questions" },
  ]);

  return blueprint;
}

function buildLawBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  const imageProfile = attachTeamMemberImages(profile);
  const system = getVisualSystem(profile.templateSlug);
  const homePage = findPage(blueprint, "home");
  const aboutPage = findPage(blueprint, profile.about?.slug || "about");
  const contactPage = findPage(blueprint, profile.contactPage?.slug || "contact");

  if (homePage && Array.isArray(homePage.sections)) {
    homePage.sections = [
      homePage.sections[0],
      buildHero({
        ...(profile.home?.hero || {}),
        imageUrl: profile.home?.hero?.imageUrl || getProfileImage(imageProfile, 0, ""),
        floatingImage: "",
      }, {
        heroVariant: "split",
        minHeight: "94vh",
        backgroundColor: "#182131",
        buttonColor: system.hero.buttonColor,
        buttonTextColor: system.hero.buttonTextColor,
      }, system),
      buildMarqueeStrip([
        profile.home?.hero?.eyebrow || "Legal",
        "Family Law",
        "Commercial Advice",
        "Employment Matters",
        "Property Transactions",
        "Request Consultation",
      ], {
        backgroundColor: "#111827",
        textColor: "#f8fafc",
        accentColor: system.hero.buttonColor,
        speed: 22,
      }),
      buildTrustBadges(["Principal-led advice", "Confidential matters", "Clear legal pathway", "Consultation-first approach"]),
      buildStats(profile.home?.stats || {}),
      buildColumns2({
        ratio: "58-42",
        leftTitle: "What a prospect needs to understand quickly",
        leftContent: "Who the firm acts for, how matters are handled, what the first consultation looks like, and whether the team communicates with clarity instead of theatre.",
        rightTitle: "Why this homepage should feel different",
        rightContent: "A strong legal website should feel measured, senior, and easy to navigate. It should lower perceived risk before it asks for the enquiry.",
        rightImage: getProfileImage(imageProfile, 1, profile.about?.imageUrl || profile.home?.hero?.imageUrl || ""),
        cardBackgroundColor: "#f8fafc",
      }),
      buildFeatureList(profile.home?.services || {}, {
        featureVariant: "editorial-cards",
        layout: "columns",
        fallbackImage: getProfileImage(imageProfile, 2, profile.home?.hero?.imageUrl || ""),
        fallbackImages: [
          getProfileImage(imageProfile, 2, profile.home?.gallery?.images?.[0]?.src || ""),
          getProfileImage(imageProfile, 3, profile.home?.gallery?.images?.[1]?.src || ""),
          getProfileImage(imageProfile, 4, profile.home?.gallery?.images?.[2]?.src || ""),
        ],
      }),
      buildColumns2({
        ratio: "45-55",
        leftTitle: "What clients are really judging",
        leftContent: "Whether the firm feels calm under pressure, whether the advice sounds practical, and whether contacting the team will lead to a clear next step rather than a vague process.",
        rightTitle: "What this starter already gives you",
        rightContent: (profile.home?.features?.items || []).map((item) => `${item.title}: ${item.text}`).join("\n\n"),
        leftImage: getProfileImage(imageProfile, 3, profile.home?.gallery?.images?.[0]?.src || profile.home?.hero?.imageUrl || ""),
        cardBackgroundColor: "#f8fafc",
      }),
      profile.home?.gallery ? buildGallery(profile.home.gallery, system.galleryVariant || "balanced-grid") : null,
      profile.home?.testimonials ? buildTestimonials(profile.home.testimonials, "cards") : null,
      profile.home?.faq ? buildFaq(profile.home.faq) : null,
      buildCta(profile.home?.cta || {}, system.ctaStyle || "split-banner"),
      homePage.sections[homePage.sections.length - 1],
    ].filter(Boolean);
  }

  insertBeforeFooter(aboutPage, buildTrustBadges(["Principal-led matters", "Clear communication", "Measured strategy", "Confidential handling"]));

  updateContactFormFields(contactPage, [
    { name: "name", label: "Full Name", type: "text", required: true, placeholder: "Alex Morgan" },
    { name: "email", label: "Email", type: "email", required: true, placeholder: "alex@example.com" },
    { name: "phone", label: "Phone", type: "text", required: false, placeholder: "+61 ..." },
    { name: "matterType", label: "Matter Type", type: "text", required: false, placeholder: "Commercial, employment, private client" },
    { name: "urgency", label: "Urgency", type: "text", required: false, placeholder: "General advice, urgent, time-sensitive" },
    { name: "summary", label: "Brief Summary", type: "textarea", required: false, placeholder: "Share enough context for the firm to triage the enquiry" },
  ]);

  return blueprint;
}

function buildRealEstateBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  const imageProfile = attachTeamMemberImages(profile);
  const system = getVisualSystem(profile.templateSlug);
  const homePage = findPage(blueprint, "home");
  const resultsPage = findPage(blueprint, profile.proofPage?.slug || "results");
  const contactPage = findPage(blueprint, profile.contactPage?.slug || "contact");

  insertAfterSectionType(homePage, "hero", [
    buildParallax({
      title: "The strongest property sites sell the agent brand, the campaign engine, and the local market story all at once",
      subtitle: "This gives the homepage some premium movement before it transitions into listings, proof, and appraisal CTAs.",
      buttonLabel: "View listings",
      buttonHref: "/results",
      imageUrl: getProfileImage(imageProfile, 0, profile.proofPage?.gallery?.images?.[0]?.src || profile.home?.hero?.imageUrl || ""),
      floatingImage: getProfileImage(imageProfile, 1, profile.proofPage?.gallery?.images?.[1]?.src || profile.about?.imageUrl || ""),
      minHeight: "70vh",
      backgroundColor: "#183b56",
      buttonColor: system.hero.buttonColor,
      buttonTextColor: system.hero.buttonTextColor,
    }, system),
    section("image-stack", {
      title: "Campaign Showcase",
      minHeight: "78vh",
      images: [
        { id: "property-1", kind: "image", src: getProfileImage(imageProfile, 2, profile.proofPage?.gallery?.images?.[0]?.src || profile.home?.hero?.imageUrl || ""), x: 36, y: 42, width: 430, height: 300, rotation: -5, radius: 22, zIndex: 1 },
        { id: "property-text", kind: "text", content: "Use this section to frame prestige, market activity, and listing quality instead of relying on a generic brochure layout.", x: 420, y: 86, width: 500, height: 240, radius: 22, zIndex: 2, fontSize: 38, fontWeight: "700", textAlign: "left", verticalAlign: "center", textColor: "#0f172a", background: "rgba(255,255,255,0.95)" },
        { id: "property-2", kind: "image", src: getProfileImage(imageProfile, 3, profile.proofPage?.gallery?.images?.[2]?.src || profile.home?.hero?.imageUrl || ""), x: 760, y: 332, width: 360, height: 260, rotation: 6, radius: 22, zIndex: 3 },
      ],
    }),
  ]);

  insertBeforeFooter(resultsPage, buildColumns2({
    ratio: "50-50",
    leftTitle: "How to use this page well",
    leftContent: "Mix sold listings, campaign snapshots, suburb commentary, and appraisal prompts so the page supports both proof and prospecting.",
    rightTitle: "What vendors notice",
    rightContent: "Activity, polish, negotiation confidence, and visible local knowledge. The page should feel like a live market operator, not a static brand brochure.",
    cardBackgroundColor: "#eff6ff",
  }));

  updateContactFormFields(contactPage, [
    { name: "name", label: "Full Name", type: "text", required: true, placeholder: "Jordan Parker" },
    { name: "email", label: "Email", type: "email", required: true, placeholder: "jordan@example.com" },
    { name: "phone", label: "Phone", type: "text", required: false, placeholder: "+61 ..." },
    { name: "propertyType", label: "Property Type", type: "text", required: false, placeholder: "House, apartment, townhouse" },
    { name: "suburb", label: "Suburb", type: "text", required: false, placeholder: "Suburb or local area" },
    { name: "goal", label: "What Do You Need Help With?", type: "textarea", required: false, placeholder: "Appraisal, selling advice, buyer support, or project marketing" },
  ]);

  return blueprint;
}

function buildSalonSpaBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  const imageProfile = attachTeamMemberImages(profile);
  const system = getVisualSystem(profile.templateSlug);
  const homePage = findPage(blueprint, "home");
  const servicesPage = findPage(blueprint, profile.servicesPage?.slug || "services");
  const contactPage = findPage(blueprint, profile.contactPage?.slug || "contact");

  insertAfterSectionType(homePage, "hero", [
    buildParallax({
      title: "Beauty and wellness sites need atmosphere, softness, and trust before the booking prompt lands",
      subtitle: "This gives the starter more sensory pacing so it feels like a premium studio brand, not a card grid with a logo.",
      buttonLabel: "View treatments",
      buttonHref: "/services",
      imageUrl: getProfileImage(imageProfile, 0, profile.home?.gallery?.images?.[0]?.src || profile.home?.hero?.imageUrl || ""),
      floatingImage: getProfileImage(imageProfile, 1, profile.home?.gallery?.images?.[1]?.src || profile.about?.imageUrl || ""),
      minHeight: "72vh",
      backgroundColor: "#fff4f0",
      buttonColor: system.hero.buttonColor,
      buttonTextColor: system.hero.buttonTextColor,
    }, system),
    buildColumns2({
      ratio: "40-60",
      leftTitle: "What the studio should communicate",
      leftContent: "Premium care, calming detail, and a treatment experience that feels personal from the first click.",
      rightTitle: "What should convert the visitor",
      rightContent: "Clear treatment groupings, visual atmosphere, trust-building reviews, and a booking page that captures enough detail to respond well.",
      rightImage: getProfileImage(imageProfile, 2, profile.home?.gallery?.images?.[2]?.src || profile.home?.hero?.imageUrl || ""),
      cardBackgroundColor: "#fff7f7",
    }),
  ]);

  insertBeforeFooter(servicesPage, buildTrustBadges(["Qualified team", "Premium client care", "Tailored treatment plans", "Booking-friendly flow"]));

  updateContactFormFields(contactPage, [
    { name: "name", label: "Full Name", type: "text", required: true, placeholder: "Taylor West" },
    { name: "email", label: "Email", type: "email", required: true, placeholder: "taylor@example.com" },
    { name: "phone", label: "Phone", type: "text", required: false, placeholder: "+61 ..." },
    { name: "treatmentInterest", label: "Treatment Interest", type: "text", required: false, placeholder: "Skin, brows, beauty, packages" },
    { name: "preferredDate", label: "Preferred Date or Time", type: "text", required: false, placeholder: "Best day or time" },
    { name: "notes", label: "Anything We Should Know", type: "textarea", required: false, placeholder: "Skin concerns, event date, or treatment goals" },
  ]);

  return blueprint;
}

function buildFitnessBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  const imageProfile = attachTeamMemberImages(profile);
  const system = getVisualSystem(profile.templateSlug);
  const homePage = findPage(blueprint, "home");
  const servicesPage = findPage(blueprint, profile.servicesPage?.slug || "services");
  const contactPage = findPage(blueprint, profile.contactPage?.slug || "contact");

  insertAfterSectionType(homePage, "hero", [
    buildParallax({
      title: "Fitness brands need motion, intensity, and a real sense of culture, not just generic motivational copy",
      subtitle: "This section helps the site feel like a live training environment with momentum and identity.",
      buttonLabel: "View programs",
      buttonHref: "/services",
      imageUrl: getProfileImage(imageProfile, 0, profile.home?.hero?.imageUrl || ""),
      floatingImage: getProfileImage(imageProfile, 1, profile.about?.imageUrl || profile.home?.hero?.imageUrl || ""),
      minHeight: "70vh",
      backgroundColor: "#151c2f",
      buttonColor: system.hero.buttonColor,
      buttonTextColor: system.hero.buttonTextColor,
    }, system),
    buildColumns2({
      ratio: "50-50",
      leftTitle: "What drives conversion here",
      leftContent: "A clear training promise, visible coaching quality, community proof, and an easy first step like a trial or intro consult.",
      rightTitle: "What the site should feel like",
      rightContent: "Confident, energetic, disciplined, and outcome-focused without turning into cliché hype.",
      rightImage: getProfileImage(imageProfile, 2, profile.home?.hero?.imageUrl || profile.about?.imageUrl || ""),
      cardBackgroundColor: "#fef2f2",
    }),
  ]);

  insertBeforeFooter(servicesPage, buildTrustBadges(["Coaching-led", "Beginner friendly", "Visible progress", "Strong member culture"]));

  updateContactFormFields(contactPage, [
    { name: "name", label: "Full Name", type: "text", required: true, placeholder: "Jordan Blake" },
    { name: "email", label: "Email", type: "email", required: true, placeholder: "jordan@example.com" },
    { name: "phone", label: "Phone", type: "text", required: false, placeholder: "+61 ..." },
    { name: "goal", label: "Primary Goal", type: "text", required: false, placeholder: "Strength, fat loss, energy, confidence" },
    { name: "experience", label: "Training Experience", type: "text", required: false, placeholder: "Beginner, returning, experienced" },
    { name: "availability", label: "Preferred Times", type: "textarea", required: false, placeholder: "Best days, times, or program preference" },
  ]);

  return blueprint;
}

const unsplashImage = (id, width = 1600) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=80`;

// Every image below is residential and was checked to load. No commercial sites, towers or
// high-rise imagery; portraits are only used for the team section.
const RESIDENTIAL_BUILDER_IMAGES = {
  hero: unsplashImage("1600596542815-ffad4c1539a9", 2000),
  heroAlt: "/assets/builders/standard-inclusions-hero.jpg",
  gumTreeHome: unsplashImage("1600607688969-a5bfcd646154"),
  duskArchitectural: unsplashImage("1600585154340-be6161a56a0c"),
  newHomeStreet: unsplashImage("1600047509358-9dc75507daeb"),
  rebuiltHome: unsplashImage("1600563438938-a9a27216b4f5"),
  queenslanderExtension: unsplashImage("1564013799919-ab600027ffc6"),
  indoorOutdoorExtension: unsplashImage("1604014237800-1c9102c219da"),
  coastalPoolHome: unsplashImage("1613977257363-707ba9348227"),
  timberBlackHome: unsplashImage("1600566753190-17f0baa2a6c3"),
  pavilionHome: unsplashImage("1580587771525-78b9dba3b914"),
  secondStorey: unsplashImage("1600585154363-67eb9e2e2099"),
  singleLevelHome: unsplashImage("1628744448840-55bdb2497bd4"),
  whiteModernPool: unsplashImage("1613490493576-7fde63acd811"),
  palmPoolHome: unsplashImage("1512917774080-9991f1c4c750"),
  duskLawnHome: unsplashImage("1600585153490-76fb20a32601"),
  stairsPoolView: unsplashImage("1600573472550-8090b5e0745e"),
  livingOpen: unsplashImage("1600607687939-ce8a6c25118c"),
  livingBright: unsplashImage("1600585154084-4e5fe7c39198"),
  livingArched: unsplashImage("1600210491892-03d54c0aaf87"),
  kitchenIsland: unsplashImage("1600585152220-90363fe7e115"),
  kitchenPremier: "/assets/builders/standard-inclusions-premier-kitchen.jpg",
  kitchenGalley: "/assets/builders/standard-inclusions-kitchen-black-white.webp",
  livingPremier: "/assets/builders/standard-inclusions-premier-living.jpg",
  familyKitchen: "/assets/builders/standard-inclusions-family-kitchen.jpg",
  bathroom: unsplashImage("1600566752355-35792bedcfea"),
  ensuite: unsplashImage("1600607688066-890987f18a86"),
  bedroom: unsplashImage("1600607687644-c7171b42498f"),
  finishedRoom: unsplashImage("1581858726788-75bc0f6a952d"),
  consultation: unsplashImage("1551836022-d5d88e9218df"),
  planning: unsplashImage("1503387762-592deb58ef4e"),
  documentation: unsplashImage("1503387837-b154d5074bd2"),
  contract: unsplashImage("1450101499163-c8848c66ca85"),
  carpentry: unsplashImage("1589939705384-5185137a7f0f"),
  handoverKeys: unsplashImage("1560518883-ce09059eeffa"),
};

// Neutral, light-background business headshots with a consistent crop.
const RESIDENTIAL_BUILDER_TEAM = [
  { name: "David Reynolds", role: "Director / Builder", bio: "Leads every project from first consultation to handover and is the licensed builder accountable for your home on site.", image: unsplashImage("1472099645785-5658abf4ff4e", 900), imageX: 50, imageY: 22 },
  { name: "Emma Chen", role: "Design & Client Selections", bio: "Guides clients through plans, finishes and fixtures, keeping every selection documented, priced and on programme.", image: unsplashImage("1573497019236-17f8177b81e8", 900), imageX: 50, imageY: 24 },
  { name: "Michael Carter", role: "Construction Manager", bio: "Runs the site day to day, coordinates trades and inspections, and walks clients through each stage of the build.", image: unsplashImage("1557862921-37829c790f19", 900), imageX: 50, imageY: 20 },
];

const RESIDENTIAL_BUILDER_PALETTE = {
  ink: "#1c1a17",
  charcoal: "#262320",
  stone: "#f5f1ea",
  sand: "#ebe4d8",
  bronze: "#c8a97e",
  body: "#3f3a33",
  muted: "#6b6358",
  line: "rgba(28,26,23,0.12)",
};

const RESIDENTIAL_BUILDER_SERVICE_AREAS = ["Sunshine Coast", "Brisbane", "Moreton Bay", "Gold Coast"];

const RESIDENTIAL_BUILDER_SERVICES = [
  {
    slug: "custom-homes",
    title: "Custom Homes",
    summary: "Architectural homes designed around your block, your brief and the way your family lives.",
    detail: "Every custom home starts with the site: orientation, slope, breezes, views, wind classification and council requirements. We work alongside your architect or our design partners to resolve buildability early, price the design honestly and protect the design intent through every stage of construction.\n\nYou deal directly with the builder who quoted your home, with a construction manager running the site and regular walkthroughs so you can see the detail taking shape.",
    points: ["Architect and designer collaboration", "Sloping, coastal and acreage sites", "Premium facades, joinery and detailing", "Fixed-price contract with clear allowances"],
    image: RESIDENTIAL_BUILDER_IMAGES.duskArchitectural,
  },
  {
    slug: "new-homes",
    title: "New Homes",
    summary: "Well-planned new homes with the quality of a custom build and a clear inclusions schedule.",
    detail: "Our new home pathway pairs adaptable floor plans with a detailed inclusions schedule, so you know exactly what is included before you sign. Plans are tailored to your block and family, energy efficiency is designed in from the start, and the home is built for the Queensland climate, with shade, cross-ventilation and outdoor living considered from day one.\n\nThe same trades and site team who deliver our custom homes build every new home.",
    points: ["Plans tailored to your block", "Transparent inclusions schedule", "Designed for the Queensland climate", "Clear, staged build timeline"],
    image: RESIDENTIAL_BUILDER_IMAGES.newHomeStreet,
  },
  {
    slug: "renovations-extensions",
    title: "Renovations & Extensions",
    summary: "Extensions, raise-and-builds and full renovations that feel like they were always part of the home.",
    detail: "Adding to an existing home takes more care than building new. We investigate the structure, services and any character constraints before we quote, plan the staging around how your family lives, and match new work to the old so the join disappears.\n\nFrom a rear living pavilion to a second storey or a renovated Queenslander, the goal is a home that works better without losing what you loved about it.",
    points: ["Ground-floor and second-storey additions", "Queenslanders and character homes", "Structural and layout changes", "Staged works where you can stay on site"],
    image: RESIDENTIAL_BUILDER_IMAGES.indoorOutdoorExtension,
  },
  {
    slug: "knockdown-rebuilds",
    title: "Knockdown Rebuilds",
    summary: "Stay in the street you love and start again with a home designed for the next twenty years.",
    detail: "A knockdown rebuild can be the most practical way to get the home you want in the location you already love. We manage the full sequence: feasibility, site assessment, service disconnections, demolition, approvals, site preparation and construction.\n\nYou get one team, one contract and one timeline from the old house to handover, with clear advice early on whether renovating or rebuilding is the better investment for your site.",
    points: ["Feasibility and site assessment", "Demolition and disconnections managed", "Approvals coordinated with your certifier", "One contract from demolition to handover"],
    image: RESIDENTIAL_BUILDER_IMAGES.rebuiltHome,
  },
];

const RESIDENTIAL_BUILDER_PROJECTS = [
  { title: "The Headland Residence", type: "Custom Home", location: "Noosa Heads, QLD", image: RESIDENTIAL_BUILDER_IMAGES.coastalPoolHome, description: "A coastal custom home with deep eaves, a north-facing pool terrace and living zones that open to the sea breeze." },
  { title: "Glasshouse View House", type: "Knockdown Rebuild", location: "Buderim, QLD", image: RESIDENTIAL_BUILDER_IMAGES.timberBlackHome, description: "A tired 1970s home replaced with a two-storey family residence framed around hinterland views." },
  { title: "Riverside Queenslander", type: "Renovation & Extension", location: "New Farm, Brisbane", image: RESIDENTIAL_BUILDER_IMAGES.queenslanderExtension, description: "A character Queenslander restored at the front, with a contemporary rear extension and pool courtyard." },
  { title: "Pavilion House", type: "New Home", location: "Caloundra, QLD", image: RESIDENTIAL_BUILDER_IMAGES.pavilionHome, description: "A new family home planned around a central pool, with separate living and sleeping pavilions." },
  { title: "Parkside Second Storey", type: "Renovation & Extension", location: "Maroochydore, QLD", image: RESIDENTIAL_BUILDER_IMAGES.secondStorey, description: "A second-storey addition with a parents' retreat, staged so the family could remain living downstairs." },
  { title: "Hinterland Residence", type: "Custom Home", location: "Samford, Moreton Bay", image: RESIDENTIAL_BUILDER_IMAGES.singleLevelHome, description: "A single-level acreage home with raked ceilings, timber cladding and wide covered outdoor living." },
];

const RESIDENTIAL_BUILDER_PROCESS = [
  {
    number: "01",
    title: "Initial Consultation",
    summary: "We meet on site or in our office to understand your brief, block, budget and timing.",
    client: "You share your ideas, your block details and a realistic budget range. There is no obligation, and no pressure to commit.",
    builder: "We give you an honest view of what is achievable, flag any site constraints we can see early, and recommend the right pathway: custom home, new home, renovation or knockdown rebuild.",
    image: RESIDENTIAL_BUILDER_IMAGES.consultation,
  },
  {
    number: "02",
    title: "Site & Design",
    summary: "Survey, soil testing and design development, with buildability and cost checked as the design evolves.",
    client: "You work through concept plans with your architect or our design partners and see how the home sits on your block.",
    builder: "We arrange the survey and soil test, review wind classification, slope and stormwater, and give cost feedback at each design stage so the plans stay aligned with your budget.",
    image: RESIDENTIAL_BUILDER_IMAGES.planning,
  },
  {
    number: "03",
    title: "Selections & Documentation",
    summary: "Guided selections for finishes, fixtures and joinery, then engineering, specifications and approvals.",
    client: "You choose finishes, fixtures, cabinetry and colours with guidance, rather than being left to work it out alone.",
    builder: "We document every selection, coordinate engineering and energy efficiency requirements, and prepare the drawings and specifications needed for approval through your building certifier.",
    image: RESIDENTIAL_BUILDER_IMAGES.kitchenGalley,
  },
  {
    number: "04",
    title: "Quotation & Contract",
    summary: "A detailed, itemised quotation with clear allowances, followed by a fixed-price contract.",
    client: "You receive a line-by-line quotation, walk through it with us, and can ask questions before anything is signed.",
    builder: "We explain every allowance and exclusion, confirm the progress payment schedule, and issue a fixed-price contract. QBCC Home Warranty Scheme cover applies to eligible residential work.",
    image: RESIDENTIAL_BUILDER_IMAGES.contract,
  },
  {
    number: "05",
    title: "Construction",
    summary: "A dedicated construction manager coordinates trades, programme and site safety.",
    client: "You receive regular progress updates and scheduled site walks at key stages, so you always know where your build is at.",
    builder: "We manage trades, deliveries, inspections and site safety, keep the site tidy and secure, and document and price any variation in writing before work proceeds.",
    image: RESIDENTIAL_BUILDER_IMAGES.carpentry,
  },
  {
    number: "06",
    title: "Quality Checks",
    summary: "Certifier inspections at key stages, plus our own detailed quality reviews.",
    client: "You see the work at frame, lock-up and fit-off stages, with the chance to raise anything before it is covered up.",
    builder: "Alongside the mandatory certifier inspections, we run our own checklists for waterproofing, alignment, finishes and detailing, and fix issues before a stage is signed off.",
    image: RESIDENTIAL_BUILDER_IMAGES.finishedRoom,
  },
  {
    number: "07",
    title: "Handover",
    summary: "A full walkthrough, final documentation, warranties and support after you move in.",
    client: "You walk through the finished home with us, learn how everything works, and receive the keys once the final inspection is complete.",
    builder: "We provide the certifier's final inspection documentation, product warranties and a maintenance guide, and stay available through the maintenance period to look after anything that needs attention.",
    image: RESIDENTIAL_BUILDER_IMAGES.handoverKeys,
  },
];

// SAMPLE CONTENT: these reviews are illustrative demo copy for the template, not real client
// reviews. The template marks them with `isSampleContent` so they can be replaced before launch.
const RESIDENTIAL_BUILDER_SAMPLE_TESTIMONIALS = [
  { quote: "From the first site meeting we knew exactly what was included and what it would cost. Every variation was priced in writing before it happened, and the finished home is better than the plans.", name: "Sarah & James", role: "Custom Home · Noosa Heads", avatarUrl: RESIDENTIAL_BUILDER_IMAGES.coastalPoolHome },
  { quote: "We stayed living downstairs while the second storey went on. The team planned every noisy stage around us and kept the site clean at the end of each day.", name: "The Nguyen family", role: "Renovation & Extension · Maroochydore", avatarUrl: RESIDENTIAL_BUILDER_IMAGES.secondStorey },
  { quote: "Knocking down felt like a big step, but they talked us through the feasibility honestly and managed demolition, approvals and the build as one job.", name: "Mark & Olivia", role: "Knockdown Rebuild · Buderim", avatarUrl: RESIDENTIAL_BUILDER_IMAGES.timberBlackHome },
  { quote: "The selections process was the part we were most worried about. Emma had samples ready, kept every choice documented and made sure nothing was missed.", name: "Priya & Daniel", role: "New Home · Caloundra", avatarUrl: RESIDENTIAL_BUILDER_IMAGES.pavilionHome },
  { quote: "Our Queenslander needed care, not just a new extension. The new work matches the old house so well that visitors ask which part is original.", name: "Helen & Robert", role: "Renovation & Extension · New Farm", avatarUrl: RESIDENTIAL_BUILDER_IMAGES.queenslanderExtension },
  { quote: "Weekly updates, straight answers and a builder who actually picked up the phone. Handover was thorough, and they came back promptly for the few small items we found.", name: "Tom & Jess", role: "Custom Home · Samford", avatarUrl: RESIDENTIAL_BUILDER_IMAGES.singleLevelHome },
];

function buildResidentialInnerHero(config, system) {
  return buildHero(
    {
      eyebrow: config.eyebrow,
      title: config.title,
      subtitle: config.subtitle,
      primaryLabel: config.primaryLabel || "Book a Consultation",
      primaryHref: config.primaryHref || "/contact",
      secondaryLabel: config.secondaryLabel || "",
      secondaryHref: config.secondaryHref || "",
      imageUrl: config.imageUrl,
    },
    {
      heroVariant: "split",
      minHeight: "64vh",
      headlineFontSize: 50,
      subheadlineFontSize: 19,
      contentWidth: 700,
      contentX: 30,
      contentBackground: "linear-gradient(160deg, rgba(20,18,15,0.78), rgba(20,18,15,0.56))",
      contentPadding: "40px 44px",
      backgroundColor: system.hero.backgroundColor,
      textColor: system.hero.textColor,
      headlineColor: system.hero.headlineColor,
      buttonColor: system.hero.buttonColor,
      buttonTextColor: system.hero.buttonTextColor,
      floatingImage: "",
      enableParallax: false,
      // Internal pages: restrained reveal, no blur or parallax.
      sectionAnimation: "fade-in",
      sectionAnimationSpeed: 0.9,
      textAnimation: "fade-up",
      textAnimationDelay: 0.05,
      subheadlineAnimation: "fade-in",
      subheadlineAnimationDelay: 0.14,
    },
    system
  );
}

function buildResidentialIntro(title, body, options = {}) {
  return section("text", {
    text: `<strong>${title}</strong><br/><br/>${body}`,
    alignment: options.alignment || "left",
    backgroundColor: options.backgroundColor || RESIDENTIAL_BUILDER_PALETTE.stone,
    textColor: options.textColor || RESIDENTIAL_BUILDER_PALETTE.ink,
    textFontSize: options.textFontSize || 20,
    minHeight: options.minHeight || "auto",
    sectionAnimation: options.sectionAnimation || "none",
    sectionAnimationDelay: 0.04,
  });
}

function withResidentialProps(block, patch = {}) {
  return { ...block, props: { ...block.props, ...patch } };
}

function buildResidentialColumns(config = {}) {
  const block = buildColumns2(config);
  return {
    ...block,
    props: {
      ...block.props,
      sectionAnimation: config.sectionAnimation || "none",
      sectionAnimationDelay: config.sectionAnimationDelay ?? 0.04,
    },
  };
}

// Standard image-on-top card grid (not the services tile variant, whose style preset hides
// card images). Items must not all carry image + link + eyebrow, or the renderer auto-detects
// the services variant.
function buildResidentialCardGrid(items, options = {}) {
  const dark = !!options.dark;
  const palette = RESIDENTIAL_BUILDER_PALETTE;
  return section("grid-section", {
    gridVariant: "cards",
    // Wide enough for a true four-column desktop grid; matches the column sections.
    blockMaxWidth: 1440,
    title: options.title || "",
    columns: options.columns || 3,
    // Four-up grids become a balanced 2 x 2 on tablet; mobile always stacks.
    columnsTablet: (options.columns || 3) === 4 ? 2 : (options.columns || 3),
    backgroundColor: options.backgroundColor || (dark ? palette.ink : palette.stone),
    sectionTitleColor: dark ? "#f5f1ea" : palette.ink,
    sectionTitleSize: options.sectionTitleSize || 34,
    columnBackgroundColor: options.cardBackgroundColor || (dark ? palette.charcoal : "#ffffff"),
    columnTitleColor: dark ? "#f5f1ea" : palette.ink,
    columnBodyColor: dark ? "rgba(245,241,234,0.78)" : palette.body,
    eyebrowColor: palette.bronze,
    eyebrowFontSize: 13,
    cardTitleSize: options.cardTitleSize || 23,
    columnBorderColor: dark ? "rgba(200,169,126,0.18)" : palette.line,
    columnRadius: 18,
    columnPadding: options.columnPadding ?? 22,
    columnShadow: dark ? "none" : "soft",
    columnGap: 24,
    rowGap: 24,
    columnsVerticalAlign: "stretch",
    imageRadius: 12,
    cardAnimation: options.cardAnimation || "fade-up",
    cardAnimationStagger: options.cardAnimationStagger ?? 0.08,
    cardAnimationSpeed: 0.85,
    iconAnimation: "none",
    imageAnimation: "none",
    titleAnimation: "none",
    bodyAnimation: "none",
    sectionAnimation: "none",
    items: items.map((item) => ({
      ...(item.eyebrow ? { eyebrow: item.eyebrow } : {}),
      title: item.title,
      content: item.content || "",
      ...(item.image ? { image: item.image, imageAlt: item.imageAlt || item.title, imageHeight: options.imageHeight || 240 } : {}),
      ...(item.link ? { link: item.link } : {}),
    })),
  });
}

function buildResidentialProjectGrid(projects, options = {}) {
  return buildResidentialCardGrid(
    projects.map((project) => ({
      eyebrow: `${project.type} · ${project.location}`,
      title: project.title,
      content: project.description,
      image: project.image,
      imageAlt: `${project.title}, ${project.type} in ${project.location}`,
    })),
    {
      title: options.title || "Featured projects",
      columns: 3,
      imageHeight: options.imageHeight || 300,
      dark: true,
      backgroundColor: options.backgroundColor,
    }
  );
}

function buildResidentialTestimonials(items, options = {}) {
  const palette = RESIDENTIAL_BUILDER_PALETTE;
  return section("testimonial", {
    title: options.title || "What our clients say",
    testimonialVariant: "cards",
    columns: 3,
    testimonialColumns: 3,
    backgroundColor: options.backgroundColor || palette.sand,
    headlineColor: palette.ink,
    textColor: palette.ink,
    cardBackgroundColor: "#ffffff",
    borderColor: palette.line,
    accentColor: palette.bronze,
    sectionAnimation: options.sectionAnimation || "none",
    // Demo reviews: flagged so they are replaced with genuine client reviews before launch.
    isSampleContent: true,
    sampleContentNote: "Sample testimonials for demonstration. Replace with genuine, permission-approved client reviews before publishing.",
    items: items.map((item) => ({
      text: item.quote || item.text,
      author: item.name || item.author,
      role: item.role,
      rating: item.rating || 5,
      avatarUrl: item.avatarUrl || "",
    })),
  });
}

function buildResidentialFinalCta(profile, overrides = {}) {
  return section("cta-button", {
    eyebrow: overrides.eyebrow || "START WITH A CONVERSATION",
    title: overrides.title || profile.home?.cta?.title || "Ready to talk about your build?",
    description: overrides.description || profile.home?.cta?.subtitle || "Book a no-obligation consultation. Bring your block details, plans or ideas, and we will give you honest advice on design, budget and timing.",
    text: overrides.buttonLabel || "Book a Consultation",
    link: "/contact",
    note: overrides.note || "QBCC Licensed Builder · Fixed-price contracts · Sunshine Coast, Brisbane, Moreton Bay & Gold Coast",
    style: "split-banner",
    backgroundColor: RESIDENTIAL_BUILDER_PALETTE.charcoal,
    textColor: "#f5f1ea",
    buttonColor: RESIDENTIAL_BUILDER_PALETTE.bronze,
    buttonTextColor: RESIDENTIAL_BUILDER_PALETTE.ink,
    sectionAnimation: overrides.sectionAnimation || "fade-up",
    sectionAnimationDelay: 0.04,
  });
}

function buildResidentialFooter(siteName, pages, services) {
  const palette = RESIDENTIAL_BUILDER_PALETTE;
  // Explicit slugs keep footer links matched to their pages after hrefs become `?page=` links.
  const pageLink = (label, slug) => ({ label, slug, href: slug === "home" ? "/" : `/${slug}` });
  const navLinks = pages
    .filter((page) => !["privacy", "terms"].includes(page.slug))
    .map((page) => pageLink(page.title, page.slug));

  return section("footer", {
    backgroundColor: "#151310",
    textColor: "#f5f1ea",
    linkColor: palette.bronze,
    borderColor: "rgba(200,169,126,0.2)",
    newsletterButtonColor: palette.bronze,
    newsletterButtonTextColor: palette.ink,
    showNewsletter: false,
    footerVariant: "service-grid",
    brand: siteName,
    logo: "/assets/builders/goodbuild-logo.png",
    logoWidth: 190,
    logoWidthTablet: 170,
    logoWidthMobile: 150,
    footerEyebrow: "QBCC Licensed Builder · Sunshine Coast, Queensland",
    tagline: "Quality homes, built around the way you live.",
    contactHeading: "Contact",
    contactAddress: "Sunshine Coast, Queensland",
    contactPhone: "Phone: 07 XXXX XXXX",
    contactEmail: "hello@goodbuildhomes.com.au",
    navigationLinks: navLinks,
    linkGroups: [
      { heading: "Navigation", role: "navigation", links: navLinks },
      { heading: "Services", links: services.map((service) => pageLink(service.title, "services")) },
      { heading: "Service areas", links: RESIDENTIAL_BUILDER_SERVICE_AREAS.map((area) => pageLink(area, "contact")) },
      {
        heading: "Book a consultation",
        links: [
          pageLink("Book a Consultation", "contact"),
          pageLink("How we build", "process"),
          pageLink("View our projects", "projects"),
        ],
      },
    ],
    extraLinks: [
      pageLink("Privacy Policy", "privacy"),
      pageLink("Terms", "terms"),
    ],
    copyrightText: `© ${new Date().getFullYear()} ${siteName}. All rights reserved.`,
    sectionAnimation: "none",
  });
}

function buildResidentialHomeBuilderBlueprint(profile) {
  const hydratedProfile = attachTeamMemberImages(profile);
  const system = getVisualSystem(hydratedProfile.templateSlug);
  const palette = RESIDENTIAL_BUILDER_PALETTE;
  const images = RESIDENTIAL_BUILDER_IMAGES;
  const siteName = hydratedProfile.siteName || "GoodBuild Homes";
  const home = hydratedProfile.home || {};
  const about = hydratedProfile.about || {};
  const services = Array.isArray(hydratedProfile.residentialServices) && hydratedProfile.residentialServices.length
    ? hydratedProfile.residentialServices
    : RESIDENTIAL_BUILDER_SERVICES;
  const projects = Array.isArray(hydratedProfile.projects?.items) && hydratedProfile.projects.items.length
    ? hydratedProfile.projects.items
    : RESIDENTIAL_BUILDER_PROJECTS;
  const processSteps = Array.isArray(hydratedProfile.process?.steps) && hydratedProfile.process.steps.length
    ? hydratedProfile.process.steps
    : RESIDENTIAL_BUILDER_PROCESS;
  const testimonials = Array.isArray(hydratedProfile.testimonials?.items) && hydratedProfile.testimonials.items.length
    ? hydratedProfile.testimonials.items
    : RESIDENTIAL_BUILDER_SAMPLE_TESTIMONIALS;
  const teamMembers = about.team?.members?.length ? about.team.members : RESIDENTIAL_BUILDER_TEAM;

  const pages = [
    { slug: "home", title: "Home" },
    { slug: "about", title: "About Us" },
    { slug: "services", title: "Our Services" },
    { slug: "projects", title: "Our Projects" },
    { slug: "process", title: "Our Process" },
    { slug: "testimonials", title: "Testimonials" },
    { slug: "contact", title: "Contact" },
    { slug: "privacy", title: "Privacy Policy" },
    { slug: "terms", title: "Terms of Service" },
  ];
  const navProfile = { ...hydratedProfile, siteName, navCtaLabel: "Book a Consultation", navCtaHref: "/contact" };
  const navBlock = buildNav(navProfile, pages, system);
  const nav = {
    ...navBlock,
    props: {
      ...navBlock.props,
      logo: "/assets/builders/goodbuild-logo.png",
      logoWidth: 66,
      logoWidthTablet: 60,
      logoWidthMobile: 54,
    },
  };
  const footer = buildResidentialFooter(siteName, pages, services);

  const credentials = buildMarqueeStrip(
    ["QBCC Licensed Builder", "Licensed & fully insured", "Fixed-price contracts", "QBCC Home Warranty Scheme cover", "Certifier stage inspections", "Dedicated construction manager", "Sunshine Coast · Brisbane · Moreton Bay · Gold Coast"],
    { backgroundColor: palette.charcoal, textColor: "#e7e1d7", accentColor: palette.bronze, speed: 38, sectionAnimation: "fade-in" }
  );

  const homeHero = buildHero(
    {
      eyebrow: home.hero?.eyebrow || "QUEENSLAND RESIDENTIAL BUILDER",
      title: home.hero?.title || "Quality homes, built around the way you live",
      subtitle: home.hero?.subtitle || "Custom homes, new homes, renovations and knockdown rebuilds across South East Queensland, delivered with fixed-price contracts and a builder who stays involved from first meeting to handover.",
      primaryLabel: "Book a Consultation",
      primaryHref: "/contact",
      secondaryLabel: "View Our Projects",
      secondaryHref: "/projects",
      imageUrl: images.hero,
    },
    {
      heroVariant: "split",
      minHeight: "92vh",
      headlineFontSize: 62,
      subheadlineFontSize: 19,
      contentWidth: 760,
      contentX: 31,
      contentBackground: "linear-gradient(160deg, rgba(20,18,15,0.74), rgba(20,18,15,0.5))",
      contentPadding: "48px 52px",
      backgroundColor: system.hero.backgroundColor,
      textColor: system.hero.textColor,
      headlineColor: system.hero.headlineColor,
      buttonColor: system.hero.buttonColor,
      buttonTextColor: system.hero.buttonTextColor,
      floatingImage: "",
      enableParallax: true,
      // Flagship moment: the strongest motion on the whole site lives here only.
      sectionAnimation: "blur-in",
      sectionAnimationSpeed: 1.15,
      textAnimation: "slide-up",
      textAnimationDelay: 0.12,
      textAnimationSpeed: 1.05,
      subheadlineAnimation: "fade-up",
      subheadlineAnimationDelay: 0.3,
      subheadlineAnimationSpeed: 1.1,
    },
    system
  );

  const whyBuildWithUs = buildResidentialCardGrid(
    [
      { title: "Personal service", content: "The builder who quotes your home stays accountable for it on site. You deal with the same small team from first meeting to handover.", image: images.consultation },
      { title: "Transparent pricing", content: "Itemised quotations, realistic allowances and variations priced in writing before work proceeds. You know the cost before you commit.", image: images.contract },
      { title: "Quality craftsmanship", content: "Detail is decided on site: junctions, waterproofing, joinery and finishes. We check the work before anyone else has to.", image: images.kitchenIsland },
      { title: "Experienced trades", content: "Carpenters, concreters, tilers and finishers we have worked with for years, chosen for the quality of their work, not the lowest price.", image: images.carpentry },
    ],
    { title: "Why build with us", columns: 4, imageHeight: 220, backgroundColor: palette.stone }
  );

  const homeProcessGrid = buildResidentialCardGrid(
    processSteps.slice(0, 6).map((step) => ({ eyebrow: `Step ${step.number}`, title: step.title, content: step.summary || step.body })),
    { title: "How we build", columns: 3, backgroundColor: "#ffffff", cardBackgroundColor: palette.stone, columnPadding: 28, cardTitleSize: 24 }
  );
  const handoverStep = processSteps[6] || RESIDENTIAL_BUILDER_PROCESS[6];
  const homeHandover = buildResidentialColumns({
    ratio: "50-50",
    leftImage: handoverStep.image,
    leftColumnContentType: "image",
    rightTitle: `Step ${handoverStep.number} · ${handoverStep.title}`,
    rightContent: `${handoverStep.summary || handoverStep.body}\n\n${handoverStep.builder || ""}\n\nSee every stage in detail on our process page.`,
    backgroundColor: "#ffffff",
    cardBackgroundColor: palette.stone,
    textColor: palette.ink,
    columnGap: 32,
    sectionAnimation: "fade-up",
  });

  const parallaxBlock = buildParallax({
    title: "Every home we hand over carries our name in the street.",
    subtitle: "That is why we inspect every stage, document every decision and stay involved long after the keys are handed over.",
    buttonLabel: "Our Process",
    buttonHref: "/process",
    imageUrl: images.duskLawnHome,
    floatingImage: "",
    minHeight: "64vh",
    contentWidth: 700,
    backgroundColor: palette.ink,
    buttonColor: system.hero.buttonColor,
    buttonTextColor: system.hero.buttonTextColor,
  }, system);
  const homeParallax = {
    ...parallaxBlock,
    props: {
      ...parallaxBlock.props,
      headlineFontSize: 46,
      subheadlineFontSize: 19,
      contentBackground: "linear-gradient(160deg, rgba(20,18,15,0.8), rgba(20,18,15,0.6))",
      contentPadding: "40px 44px",
    },
  };

  const processPageSteps = processSteps.map((step, index) => {
    const imageLeft = index % 2 === 1;
    const content = [
      step.summary || step.body || "",
      step.client ? `<strong>What you can expect</strong>\n${step.client}` : "",
      step.builder ? `<strong>What ${siteName} does</strong>\n${step.builder}` : "",
    ].filter(Boolean).join("\n\n");
    const title = `${step.number} · ${step.title}`;
    return buildResidentialColumns({
      ratio: "50-50",
      leftTitle: imageLeft ? "" : title,
      leftContent: imageLeft ? "" : content,
      leftImage: imageLeft ? step.image : "",
      leftColumnContentType: imageLeft ? "image" : "text",
      rightTitle: imageLeft ? title : "",
      rightContent: imageLeft ? content : "",
      rightImage: imageLeft ? "" : step.image,
      rightColumnContentType: imageLeft ? "text" : "image",
      backgroundColor: index % 2 === 0 ? palette.stone : "#ffffff",
      cardBackgroundColor: index % 2 === 0 ? "#ffffff" : palette.stone,
      textColor: palette.ink,
      columnGap: 40,
      // Subtle, repeated reveal reinforces progression through the stages.
      sectionAnimation: "fade-up",
    });
  });

  return {
    version: 1,
    site: {
      logoText: siteName,
      nav: pages
        .filter((page) => !["privacy", "terms"].includes(page.slug))
        .map((page) => ({ label: page.title, href: page.slug === "home" ? "/" : `/${page.slug}` })),
    },
    pages: [
      buildPage("home", "Home", home.objective || "Establish premium residential building authority and convert visitors into consultation requests.", [
        nav,
        homeHero,
        credentials,
        buildResidentialColumns({
          ratio: "50-50",
          leftTitle: `${siteName} builds homes that are made to be lived in`,
          leftContent: home.intro?.text || `We are a Queensland residential builder working across the Sunshine Coast, Brisbane, Moreton Bay and the Gold Coast. We build custom homes, new homes, renovations and knockdown rebuilds for families who want a well-designed home and a building experience that is calm, transparent and properly managed.\n\nGood homes in Queensland are designed for the way we live here: shade and breeze, covered outdoor living, durable materials and layouts that work for growing families. We bring that thinking to every project, whether we are working from your architect's plans or helping shape the design from the start.\n\nWe take on a limited number of builds at a time, so every home has the attention of our director and a dedicated construction manager, with clear communication from first meeting to handover.`,
          rightImage: images.gumTreeHome,
          rightColumnContentType: "image",
          backgroundColor: palette.stone,
          cardBackgroundColor: "#ffffff",
          textColor: palette.ink,
          columnGap: 32,
        }),
        buildResidentialCardGrid(
          services.map((service) => ({ title: service.title, content: service.summary, image: service.image, link: "/services" })),
          { title: "What we build", columns: 4, imageHeight: 260, dark: true, cardAnimationStagger: 0.1 }
        ),
        buildResidentialProjectGrid(projects.slice(0, 3), { title: "Featured projects", backgroundColor: palette.charcoal }),
        whyBuildWithUs,
        homeProcessGrid,
        homeHandover,
        homeParallax,
        buildResidentialTestimonials(testimonials.slice(0, 3), { title: "What our clients say" }),
        buildResidentialFinalCta(hydratedProfile),
        footer,
      ]),

      buildPage("about", "About Us", about.objective || "Build trust in the company's story, experience and values.", [
        nav,
        buildResidentialInnerHero({
          eyebrow: "ABOUT US",
          title: about.title || "A Queensland builder founded on craftsmanship and straight talk",
          subtitle: "A close team of builders, site managers and long-standing trades, building every home as if it were our own.",
          imageUrl: images.whiteModernPool,
        }, system),
        buildResidentialColumns({
          ratio: "50-50",
          leftTitle: "Our story",
          leftContent: about.text || `${siteName} was started by a builder who had spent years on other people's sites, watching good designs compromised by poor communication and rushed work. The idea was simple: build fewer homes, give each one more attention, and be completely honest about cost and time.\n\nToday we are a small team of builders, site managers and trusted trades working across South East Queensland. Much of our work comes from past clients, their neighbours and the designers we build for, and we would like to keep it that way.`,
          rightImage: images.planning,
          rightColumnContentType: "image",
          backgroundColor: palette.stone,
          cardBackgroundColor: "#ffffff",
          textColor: palette.ink,
          columnGap: 32,
        }),
        withResidentialProps(buildStats({
          title: "How we work",
          subtitle: "Commitments you can hold us to, from first meeting to handover.",
          statsVariant: "editorial-band",
          sectionAnimation: "fade-up",
          items: [
            { value: "1", label: "Builder accountable", detail: "The builder who quotes your home is responsible for it on site." },
            { value: "7", label: "Clear stages", detail: "From initial consultation to handover, each with a defined outcome." },
            { value: "Fixed", label: "Price contracts", detail: "Itemised quotations with clear allowances and written variations." },
            { value: "QBCC", label: "Licensed builder", detail: "Eligible residential work is covered by the QBCC Home Warranty Scheme." },
          ],
        }), { accentColor: palette.bronze }),
        buildResidentialCardGrid(
          [
            { eyebrow: "01", title: "Integrity", content: "Honest pricing, honest timelines and a straight answer when something changes. We would rather lose a job than win it with an unrealistic quote." },
            { eyebrow: "02", title: "Communication", content: "Regular updates, scheduled site walks and a builder who answers the phone. You always know what is happening and what comes next." },
            { eyebrow: "03", title: "Craftsmanship", content: "Quality is decided in the details. We check junctions, finishes and waterproofing ourselves before any stage is signed off." },
            { eyebrow: "04", title: "Accountability", content: "One team responsible from start to finish, and still here after handover to look after anything that needs attention." },
          ],
          { title: "Our values", columns: 4, backgroundColor: "#ffffff", cardBackgroundColor: palette.stone, columnPadding: 28 }
        ),
        section("team", {
          title: about.team?.title || "The people who build your home",
          subtitle: "A small, experienced team you will deal with directly, from first meeting to handover.",
          teamVariant: "studio-cards",
          backgroundColor: palette.stone,
          textColor: palette.ink,
          subtleTextColor: palette.muted,
          sectionAnimation: "fade-up",
          members: teamMembers.slice(0, 3),
        }),
        buildResidentialColumns({
          ratio: "50-50",
          leftImage: images.livingPremier,
          leftColumnContentType: "image",
          rightTitle: "Why homeowners choose us",
          rightContent: "Because the builder who quotes the job runs the job. Because our contracts are fixed-price and our allowances are realistic. Because our sites are clean and safe, and our trades take pride in their work.\n\nAnd because we are still here after handover, looking after the homes we have built and the families living in them.",
          backgroundColor: "#ffffff",
          cardBackgroundColor: palette.stone,
          textColor: palette.ink,
          columnGap: 32,
        }),
        buildResidentialFinalCta(hydratedProfile, { title: `Meet the ${siteName} team`, sectionAnimation: "none" }),
        footer,
      ]),

      buildPage("services", "Our Services", "Detail the four residential building services with substantial content and imagery.", [
        nav,
        buildResidentialInnerHero({
          eyebrow: "OUR SERVICES",
          title: "Four ways we build, one standard of quality",
          subtitle: "Starting on a vacant block, adding to the home you have, or starting again on the site you love, the same team and the same process apply.",
          secondaryLabel: "View Our Projects",
          secondaryHref: "/projects",
          imageUrl: images.heroAlt,
        }, system),
        ...services.map((service, index) => {
          const content = `${service.detail}\n\n${(service.points || []).map((point) => `— ${point}`).join("\n")}`;
          const imageFirst = index % 2 === 1;
          return buildResidentialColumns({
            ratio: "50-50",
            leftTitle: imageFirst ? "" : service.title,
            leftContent: imageFirst ? "" : content,
            leftImage: imageFirst ? service.image : "",
            leftColumnContentType: imageFirst ? "image" : "text",
            rightTitle: imageFirst ? service.title : "",
            rightContent: imageFirst ? content : "",
            rightImage: imageFirst ? "" : service.image,
            rightColumnContentType: imageFirst ? "text" : "image",
            backgroundColor: index % 2 === 0 ? palette.stone : "#ffffff",
            cardBackgroundColor: index % 2 === 0 ? "#ffffff" : palette.stone,
            textColor: palette.ink,
            columnGap: 40,
          });
        }),
        withResidentialProps(buildFaq({
          title: "Service questions",
          sectionAnimation: "none",
          items: [
            { q: "Do you work with my architect or designer?", a: "Yes. Many of our custom homes are architect or designer led. We can also introduce you to design partners we trust." },
            { q: "Where do you build?", a: "Across the Sunshine Coast, Brisbane, Moreton Bay and the Gold Coast. Contact us to discuss sites outside these areas." },
            { q: "How are variations handled?", a: "Every variation is documented, priced and approved by you in writing before work proceeds." },
            { q: "Should I renovate or knock down and rebuild?", a: "It depends on the condition of the existing home, your site and your budget. We will walk through both options with you honestly at the initial consultation." },
          ],
        }), { blockBackgroundColor: palette.sand, backgroundImage: "", faqPanelBackgroundColor: "#ffffff", faqMaxWidth: 1040 }),
        buildResidentialFinalCta(hydratedProfile, { title: "Not sure which service fits?", description: "Tell us about your site and what you want to achieve. We will recommend the right pathway, whether that is a renovation, an extension or a rebuild.", sectionAnimation: "none" }),
        footer,
      ]),

      buildPage("projects", "Our Projects", "Showcase the premium residential portfolio with project detail.", [
        nav,
        buildResidentialInnerHero({
          eyebrow: "OUR PROJECTS",
          title: "Homes we are proud to put our name to",
          subtitle: "A selection of custom homes, new homes, renovations and knockdown rebuilds across South East Queensland.",
          imageUrl: images.palmPoolHome,
        }, system),
        buildResidentialProjectGrid(projects, { title: "Recent residential projects", imageHeight: 320 }),
        buildGallery({
          title: "Details and interiors",
          sectionAnimation: "none",
          columns: 3,
          images: [
            { src: images.kitchenIsland, alt: "Custom kitchen with island bench", caption: "Kitchen and joinery · Caloundra" },
            { src: images.ensuite, alt: "Main ensuite", caption: "Main ensuite · Noosa Heads" },
            { src: images.livingOpen, alt: "Open-plan living", caption: "Open-plan living · Buderim" },
            { src: images.bedroom, alt: "Main bedroom", caption: "Parents' retreat · Maroochydore" },
            { src: images.stairsPoolView, alt: "Stair and pool view", caption: "Stair and pool terrace · New Farm" },
            { src: images.livingArched, alt: "Living room with fireplace", caption: "Living room · Samford" },
          ],
        }, "balanced-grid"),
        buildResidentialFinalCta(hydratedProfile, { title: "Have a project like these in mind?", sectionAnimation: "none" }),
        footer,
      ]),

      buildPage("process", "Our Process", "Explain the seven-step building process.", [
        nav,
        buildResidentialInnerHero({
          eyebrow: "OUR PROCESS",
          title: "Seven clear steps from first meeting to handover",
          subtitle: "Building a home is a significant commitment. Our process is designed so you understand every stage, every cost and every decision before it is made.",
          imageUrl: images.rebuiltHome,
        }, system),
        buildResidentialIntro(
          "A process built to remove uncertainty",
          "Most building stress comes from surprises: unclear scope, unexpected costs and not knowing what happens next. Each stage below has a clear outcome and your sign-off, so nothing moves forward until you are ready.<br/><br/>For every stage we explain what you can expect as the homeowner, and what our team is doing behind the scenes.",
          { backgroundColor: "#ffffff", textFontSize: 19 }
        ),
        ...processPageSteps,
        buildResidentialFinalCta(hydratedProfile, { eyebrow: "STEP 01", title: "Start with an initial consultation", sectionAnimation: "none" }),
        footer,
      ]),

      buildPage("testimonials", "Testimonials", "Present client experiences using editable sample layouts.", [
        nav,
        buildResidentialInnerHero({
          eyebrow: "TESTIMONIALS",
          title: "What it is like to build with us",
          subtitle: "The best measure of a builder is what clients say after they have moved in. Ask us about speaking with past clients.",
          imageUrl: images.livingBright,
        }, system),
        buildResidentialTestimonials(testimonials.slice(0, 6), { title: "Client experiences", backgroundColor: palette.stone, sectionAnimation: "fade-up" }),
        buildResidentialColumns({
          ratio: "50-50",
          leftImage: images.familyKitchen,
          leftColumnContentType: "image",
          rightTitle: "Featured client story: a family home in Buderim",
          rightContent: "Mark and Olivia loved their street but had outgrown their 1970s house. Renovating would have meant compromising on almost everything, so we worked through a knockdown rebuild feasibility with them before any design work began.\n\nWe managed the disconnections, demolition and approvals, then built a two-storey home planned around hinterland views, a covered outdoor room and a kitchen at the centre of family life. The family received regular updates and site walks at every key stage, and moved in on the agreed programme.\n\n\"We knew what was happening every week, and the finished home is exactly what we hoped for.\"\n\nSample client story for demonstration. Replace with a genuine client story before publishing.",
          backgroundColor: "#ffffff",
          cardBackgroundColor: palette.stone,
          textColor: palette.ink,
          columnGap: 32,
          sectionAnimation: "fade-up",
        }),
        buildResidentialFinalCta(hydratedProfile, { title: "Become our next success story", sectionAnimation: "none" }),
        footer,
      ]),

      buildPage("contact", "Contact", "Capture qualified residential building enquiries.", [
        nav,
        buildResidentialInnerHero({
          eyebrow: "CONTACT",
          title: "Request a consultation",
          subtitle: "Tell us about your block, your plans and your timing. We will be in touch within one business day to arrange a meeting on site or in our office.",
          primaryLabel: "Request a Consultation",
          primaryHref: "#contact",
          imageUrl: images.livingOpen,
        }, system),
        section("contact-form", {
          title: "Tell us about your project",
          subtitle: "The more detail you share, the more useful our first conversation will be.",
          mediaPosition: "right",
          mediaImage: images.duskArchitectural,
          submitText: "Request a Consultation",
          sectionAnimation: "fade-up",
          fields: [
            { name: "name", label: "Name", type: "text", required: true, placeholder: "Your full name" },
            { name: "email", label: "Email", type: "email", required: true, placeholder: "you@example.com" },
            { name: "phone", label: "Phone", type: "text", required: true, placeholder: "04xx xxx xxx" },
            { name: "projectLocation", label: "Project Location", type: "text", required: true, placeholder: "Suburb, e.g. Buderim QLD" },
            { name: "projectType", label: "Project Type", type: "text", required: true, placeholder: "Custom home, new home, renovation & extension, or knockdown rebuild" },
            { name: "budget", label: "Approximate Budget", type: "text", required: false, placeholder: "e.g. $750k to $1.1m" },
            { name: "startTime", label: "Preferred Start Time", type: "text", required: false, placeholder: "e.g. Within 6 months, next year, still planning" },
            { name: "message", label: "Tell Us About Your Project", type: "textarea", required: false, placeholder: "Your block, plans or designer, number of bedrooms, must-haves" },
          ],
        }),
        section("columns-3", {
          column1Title: "Contact details",
          column1: "Phone: 07 XXXX XXXX\nEmail: hello@goodbuildhomes.com.au\nOffice meetings by appointment",
          column2Title: "Service areas",
          column2: "Sunshine Coast, Brisbane, Moreton Bay and the Gold Coast.\nOther South East Queensland locations considered on request.",
          column3Title: "Business hours",
          column3: "Monday to Friday: 7:00am to 4:30pm\nSaturday: site meetings by appointment\nSunday and public holidays: closed",
          backgroundColor: palette.stone,
          cardBackgroundColor: "#ffffff",
          textColor: palette.ink,
        }),
        footer,
      ]),

      buildPrivacyPolicyPage({ ...hydratedProfile, siteName }, system, nav, footer),
      buildTermsPage({ ...hydratedProfile, siteName }, system, nav, footer),
    ],
  };
}

function buildHomeRenovationBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  const imageProfile = attachTeamMemberImages(profile);
  const system = getVisualSystem(profile.templateSlug);
  const homePage = findPage(blueprint, "home");
  const resultsPage = findPage(blueprint, profile.proofPage?.slug || "results");
  const contactPage = findPage(blueprint, profile.contactPage?.slug || "contact");

  insertAfterSectionType(homePage, "hero", [
    buildParallax({
      title: "Builder and renovation sites need to show process, detail, and trust long before the quote form appears",
      subtitle: "This adds production-quality pacing and makes the project gallery feel earned rather than tacked on.",
      buttonLabel: "View projects",
      buttonHref: "/results",
      imageUrl: getProfileImage(imageProfile, 0, profile.home?.gallery?.images?.[0]?.src || profile.home?.hero?.imageUrl || ""),
      floatingImage: getProfileImage(imageProfile, 1, profile.home?.gallery?.images?.[1]?.src || profile.about?.imageUrl || ""),
      minHeight: "68vh",
      backgroundColor: "#262626",
      buttonColor: system.hero.buttonColor,
      buttonTextColor: system.hero.buttonTextColor,
    }, system),
    buildColumns2({
      ratio: "50-50",
      leftTitle: "What homeowners want to know fast",
      leftContent: "Can you handle the scope, communicate clearly, manage trades well, and deliver a finish that feels worth the spend?",
      rightTitle: "What the site should demonstrate",
      rightContent: "Project quality, process clarity, realistic trust markers, and imagery that makes the workmanship feel tangible.",
      rightImage: getProfileImage(imageProfile, 2, profile.home?.gallery?.images?.[2]?.src || profile.home?.hero?.imageUrl || ""),
      cardBackgroundColor: "#fafaf9",
    }),
  ]);

  insertBeforeFooter(resultsPage, buildTrustBadges(["Clear quoting", "Project-managed delivery", "Craft-led detail", "Reliable communication"]));

  updateContactFormFields(contactPage, [
    { name: "name", label: "Full Name", type: "text", required: true, placeholder: "Casey Morgan" },
    { name: "email", label: "Email", type: "email", required: true, placeholder: "casey@example.com" },
    { name: "phone", label: "Phone", type: "text", required: false, placeholder: "+61 ..." },
    { name: "projectType", label: "Project Type", type: "text", required: false, placeholder: "Kitchen, bathroom, extension, renovation" },
    { name: "location", label: "Project Location", type: "text", required: false, placeholder: "Suburb or area" },
    { name: "timeline", label: "Stage and Timeline", type: "textarea", required: false, placeholder: "Concept, quoting, plans ready, preferred start" },
  ]);

  return blueprint;
}

function buildAccountingBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  const imageProfile = attachTeamMemberImages(profile);
  const system = getVisualSystem(profile.templateSlug);
  const homePage = findPage(blueprint, "home");
  const servicesPage = findPage(blueprint, profile.servicesPage?.slug || "services");
  const contactPage = findPage(blueprint, profile.contactPage?.slug || "contact");

  insertAfterSectionType(homePage, "hero", [
    buildParallax({
      title: "Finance and advisory sites need calm confidence and operational clarity, not generic corporate filler",
      subtitle: "This section helps the firm feel precise, commercially useful, and trustworthy before the service detail begins.",
      buttonLabel: "View services",
      buttonHref: "/services",
      imageUrl: getProfileImage(imageProfile, 0, profile.home?.hero?.imageUrl || ""),
      floatingImage: getProfileImage(imageProfile, 1, profile.about?.imageUrl || profile.home?.hero?.imageUrl || ""),
      minHeight: "64vh",
      backgroundColor: "#f1f5f9",
      buttonColor: system.hero.buttonColor,
      buttonTextColor: system.hero.buttonTextColor,
      headlineColor: system.hero.headlineColor,
      textColor: system.hero.textColor,
    }, system),
    buildColumns2({
      ratio: "45-55",
      leftTitle: "What business owners want",
      leftContent: "Accurate numbers, clean communication, fewer surprises, and support that helps them make better decisions.",
      rightTitle: "What this site should reinforce",
      rightContent: "Reliability, responsiveness, software familiarity, and enough advisory depth to position the firm above commodity compliance work.",
      cardBackgroundColor: "#f8fafc",
    }),
  ]);

  insertBeforeFooter(servicesPage, buildTrustBadges(["Accurate reporting", "Responsive support", "Advisory mindset", "Cloud-software friendly"]));

  updateContactFormFields(contactPage, [
    { name: "name", label: "Full Name", type: "text", required: true, placeholder: "Morgan Lee" },
    { name: "email", label: "Email", type: "email", required: true, placeholder: "morgan@example.com" },
    { name: "businessName", label: "Business Name", type: "text", required: false, placeholder: "Business name" },
    { name: "software", label: "Current Software", type: "text", required: false, placeholder: "Xero, MYOB, QBO, spreadsheets" },
    { name: "supportNeeded", label: "Support Needed", type: "text", required: false, placeholder: "Bookkeeping, tax, payroll, advisory" },
    { name: "notes", label: "Current Challenges", type: "textarea", required: false, placeholder: "Share the finance, reporting, or compliance issues you want solved" },
  ]);

  return blueprint;
}

function buildTeamMemberImagePool(templateSlug) {
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

function attachTeamMemberImages(profile) {
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

function buildLegalHero(pageTitle, profile, description) {
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

function buildLegalTextSection(text) {
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

function buildPrivacyPolicyText(profile) {
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

function buildTermsText(profile) {
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

function buildPrivacyPolicyPage(profile, system, nav, footer) {
  return buildPage("privacy", "Privacy Policy", "Explain how visitor and customer data is handled.", [
    nav,
    buildLegalHeroSection(profile, "Privacy Policy", "Explain how visitor, enquiry, and customer information is collected, used, stored, and protected.", system),
    buildDecorativeDivider(system, "dots"),
    buildLegalTextSection(buildPrivacyPolicyText(profile)),
    buildDecorativeDivider(system, "line"),
    footer,
  ]);
}

function buildTermsPage(profile, system, nav, footer) {
  return buildPage("terms", "Terms of Service", "Set the rules, disclaimers, and commercial boundaries for the site.", [
    nav,
    buildLegalHeroSection(profile, "Terms of Service", "Set the legal rules, commercial terms, disclaimers, and service conditions that apply to this website.", system),
    buildDecorativeDivider(system, "dashes"),
    buildLegalTextSection(buildTermsText(profile)),
    buildDecorativeDivider(system, "line"),
    footer,
  ]);
}

function uniqueImageList(...values) {
  const seen = new Set();
  return values.filter((value) => {
    const next = String(value || "").trim();
    if (!next || seen.has(next)) return false;
    seen.add(next);
    return true;
  });
}

const MIN_TEMPLATE_IMAGE_COUNT = 6;

function buildTemplateFallbackImagePool(templateSlug) {
  return uniqueImageList(
    ...buildTeamMemberImagePool(templateSlug),
    "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=80"
  );
}

function buildProfileImagePool(profile) {
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

function createTemplateImagePicker(profile) {
  const pool = buildProfileImagePool(profile);
  let cursor = 0;

  return (fallback = "") => {
    if (!pool.length) return fallback || "";
    const next = pool[cursor % pool.length] || fallback || "";
    cursor += 1;
    return next || fallback || "";
  };
}

function enrichBlueprintImages(blueprint, profile) {
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

function getProfileImage(profile, index, fallback = "") {
  const pool = buildProfileImagePool(profile);
  if (!pool.length) return fallback || "";
  return pool[index % pool.length] || fallback || "";
}

function withHeroMedia(hero = {}, profile, primaryIndex = 0, secondaryIndex = 1) {
  const primaryImage = hero?.imageUrl || getProfileImage(profile, primaryIndex, "");
  const secondaryImage = hero?.floatingImage || getProfileImage(profile, secondaryIndex, primaryImage);

  return {
    ...hero,
    imageUrl: primaryImage,
    floatingImage: secondaryImage,
  };
}

function buildServiceFirmBlueprint(profile) {
  const hydratedProfile = attachTeamMemberImages(profile);
  const system = getVisualSystem(hydratedProfile.templateSlug || "default");
  const imagePool = buildProfileImagePool(hydratedProfile);
  const distinctImagePool = collectDistinctImagePool(hydratedProfile, [
    hydratedProfile.home?.hero?.imageUrl,
    hydratedProfile.about?.imageUrl,
    hydratedProfile.servicesPage?.hero?.imageUrl,
    hydratedProfile.contactPage?.hero?.imageUrl,
    ...(hydratedProfile.home?.gallery?.images || []).map((image) => image?.src),
    ...(hydratedProfile.proofPage?.gallery?.images || []).map((image) => image?.src),
  ]);
  const pages = [
    { slug: "home", title: "Home" },
    { slug: hydratedProfile.about?.slug || "about", title: hydratedProfile.about?.pageTitle || "About" },
    { slug: hydratedProfile.servicesPage?.slug || "services", title: hydratedProfile.servicesPage?.pageTitle || "Services" },
    ...(hydratedProfile.proofPage ? [{ slug: hydratedProfile.proofPage.slug || "results", title: hydratedProfile.proofPage.pageTitle || "Results" }] : []),
    { slug: hydratedProfile.contactPage?.slug || "contact", title: hydratedProfile.contactPage?.pageTitle || "Contact" },
    { slug: "privacy", title: "Privacy Policy" },
    { slug: "terms", title: "Terms of Service" },
  ];
  const nav = buildNav(hydratedProfile, pages, system);
  const footer = buildFooter(hydratedProfile, pages, system);
  const home = hydratedProfile.home || {};
  const about = hydratedProfile.about || {};
  const services = hydratedProfile.servicesPage || {};
  const proof = hydratedProfile.proofPage || null;
  const contact = hydratedProfile.contactPage || {};
  const homeFeatureImages = pickImageWindow(distinctImagePool, 2, 3);
  const serviceFeatureImages = pickImageWindow(distinctImagePool, 5, 3);
  const aboutGalleryImages = pickImageWindow(distinctImagePool, 1, 6).map((src, index) => ({ src, alt: `${hydratedProfile.siteName} about image ${index + 1}` }));
  const servicesGalleryImages = pickImageWindow(distinctImagePool, 7, 6).map((src, index) => ({ src, alt: `${hydratedProfile.siteName} services image ${index + 1}` }));
  const proofGalleryImages = pickImageWindow(distinctImagePool, 13, 6).map((src, index) => ({ src, alt: `${hydratedProfile.siteName} proof image ${index + 1}` }));
  const contactGalleryImages = pickImageWindow(distinctImagePool, 19, 6).map((src, index) => ({ src, alt: `${hydratedProfile.siteName} contact image ${index + 1}` }));

  return {
    version: 1,
    site: {
      logoText: hydratedProfile.siteName,
      nav: pages
        .filter((page) => !["privacy", "terms"].includes(page.slug))
        .map((page) => ({ label: page.title, href: page.slug === "home" ? "/" : `/${page.slug}` })),
    },
    pages: [
      buildPage("home", "Home", home.objective || "Present the offer clearly.", [
        nav,
        buildHero(withHeroMedia(home.hero || {}, hydratedProfile, 0, 1), { minHeight: "94vh", buttonColor: system.hero.buttonColor }, system),
        buildMarqueeStrip([
          home.hero?.eyebrow || hydratedProfile.siteName,
          ...(home.services?.items || []).map((item) => item?.title),
          hydratedProfile.navCtaLabel || "Contact",
        ], {
          backgroundColor: system.nav.backgroundColor || "#081120",
          textColor: system.nav.textColor || "#f8fafc",
          accentColor: system.hero.buttonColor || "#7dd3fc",
          speed: 22,
        }),
        buildTrustBadges(getIndustryTrustBadges(hydratedProfile)),
        buildDecorativeDivider(system, "dots"),
        buildStats(home.stats || {}),
        buildShowcaseStack({
          idPrefix: `${hydratedProfile.templateSlug}-home`,
          title: `${hydratedProfile.siteName} storyboard`,
          copy: home.objective || home.hero?.subtitle || "Make the offer feel real before the visitor reaches the detail sections.",
          images: [
            home.gallery?.images?.[0]?.src || home.hero?.imageUrl || imagePool[0] || "",
            home.gallery?.images?.[1]?.src || about.imageUrl || imagePool[1] || "",
            home.gallery?.images?.[2]?.src || proof?.gallery?.images?.[0]?.src || imagePool[2] || "",
          ],
        }),
        buildColumns2({
          ratio: "60-40",
          leftTitle: home.services?.title || "What this site helps you do",
          leftContent: home.services?.subtitle || "Use this space to explain the commercial problem the site solves.",
          rightTitle: "Why it works",
          rightContent: (home.features?.items || []).map((item) => `${item.title}: ${item.text}`).join("\n\n"),
          rightImage: getProfileImage(hydratedProfile, 1, home.hero?.imageUrl || about.imageUrl || ""),
          cardBackgroundColor: "#f8fafc",
        }),
        buildDecorativeDivider(system, "line"),
        buildFeatureList(home.services || {}, { featureVariant: "editorial-cards", layout: "columns", fallbackImage: getProfileImage(hydratedProfile, 2, home.hero?.imageUrl || ""), fallbackImages: homeFeatureImages }),
        buildDecorativeDivider(system, "dashes"),
        buildFeatureList(home.features || {}, { featureVariant: "glass-cards", layout: "columns", fallbackImage: getProfileImage(hydratedProfile, 3, about.imageUrl || imagePool[0] || ""), fallbackImages: homeFeatureImages.slice().reverse() }),
        home.gallery ? buildGallery(home.gallery, system.galleryVariant || "balanced-grid") : null,
        home.testimonials ? buildTestimonials(home.testimonials, system.testimonialVariant || "wall") : null,
        home.pricing ? buildPricing(home.pricing, system.pricingVariant || "premium") : null,
        home.faq ? buildFaq(home.faq) : null,
        buildCta(home.cta || {}, system.ctaStyle || "split-banner"),
        footer,
      ]),
      buildPage(about.slug || "about", about.pageTitle || "About", about.objective || "Build trust.", [
        nav,
        buildHero(withHeroMedia({
          title: about.title || `About ${profile.siteName}`,
          subtitle: about.text || "Add your origin story and positioning here.",
          primaryLabel: "See services",
          primaryHref: `/${services.slug || "services"}`,
          imageUrl: about.imageUrl || home.hero?.imageUrl || "",
        }, hydratedProfile, 1, 2), { heroVariant: system.hero.heroVariant === "editorial" ? "editorial" : "split", buttonColor: system.hero.buttonColor, buttonTextColor: system.hero.buttonTextColor }, system),
        buildParallax({
          title: `The ${hydratedProfile.siteName} story should feel visual and substantial, not hidden behind one plain text block.`,
          subtitle: about.objective || "Use atmosphere, imagery, and founder or team context to make the business feel more real before the enquiry.",
          buttonLabel: "See services",
          buttonHref: `/${services.slug || "services"}`,
          imageUrl: aboutGalleryImages[0]?.src || about.imageUrl || home.hero?.imageUrl || "",
          floatingImage: aboutGalleryImages[1]?.src || proofGalleryImages[0]?.src || "",
          backgroundColor: system.hero.backgroundColor,
          buttonColor: system.hero.buttonColor,
          buttonTextColor: system.hero.buttonTextColor,
          minHeight: "62vh",
          contentWidth: 560,
        }, system),
        buildColumns2({
          ratio: "40-60",
          leftTitle: "Core strengths",
          leftContent: (about.bullets || []).join("\n\n"),
          rightTitle: "What clients should understand",
          rightContent: about.text || "Explain why this business exists and how it works.",
          leftImage: getProfileImage(hydratedProfile, 4, about.imageUrl || imagePool[0] || ""),
          cardBackgroundColor: "#f8fafc",
        }),
        aboutGalleryImages.length ? buildGallery({ title: `${about.pageTitle || "About"} visuals`, images: aboutGalleryImages }, system.galleryVariant || "balanced-grid") : null,
        buildDecorativeDivider(system, "dots"),
        about.stats ? buildStats(about.stats) : null,
        about.team ? section("team", { title: about.team.title || "Team", teamVariant: "studio-cards", members: about.team.members || [] }) : null,
        about.testimonials ? buildTestimonials(about.testimonials, "cards") : null,
        buildCta({ title: `Ready to work with ${hydratedProfile.siteName}?`, subtitle: "Use the contact page to turn interest into a real enquiry.", buttonLabel: hydratedProfile.navCtaLabel || "Contact", buttonHref: hydratedProfile.navCtaHref || "/contact" }, system.ctaStyle || "split-banner"),
        footer,
      ]),
      buildPage(services.slug || "services", services.pageTitle || "Services", services.objective || "Explain the offer.", [
        nav,
        buildHero({
          ...(services.hero || home.hero || {}),
          imageUrl: services.hero?.imageUrl || servicesGalleryImages[0]?.src || getProfileImage(hydratedProfile, 7, home.hero?.imageUrl || ""),
          floatingImage: "",
        }, {
          heroVariant: "spotlight",
          minHeight: "88vh",
          headlineAlignment: "center",
          verticalAlign: "center",
          contentWidth: 880,
          contentHeight: 320,
          contentY: 56,
          headlineFontSize: 64,
          subheadlineFontSize: 24,
          buttonColor: system.hero.buttonColor,
          buttonTextColor: system.hero.buttonTextColor,
          contentBackground: "linear-gradient(180deg, rgba(7,17,29,0.16), rgba(7,17,29,0.56))",
          backgroundPosition: "center center",
          textAnimation: "blur-in",
          subheadlineAnimation: "fade-up",
        }, system),
        buildMarqueeStrip([
          hydratedProfile.siteName,
          ...(services.services?.items || []).map((item) => item?.title),
          services.features?.title || "Premium website delivery",
          hydratedProfile.navCtaLabel || "Start Project",
        ], {
          backgroundColor: system.nav.backgroundColor || "#081120",
          textColor: system.nav.textColor || "#f8fafc",
          accentColor: system.hero.buttonColor || "#7dd3fc",
          speed: 20,
        }),
        buildParallax({
          title: `${services.pageTitle || "Services"} should feel like a visual offer deck, not a dry list of service cards.`,
          subtitle: services.objective || "Use imagery, proof, and motion to make each service path feel more tangible before the visitor reaches the quote step.",
          buttonLabel: hydratedProfile.navCtaLabel || "Contact",
          buttonHref: hydratedProfile.navCtaHref || "/contact",
          imageUrl: servicesGalleryImages[1]?.src || services.hero?.imageUrl || home.hero?.imageUrl || "",
          floatingImage: "",
          backgroundColor: system.hero.backgroundColor,
          buttonColor: system.hero.buttonColor,
          buttonTextColor: system.hero.buttonTextColor,
          minHeight: "70vh",
          alignment: "center",
          contentX: 50,
          contentY: 54,
          contentWidth: 760,
          contentHeight: 240,
        }, system),
        buildShowcaseStack({
          idPrefix: `${hydratedProfile.templateSlug}-services`,
          title: `${services.pageTitle || "Services"} storyboard`,
          copy: services.objective || "Turn the offer page into a richer visual sales deck with real service atmosphere.",
          images: [
            servicesGalleryImages[2]?.src || services.hero?.imageUrl || home.hero?.imageUrl || "",
            servicesGalleryImages[3]?.src || servicesGalleryImages[4]?.src || about.imageUrl || "",
            servicesGalleryImages[5]?.src || imagePool[2] || "",
          ],
          backgroundColor: "linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)",
        }),
        buildDecorativeDivider(system, "line"),
        buildFeatureList(services.services || home.services || {}, { featureVariant: "cards", layout: "columns", fallbackImage: getProfileImage(hydratedProfile, 5, home.hero?.imageUrl || imagePool[0] || ""), fallbackImages: serviceFeatureImages }),
        services.features ? buildColumns2({
          ratio: "50-50",
          leftTitle: services.features.title || "How delivery works",
          leftContent: services.features.subtitle || "Explain the process.",
          rightTitle: "Execution rhythm",
          rightContent: (services.features.items || []).map((item) => `${item.title}: ${item.text}`).join("\n\n"),
          rightImage: getProfileImage(hydratedProfile, 6, home.hero?.imageUrl || about.imageUrl || ""),
          cardBackgroundColor: "#f8fafc",
        }) : null,
        servicesGalleryImages.length ? buildGallery({ title: `${services.pageTitle || "Services"} visuals`, images: servicesGalleryImages, columns: 3 }, system.galleryVariant || "balanced-grid") : null,
        buildDecorativeDivider(system, "dots"),
        services.pricing ? buildPricing(services.pricing, system.pricingVariant || "premium") : null,
        services.faq ? buildFaq(services.faq) : null,
        buildCta({ title: services.cta?.title || "Want to discuss the right package?", subtitle: services.cta?.subtitle || "Push prospects into a call or quote request.", buttonLabel: hydratedProfile.navCtaLabel || "Book consult", buttonHref: hydratedProfile.navCtaHref || "/contact" }, system.ctaStyle || "split-banner"),
        footer,
      ]),
      ...(proof
        ? [
            buildPage(proof.slug || "results", proof.pageTitle || "Results", proof.objective || "Show proof.", [
              nav,
              buildHero(withHeroMedia(proof.hero || {
                title: proof.pageTitle || "Results",
                subtitle: proof.objective || "Use proof to support the buying decision.",
                primaryLabel: hydratedProfile.navCtaLabel || "Contact",
                primaryHref: hydratedProfile.navCtaHref || "/contact",
              }, hydratedProfile, 3, 4), { heroVariant: system.hero.heroVariant, buttonColor: system.hero.buttonColor, buttonTextColor: system.hero.buttonTextColor }, system),
              section("image-stack", {
                title: `${proof.pageTitle || "Results"} storyboard`,
                minHeight: "68vh",
                images: [
                  { id: `${hydratedProfile.templateSlug}-proof-a`, kind: "image", src: proofGalleryImages[0]?.src || getProfileImage(hydratedProfile, 3, home.hero?.imageUrl || ""), x: 14, y: 18, width: 320, height: 240, rotation: -6, radius: 22, zIndex: 1 },
                  { id: `${hydratedProfile.templateSlug}-proof-copy`, kind: "text", content: proof.objective || "Use this page to make the work, outcomes, and customer proof feel visible and concrete.", x: 47, y: 24, width: 390, height: 170, rotation: 0, radius: 22, zIndex: 2, fontSize: 30, fontWeight: "700", textAlign: "left", verticalAlign: "center", textColor: "#0f172a", background: "rgba(255,255,255,0.92)" },
                  { id: `${hydratedProfile.templateSlug}-proof-b`, kind: "image", src: proofGalleryImages[1]?.src || getProfileImage(hydratedProfile, 6, about.imageUrl || ""), x: 66, y: 58, width: 290, height: 220, rotation: 8, radius: 22, zIndex: 3 },
                  { id: `${hydratedProfile.templateSlug}-proof-c`, kind: "image", src: proofGalleryImages[2]?.src || getProfileImage(hydratedProfile, 10, imagePool[1] || ""), x: 34, y: 64, width: 250, height: 180, rotation: -9, radius: 18, zIndex: 2 },
                ],
              }),
              proof.stats ? buildStats(proof.stats) : null,
              buildColumns2({
                ratio: "50-50",
                leftTitle: "What the proof should communicate",
                leftContent: proof.objective || "Use this page to make the work and outcomes feel real.",
                rightTitle: proof.testimonials?.title || "What customers should believe",
                rightContent: (proof.testimonials?.items || []).map((item) => `${item.name}: ${item.quote}`).join("\n\n") || "Add real outcomes, customer language, and visible proof.",
                rightImage: proofGalleryImages[1]?.src || getProfileImage(hydratedProfile, 6, about.imageUrl || ""),
                cardBackgroundColor: "#f8fafc",
              }),
              proof.gallery ? buildGallery({ ...proof.gallery, images: [...(proof.gallery.images || []), ...proofGalleryImages].slice(0, 5) }, system.galleryVariant || "editorial-strip") : (proofGalleryImages.length ? buildGallery({ title: `${proof.pageTitle || "Results"} gallery`, images: proofGalleryImages }, system.galleryVariant || "editorial-strip") : null),
              proof.testimonials ? buildTestimonials(proof.testimonials, "spotlight") : null,
              buildCta(proof.cta || { title: "Like what you see?", subtitle: "Move the reader into a call while proof is fresh.", buttonLabel: hydratedProfile.navCtaLabel || "Contact", buttonHref: hydratedProfile.navCtaHref || "/contact" }, system.ctaStyle || "spotlight-pill"),
              footer,
            ]),
          ]
        : []),
      buildPage(contact.slug || "contact", contact.pageTitle || "Contact", contact.objective || "Capture enquiries.", [
        nav,
        buildHero(withHeroMedia(contact.hero || home.hero || {}, hydratedProfile, 4, 5), { heroVariant: system.hero.heroVariant, buttonColor: system.hero.buttonColor, buttonTextColor: system.hero.buttonTextColor }, system),
        buildParallax({
          title: `The ${contact.pageTitle || "contact"} page should still feel designed, image-led, and premium while collecting the enquiry.`,
          subtitle: contact.objective || "Use one more visual section here so the page does not collapse into plain form and FAQ blocks.",
          buttonLabel: hydratedProfile.navCtaLabel || "Contact",
          buttonHref: "#contact",
          imageUrl: contactGalleryImages[0]?.src || contact.hero?.imageUrl || home.hero?.imageUrl || "",
          floatingImage: contactGalleryImages[1]?.src || about.imageUrl || "",
          backgroundColor: system.hero.backgroundColor,
          buttonColor: system.hero.buttonColor,
          buttonTextColor: system.hero.buttonTextColor,
          minHeight: "58vh",
        }, system),
        buildColumns2({
          ratio: "40-60",
          leftTitle: contact.faq?.title || "What happens next",
          leftContent: (contact.faq?.items || []).map((item) => `${item.q}: ${item.a}`).join("\n\n") || contact.objective || "Explain what happens after the form is submitted.",
          rightTitle: contact.contact?.title || "Start the conversation",
          rightContent: contact.contact?.subtitle || "Use the form to capture qualified detail before the call.",
          rightImage: getProfileImage(hydratedProfile, 7, contact.hero?.imageUrl || home.hero?.imageUrl || ""),
          cardBackgroundColor: "#f8fafc",
        }),
        buildShowcaseStack({
          idPrefix: `${hydratedProfile.templateSlug}-contact`,
          title: `${contact.pageTitle || "Contact"} storyboard`,
          copy: contact.contact?.subtitle || contact.objective || "Keep the enquiry page visually alive instead of collapsing into a single form block.",
          images: [
            contactGalleryImages[0]?.src || contact.hero?.imageUrl || home.hero?.imageUrl || "",
            contactGalleryImages[1]?.src || about.imageUrl || imagePool[1] || "",
            contactGalleryImages[2]?.src || contactGalleryImages[3]?.src || imagePool[2] || "",
          ],
          minHeight: "64vh",
        }),
        contactGalleryImages.length ? buildGallery({ title: `${contact.pageTitle || "Contact"} visuals`, images: contactGalleryImages }, system.galleryVariant || "balanced-grid") : null,
        buildContact({ ...(contact.contact || {}), mediaImage: contact.contact?.mediaImage || contactGalleryImages[2]?.src || contactGalleryImages[0]?.src || "" }, getIndustryContactFields(hydratedProfile)),
        contact.faq ? buildFaq(contact.faq) : null,
        footer,
      ]),
      buildPrivacyPolicyPage(hydratedProfile, system, nav, footer),
      buildTermsPage(hydratedProfile, system, nav, footer),
    ],
  };
}

function buildSaasBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  blueprint.pages[0].sections.splice(3, 0,
    buildParallax({
      title: "Your ops layer should look and feel like a real product, not a feature dump",
      subtitle: "A good SaaS starter needs a motion-led section that sells speed, clarity, and control before the pricing table appears.",
      buttonLabel: "See Platform",
      buttonHref: "/services",
      imageUrl: profile.home?.hero?.imageUrl || "",
      minHeight: "66vh",
      contentX: 24,
      floatingImage: profile.home?.gallery?.images?.[0]?.src || profile.home?.hero?.imageUrl || "",
      floatingWidth: 320,
      floatingHeight: 220,
    }, getVisualSystem(profile.templateSlug)),
    buildColumns2({
      ratio: "60-40",
      leftTitle: "What the platform replaces",
      leftContent: "Multiple disconnected tools, manual follow-up, poor visibility, and fragmented reporting.",
      rightTitle: "What the buyer wants",
      rightContent: "One workspace, clearer accountability, faster onboarding, and better commercial visibility.",
      rightImage: profile.home?.hero?.imageUrl || "",
      cardBackgroundColor: "#eef6ff",
    }),
    section("cta-button", {
      eyebrow: "PRODUCT DEMO",
      title: "Show the product without dumping every feature into one wall of text",
      description: "Use this section to push trial users or demo bookings once the core product story is clear.",
      text: "Book a Demo",
      link: profile.navCtaHref || "/contact",
      style: "split-banner",
    })
  );
  return blueprint;
}

function buildRestaurantBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  blueprint.pages[0].sections.splice(2, 0, buildParallax({
    title: "Sell the room before you sell the booking",
    subtitle: "The best restaurant starters create appetite through mood, not just a list of menu items.",
    buttonLabel: "Reserve a Table",
    buttonHref: "/contact",
    imageUrl: profile.home?.gallery?.images?.[0]?.src || profile.home?.hero?.imageUrl || "",
    floatingImage: profile.home?.gallery?.images?.[1]?.src || "",
    backgroundColor: "#2f1707",
    buttonColor: "#fb923c",
    buttonTextColor: "#431407",
    minHeight: "70vh",
  }, getVisualSystem(profile.templateSlug)), buildColumns2({
    ratio: "50-50",
    leftTitle: "The venue feeling",
    leftContent: "Use this space to sell the mood, pace, and occasion before the booking happens.",
    rightTitle: "What guests come for",
    rightContent: (profile.home?.services?.items || []).map((item) => `${item.title}: ${item.text}`).join("\n\n"),
    leftImage: profile.home?.gallery?.images?.[0]?.src || profile.home?.hero?.imageUrl || "",
    rightImage: profile.home?.gallery?.images?.[1]?.src || "",
    cardBackgroundColor: "#fff7ed",
  }));
  return blueprint;
}

function buildPortfolioBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  blueprint.pages[0].sections = blueprint.pages[0].sections.filter((sectionEntry) => sectionEntry.type !== "pricing-table");
  blueprint.pages[0].sections.splice(2, 0,
    buildParallax({
      title: "Use movement and atmosphere to make the portfolio feel curated, not templated",
      subtitle: "A premium creative site needs visual pacing between headline, work, and enquiry.",
      buttonLabel: "View Selected Work",
      buttonHref: "/portfolio",
      imageUrl: profile.home?.gallery?.images?.[2]?.src || profile.home?.hero?.imageUrl || "",
      floatingImage: profile.home?.gallery?.images?.[0]?.src || "",
      backgroundColor: "#1f1a42",
      buttonColor: "#c4b5fd",
      buttonTextColor: "#1e1b4b",
      minHeight: "72vh",
      contentWidth: 560,
    }, getVisualSystem(profile.templateSlug)),
    section("image-stack", {
      title: "Studio Visual Canvas",
      minHeight: "68vh",
      images: [
        { id: "creative-1", kind: "image", src: profile.home?.gallery?.images?.[0]?.src || profile.home?.hero?.imageUrl || "", x: 18, y: 18, width: 320, height: 220, rotation: -7, radius: 22, zIndex: 1 },
        { id: "creative-copy", kind: "text", content: profile.home?.hero?.title || "Curated work that feels like a point of view.", x: 58, y: 28, width: 420, height: 160, rotation: 0, radius: 18, zIndex: 2, fontSize: 34, fontWeight: "700", textAlign: "left", verticalAlign: "center", textColor: "#0f172a", background: "rgba(255,255,255,0.92)" },
        { id: "creative-2", kind: "image", src: profile.home?.gallery?.images?.[1]?.src || profile.home?.hero?.imageUrl || "", x: 72, y: 62, width: 280, height: 220, rotation: 6, radius: 22, zIndex: 3 },
      ],
    }),
    buildColumns2({
      ratio: "40-60",
      leftTitle: "Creative perspective",
      leftContent: profile.about?.text || "Explain the studio voice and how the work is shaped.",
      rightTitle: "Selected work lens",
      rightContent: (profile.proofPage?.stats?.items || []).map((item) => `${item.label}: ${item.value}`).join("\n\n") || "Use this page to frame outcomes and creative direction.",
      leftImage: profile.about?.imageUrl || "",
      cardBackgroundColor: "#f5f3ff",
    })
  );
  return blueprint;
}

function buildAgencyBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  blueprint.pages[0].sections.splice(2, 0, buildParallax({
    title: "This is where a strong agency site should feel expensive, fast, and commercially switched on",
    subtitle: "Use parallax and motion to sell the pace of execution before the capability sections begin.",
    buttonLabel: "See Results",
    buttonHref: "/results",
    imageUrl: profile.home?.hero?.imageUrl || "",
    floatingImage: profile.proofPage?.gallery?.images?.[0]?.src || "",
    minHeight: "68vh",
  }, getVisualSystem(profile.templateSlug)));
  return blueprint;
}

function buildCoachBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  blueprint.pages[0].sections.splice(2, 0, buildParallax({
    title: "A premium coaching site should feel like an invitation into a worldview, not a generic service card grid",
    subtitle: "This section gives the personal brand some drama and pacing before the offer stack begins.",
    buttonLabel: "Read the Story",
    buttonHref: "/about",
    imageUrl: profile.home?.hero?.imageUrl || "",
    backgroundColor: "#3b1f0f",
    buttonColor: "#f59e0b",
    buttonTextColor: "#2b1707",
    minHeight: "70vh",
    contentWidth: 540,
  }, getVisualSystem(profile.templateSlug)));
  return blueprint;
}

function buildLocalServiceBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  blueprint.pages[0].sections.splice(2, 0, buildParallax({
    title: "Local services need urgency, trust, and visible professionalism above the fold",
    subtitle: "A good starter here should feel dependable and ready to take the call, not like a generic brochure.",
    buttonLabel: "Request Service",
    buttonHref: "/contact",
    imageUrl: profile.home?.hero?.imageUrl || "",
    backgroundColor: "#0b3b33",
    buttonColor: "#14b8a6",
    buttonTextColor: "#042f2e",
    minHeight: "64vh",
  }, getVisualSystem(profile.templateSlug)));
  return blueprint;
}

function insertTradeShowcase(blueprint, profile, options = {}) {
  const homeSections = blueprint?.pages?.[0]?.sections;
  if (!Array.isArray(homeSections)) return blueprint;

  const marqueeIndex = homeSections.findIndex((section) => section?.type === 'marquee-strip');
  const insertAt = typeof options.insertIndex === 'number'
    ? options.insertIndex
    : marqueeIndex >= 0
      ? marqueeIndex + 1
      : 2;

  homeSections.splice(insertAt, 0,
    buildParallax({
      title: options.parallaxTitle,
      subtitle: options.parallaxSubtitle,
      buttonLabel: options.parallaxButtonLabel || (profile.navCtaLabel || 'Contact'),
      buttonHref: options.parallaxButtonHref || (profile.navCtaHref || '/contact'),
      imageUrl: profile.home?.gallery?.images?.[0]?.src || profile.home?.hero?.imageUrl || '',
      floatingImage: profile.home?.gallery?.images?.[1]?.src || profile.about?.imageUrl || '',
      backgroundColor: options.parallaxBackgroundColor,
      buttonColor: options.parallaxButtonColor,
      buttonTextColor: options.parallaxButtonTextColor,
      minHeight: options.parallaxMinHeight || '68vh',
      contentWidth: options.parallaxContentWidth || 560,
      floatingWidth: options.floatingWidth || 280,
      floatingHeight: options.floatingHeight || 220,
    }, getVisualSystem(profile.templateSlug)),
    section('image-stack', {
      title: options.stackTitle,
      minHeight: options.stackMinHeight || '760px',
      images: [
        { id: `${profile.templateSlug}-stack-1`, kind: 'image', src: profile.home?.gallery?.images?.[0]?.src || profile.home?.hero?.imageUrl || '', x: 36, y: 36, width: 360, height: 250, rotation: -4, radius: 24, zIndex: 1 },
        { id: `${profile.templateSlug}-stack-copy`, kind: 'text', content: options.stackCopy, x: 430, y: 42, width: 500, height: 210, rotation: 0, radius: 24, zIndex: 3, fontSize: options.stackFontSize || 28, fontWeight: '700', textAlign: 'left', verticalAlign: 'center', textColor: options.stackTextColor || '#0f172a', background: options.stackTextBackground || 'rgba(255,255,255,0.94)' },
        { id: `${profile.templateSlug}-stack-2`, kind: 'image', src: profile.home?.gallery?.images?.[1]?.src || profile.about?.imageUrl || '', x: 120, y: 332, width: 300, height: 220, rotation: -3, radius: 24, zIndex: 2 },
        { id: `${profile.templateSlug}-stack-3`, kind: 'image', src: profile.proofPage?.gallery?.images?.[0]?.src || profile.home?.gallery?.images?.[2]?.src || '', x: 560, y: 312, width: 340, height: 240, rotation: 5, radius: 24, zIndex: 1 },
      ],
    }),
    buildColumns2({
      ratio: options.columnsRatio || '50-50',
      leftTitle: options.columnsLeftTitle,
      leftContent: options.columnsLeftContent,
      rightTitle: options.columnsRightTitle,
      rightContent: options.columnsRightContent,
      leftImage: options.columnsLeftImage ? (profile.home?.gallery?.images?.[2]?.src || profile.about?.imageUrl || '') : '',
      rightImage: profile.about?.imageUrl || profile.home?.gallery?.images?.[1]?.src || profile.home?.hero?.imageUrl || '',
      cardBackgroundColor: options.columnsCardBackground || '#f8fafc',
    })
  );

  return blueprint;
}

function buildPlumbingBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  return insertTradeShowcase(blueprint, profile, {
    parallaxTitle: 'Plumbing websites should feel urgent, capable, and visibly practical, not like abstract agency templates.',
    parallaxSubtitle: 'Use large imagery, motion, and service-specific proof to show leaks, hot water, drains, and maintenance work with more visual confidence.',
    parallaxBackgroundColor: '#0b3b5b',
    parallaxButtonColor: '#38bdf8',
    parallaxButtonTextColor: '#082f49',
    stackTitle: 'Plumbing proof canvas',
    stackCopy: 'Show vans, technicians, bathrooms, hot water, and completed repair work so the page feels grounded in the trade.',
    columnsLeftTitle: 'What plumbing buyers want to see fast',
    columnsLeftContent: 'Emergency readiness, clean communication, local coverage, visible workmanship, and a clear quote path.',
    columnsRightTitle: 'What this layout is selling visually',
    columnsRightContent: 'Urgent repairs, planned maintenance, hot water replacements, and the kind of practical trust markers that matter before a call-out.',
    columnsCardBackground: '#e0f2fe',
  });
}

function buildElectricalBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  return insertTradeShowcase(blueprint, profile, {
    parallaxTitle: 'Electrical websites need sharper contrast, more technical confidence, and more motion than generic local-service pages.',
    parallaxSubtitle: 'The goal here is clean competence: switchboards, lighting, compliance, fault-finding, and polished visuals that feel engineered.',
    parallaxBackgroundColor: '#111827',
    parallaxButtonColor: '#fbbf24',
    parallaxButtonTextColor: '#1f2937',
    stackTitle: 'Electrical systems canvas',
    stackCopy: 'Use layered product, panel, wiring, and onsite imagery to make the brand feel licensed, organised, and technically credible.',
    columnsLeftTitle: 'What electrical visitors are scanning for',
    columnsLeftContent: 'Licensing cues, safety language, upgrade categories, fast response, and signs that the business actually understands the scope.',
    columnsRightTitle: 'How this template differs from plumbing',
    columnsRightContent: 'It leans cleaner, more structured, and more technical, with darker contrast, stronger light accents, and less domestic warmth.',
    columnsCardBackground: '#fef3c7',
  });
}

function buildHvacBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  return insertTradeShowcase(blueprint, profile, {
    parallaxTitle: 'HVAC and air conditioning pages should sell comfort, airflow, system performance, and service response through richer visual pacing.',
    parallaxSubtitle: 'Use a cooler palette, equipment imagery, and motion-led sections so the site feels like climate control, not another contractor brochure.',
    parallaxBackgroundColor: '#075985',
    parallaxButtonColor: '#67e8f9',
    parallaxButtonTextColor: '#083344',
    stackTitle: 'Climate-control visual stack',
    stackCopy: 'Layer indoor comfort, equipment, technicians, and property scenes so installs and service plans feel tangible.',
    columnsLeftTitle: 'What HVAC buyers need clarified',
    columnsLeftContent: 'System type, service model, emergency support, maintenance plans, and whether the business works across homes and commercial sites.',
    columnsRightTitle: 'Why the page should feel different',
    columnsRightContent: 'This version uses cleaner product-style rhythm and cooler tones to frame reliability, airflow, and ongoing maintenance rather than one-off repair only.',
    columnsCardBackground: '#e0f7ff',
  });
}

function buildRoofingBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  return insertTradeShowcase(blueprint, profile, {
    parallaxTitle: 'Roofing templates need high-drama proof, elevation, and project weight, because buyers are thinking about risk and visible outcomes.',
    parallaxSubtitle: 'Use bigger imagery, warmer tones, and layered project visuals to frame inspections, re-roofs, repairs, and storm response as serious work.',
    parallaxBackgroundColor: '#4a2410',
    parallaxButtonColor: '#fb923c',
    parallaxButtonTextColor: '#431407',
    stackTitle: 'Roofing project showcase',
    stackCopy: 'Make the page feel like projects, access, height, and visible workmanship, not a soft lifestyle brochure.',
    columnsLeftTitle: 'What this layout needs to communicate',
    columnsLeftContent: 'Inspection process, visible proof, project scope, storm readiness, and enough authority for larger roofing jobs.',
    columnsRightTitle: 'Why roofing should feel heavier',
    columnsRightContent: 'The visuals should suggest project scale and risk management, which is very different from the faster, service-call feel of plumbing or electrical.',
    columnsCardBackground: '#ffedd5',
  });
}

function buildCleaningBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  return insertTradeShowcase(blueprint, profile, {
    parallaxTitle: 'Cleaning sites convert better when they feel polished, airy, and visually cared for, with far more imagery than a text-first local-service page.',
    parallaxSubtitle: 'Use lighter surfaces, domestic scenes, checklists, and before-and-after atmosphere so visitors can feel presentation and trust.',
    parallaxBackgroundColor: '#dffaf7',
    parallaxButtonColor: '#14b8a6',
    parallaxButtonTextColor: '#ecfeff',
    stackTitle: 'Cleaning brand moodboard',
    stackCopy: 'Layer property scenes, polished surfaces, team imagery, and soft editorial spacing so recurring cleaning feels premium and calm.',
    stackTextColor: '#134e4a',
    stackTextBackground: 'rgba(255,255,255,0.95)',
    columnsLeftTitle: 'Why cleaning needs more images',
    columnsLeftContent: 'People are buying trust, presentation, care, and consistency. Imagery does more work here than generic claims ever will.',
    columnsRightTitle: 'How this differs from trade pages',
    columnsRightContent: 'This version is lighter, calmer, and more editorial. It is designed to feel neat and reassuring instead of urgent or industrial.',
    columnsCardBackground: '#ecfdf5',
  });
}

function buildLandscapingBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  return insertTradeShowcase(blueprint, profile, {
    parallaxTitle: 'Landscaping pages should feel lush, outdoor, and transformation-led, with layered photography doing a lot of the selling work.',
    parallaxSubtitle: 'Use larger garden and property imagery so the site sells atmosphere, curb appeal, and project outcomes before the quote request.',
    parallaxBackgroundColor: '#1f4d2b',
    parallaxButtonColor: '#84cc16',
    parallaxButtonTextColor: '#1a2e05',
    stackTitle: 'Outdoor transformation board',
    stackCopy: 'Build a more visual site around lawns, gardens, hardscape edges, and the overall feel of a finished outdoor space.',
    columnsLeftTitle: 'What outdoor-service buyers respond to',
    columnsLeftContent: 'Before-and-after style proof, maintenance credibility, seasonal value, and clear project types they can picture on their own property.',
    columnsRightTitle: 'Why this should not look like electrical',
    columnsRightContent: 'The page should feel organic, greener, and more spatial, with softer rhythm and broader property photography rather than technical contrast.',
    columnsCardBackground: '#ecfccb',
  });
}

function buildPestControlBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  return insertTradeShowcase(blueprint, profile, {
    parallaxTitle: 'Pest control pages need reassurance, inspection credibility, and a stronger sense of property protection than generic trade layouts.',
    parallaxSubtitle: 'Use structured imagery and darker contrast to make treatment plans, inspections, and ongoing protection feel methodical and professional.',
    parallaxBackgroundColor: '#1f2937',
    parallaxButtonColor: '#22c55e',
    parallaxButtonTextColor: '#052e16',
    stackTitle: 'Inspection and protection stack',
    stackCopy: 'Show home environments, technicians, inspection moments, and controlled treatment visuals so the site feels calm and competent.',
    columnsLeftTitle: 'What pest visitors need from the page',
    columnsLeftContent: 'A sense of fast help, inspection structure, treatment clarity, and confidence that the business is practical rather than alarmist.',
    columnsRightTitle: 'Why this layout needs control',
    columnsRightContent: 'Unlike cleaning or landscaping, the tone here should feel measured and protective, with stronger structure and less decorative softness.',
    columnsCardBackground: '#dcfce7',
  });
}

function buildEcommerceBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  return insertTradeShowcase(blueprint, profile, {
    parallaxTitle: 'An online store should feel merchandised and editorial, with product atmosphere and collection movement built into the homepage.',
    parallaxSubtitle: 'Use richer image stacks, wider galleries, and a more fashion-forward rhythm so the storefront feels shoppable rather than brochure-like.',
    parallaxButtonLabel: 'Shop now',
    parallaxButtonHref: '/services',
    parallaxBackgroundColor: '#18181b',
    parallaxButtonColor: '#f97316',
    parallaxButtonTextColor: '#fff7ed',
    stackTitle: 'Collection spotlight canvas',
    stackCopy: 'Build visual momentum with lifestyle imagery, collection framing, product curation, and stronger editorial composition.',
    stackTextColor: '#18181b',
    columnsLeftTitle: 'What the homepage must do',
    columnsLeftContent: 'Move visitors into collections quickly, reinforce product trust, and make merchandising feel intentional from the first scroll.',
    columnsRightTitle: 'Why ecommerce must diverge hard from trades',
    columnsRightContent: 'This version is less about quote friction and more about browsing flow, brand atmosphere, and product discovery. It should look like a store.',
    columnsCardBackground: '#ffedd5',
  });
}

function buildSolarBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  return insertTradeShowcase(blueprint, profile, {
    parallaxTitle: 'Solar pages should feel cleaner, brighter, and more future-facing than a generic contractor website.',
    parallaxSubtitle: 'Use rooftop, panel, and energy visuals to make the install process and long-term value feel concrete before the quote.',
    parallaxBackgroundColor: '#1e293b',
    parallaxButtonColor: '#facc15',
    parallaxButtonTextColor: '#422006',
    stackTitle: 'Solar system visual board',
    stackCopy: 'Layer rooftops, panels, home scenes, and energy conversations so the site feels like a real solar provider with visible outcomes.',
    columnsLeftTitle: 'What solar buyers need clarified',
    columnsLeftContent: 'System fit, savings, battery options, install process, and whether the provider feels trustworthy enough to invite onsite.',
    columnsRightTitle: 'Why the page should feel optimistic',
    columnsRightContent: 'This version should feel brighter and more future-facing than standard trade pages because the category is part infrastructure and part lifestyle upgrade.',
    columnsCardBackground: '#fef9c3',
  });
}

function buildPoolServiceBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  return insertTradeShowcase(blueprint, profile, {
    parallaxTitle: 'Pool service sites should feel calm, premium, and presentation-led, with much stronger water and outdoor imagery than a normal service site.',
    parallaxSubtitle: 'Use polished outdoor visuals, water color, and recurring-service cues so the brand feels premium and well maintained.',
    parallaxBackgroundColor: '#dff9ff',
    parallaxButtonColor: '#06b6d4',
    parallaxButtonTextColor: '#ecfeff',
    stackTitle: 'Pool presentation stack',
    stackCopy: 'Use layered pool and outdoor imagery to make cleanliness, care, and recurring maintenance feel desirable before the enquiry.',
    stackTextColor: '#155e75',
    columnsLeftTitle: 'What this category sells visually',
    columnsLeftContent: 'Clean water, premium property presentation, recurring maintenance confidence, and the feeling that the space will stay ready to use.',
    columnsRightTitle: 'Why it should not look like plumbing',
    columnsRightContent: 'This version is softer and more aspirational, with more emphasis on presentation and outdoor lifestyle rather than urgency and repairs.',
    columnsCardBackground: '#cffafe',
  });
}

function buildAutoRepairBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  return insertTradeShowcase(blueprint, profile, {
    parallaxTitle: 'Auto repair templates need workshop grit, vehicle imagery, and repair confidence instead of the cleaner rhythm used for home-service brands.',
    parallaxSubtitle: 'Use workshop visuals, car scenes, and stronger contrast so servicing and diagnostics feel practical and trustworthy.',
    parallaxBackgroundColor: '#1f2937',
    parallaxButtonColor: '#f97316',
    parallaxButtonTextColor: '#fff7ed',
    stackTitle: 'Workshop proof stack',
    stackCopy: 'Layer vehicles, workshop scenes, and practical service visuals so the page feels grounded in real repair work.',
    columnsLeftTitle: 'What vehicle owners need to trust',
    columnsLeftContent: 'That the workshop is competent, communicative, fairly run, and able to deal with both routine servicing and more stressful repair jobs.',
    columnsRightTitle: 'Why this layout needs more grit',
    columnsRightContent: 'The visuals here should feel more mechanical and practical, with workshop atmosphere and repair cues replacing domestic or lifestyle softness.',
    columnsCardBackground: '#ffedd5',
  });
}

function buildMortgageBrokerBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  const homeSections = blueprint?.pages?.[0]?.sections;
  if (!Array.isArray(homeSections)) return blueprint;

  const system = getVisualSystem(profile.templateSlug);
  const heroIndex = homeSections.findIndex((section) => section?.type === 'hero');
  if (heroIndex >= 0) {
    homeSections[heroIndex] = {
      ...homeSections[heroIndex],
      props: {
        ...homeSections[heroIndex].props,
        headline: profile.home?.hero?.title || 'Mortgage advice that makes borrowers feel clear and ready to act',
        subheadline: profile.home?.hero?.subtitle || 'Built for first-home buyers, refinancers, and investors who need calmer guidance, lender clarity, and a stronger reason to book a finance strategy call.',
        contentWidth: 700,
        headlineFontSize: 52,
        subheadlineFontSize: 17,
        contentX: 31,
        contentY: 50,
      },
    };
  }

  const showcaseIndex = homeSections.findIndex((section) => section?.type === 'image-stack');
  if (showcaseIndex >= 0) {
    homeSections.splice(showcaseIndex, 1);
  }

  const firstColumnsIndex = homeSections.findIndex((section) => section?.type === 'columns-2');
  if (firstColumnsIndex >= 0) {
    homeSections[firstColumnsIndex] = buildColumns2({
      ratio: '50-50',
      leftTitle: 'Borrowers need a path, not a wall of finance jargon',
      leftContent: 'First-home buyers, refinancers, and investors usually arrive unsure about timing, lender fit, borrowing power, and what paperwork matters most. This section should make the process feel staged, calm, and easier to begin.\n\nUse it to explain what happens in the first strategy call, what to prepare, and how the broker narrows down the right lending path.',
      rightTitle: 'What a stronger broker homepage should do',
      rightContent: 'Show the main borrowing scenarios clearly.\n\nPosition the broker as a guide, not just a lead form.\n\nUse property imagery, lender context, and visible next steps so visitors feel more prepared before they enquire.',
      leftImage: profile.home?.gallery?.images?.[1]?.src || profile.home?.hero?.imageUrl || '',
      rightImage: profile.about?.imageUrl || profile.home?.gallery?.images?.[2]?.src || '',
      cardBackgroundColor: '#eff6ff',
    });
  }

  const marqueeIndex = homeSections.findIndex((section) => section?.type === 'marquee-strip');
  const insertAt = marqueeIndex >= 0 ? marqueeIndex + 1 : 2;
  homeSections.splice(insertAt, 0, buildParallax({
    title: 'A broker homepage should feel calm, lender-savvy, and property-aware before the service cards even begin.',
    subtitle: 'Use cleaner property imagery, borrower guidance, and motion-led pacing so the visitor feels guided rather than sold to.',
    buttonLabel: profile.navCtaLabel || 'Book finance call',
    buttonHref: profile.navCtaHref || '/contact',
    imageUrl: profile.home?.gallery?.images?.[1]?.src || profile.home?.hero?.imageUrl || '',
    floatingImage: profile.about?.imageUrl || profile.home?.gallery?.images?.[2]?.src || '',
    backgroundColor: '#eff6ff',
    buttonColor: '#1d4ed8',
    buttonTextColor: '#eff6ff',
    headlineColor: '#0f172a',
    textColor: '#1e3a8a',
    minHeight: '66vh',
    contentWidth: 540,
    floatingWidth: 300,
    floatingHeight: 220,
  }, system));

  return blueprint;
}

function buildTemplateBlueprintBySlug(templateSlug, profile) {
  const enrichedProfile = { ...profile, templateSlug };
  switch (templateSlug) {
    case "website-generic-premium":
      return buildGenericPremiumBlueprint(enrichedProfile);
    case "website-business-agency":
      return buildAgencyBlueprint(enrichedProfile);
    case "website-coach-personal-brand":
      return buildCoachBlueprint(enrichedProfile);
    case "website-local-service":
      return buildLocalServiceBlueprint(enrichedProfile);
    case "website-saas-simple":
      return buildSaasBlueprint(enrichedProfile);
    case "website-restaurant-cafe":
      return buildRestaurantBlueprint(enrichedProfile);
    case "website-portfolio-creative":
      return buildPortfolioBlueprint(enrichedProfile);
    case "website-medical-clinic":
      return buildMedicalBlueprint(enrichedProfile);
    case "website-law-firm":
      return buildLawBlueprint(enrichedProfile);
    case "website-real-estate":
      return buildRealEstateBlueprint(enrichedProfile);
    case "website-salon-spa":
      return buildSalonSpaBlueprint(enrichedProfile);
    case "website-fitness-gym":
      return buildFitnessBlueprint(enrichedProfile);
    case "website-home-renovation":
      return buildHomeRenovationBlueprint(enrichedProfile);
    case "website-residential-home-builder":
      return buildResidentialHomeBuilderBlueprint(enrichedProfile);
    case "website-accounting-bookkeeping":
      return buildAccountingBlueprint(enrichedProfile);
    case "website-plumbing-company":
      return buildPlumbingBlueprint(enrichedProfile);
    case "website-electrician-company":
      return buildElectricalBlueprint(enrichedProfile);
    case "website-hvac-air-conditioning":
      return buildHvacBlueprint(enrichedProfile);
    case "website-roofing-company":
      return buildRoofingBlueprint(enrichedProfile);
    case "website-cleaning-services":
      return buildCleaningBlueprint(enrichedProfile);
    case "website-landscaping-lawn-care":
      return buildLandscapingBlueprint(enrichedProfile);
    case "website-pest-control":
      return buildPestControlBlueprint(enrichedProfile);
    case "website-solar-energy":
      return buildSolarBlueprint(enrichedProfile);
    case "website-pool-service":
      return buildPoolServiceBlueprint(enrichedProfile);
    case "website-auto-repair":
      return buildAutoRepairBlueprint(enrichedProfile);
    case "website-mortgage-broker":
      return buildMortgageBrokerBlueprint(enrichedProfile);
    case "website-ecommerce-store":
      return buildEcommerceBlueprint(enrichedProfile);
    default:
      return buildServiceFirmBlueprint(enrichedProfile);
  }
}

export function buildWebsiteTemplateBlueprint(templateSlug, profile) {
  if (!profile) return null;
  const enrichedProfile = attachTeamMemberImages({ ...profile, templateSlug });
  const blueprint = buildTemplateBlueprintBySlug(templateSlug, enrichedProfile);
  return normalizeBlueprintLinks(enrichBlueprintImages(blueprint, enrichedProfile));
}
