// /lib/website-builder/templates.js
// MIT-safe, native GR8 templates + themes (NO iframe, NO wordpress, NO grapes)

export const THEMES = [
  {
    slug: "modern-blue",
    name: "Modern Blue",
    tokens: {
      pageBg: "#0b1220",
      surface: "#0f1b33",
      surface2: "#0b1530",
      border: "rgba(148,163,184,0.18)",
      text: "#e5e7eb",
      muted: "#9ca3af",
      heading: "#ffffff",
      primary: "#3b82f6",
      primaryText: "#eaf2ff",
      accent: "#22c55e",
      accentText: "#062a12",
      radius: 14,
      buttonRadius: 999,
      maxWidth: 1180,
      font: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto",
    },
  },
  {
    slug: "modern-dark",
    name: "Modern Dark",
    tokens: {
      pageBg: "#070b12",
      surface: "#0c1220",
      surface2: "#0b1020",
      border: "rgba(148,163,184,0.16)",
      text: "#e5e7eb",
      muted: "#a3a3a3",
      heading: "#ffffff",
      primary: "#a855f7",
      primaryText: "#faf5ff",
      accent: "#f97316",
      accentText: "#2a1206",
      radius: 14,
      buttonRadius: 12,
      maxWidth: 1180,
      font: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto",
    },
  },
  {
    slug: "warm-sand",
    name: "Warm Sand",
    tokens: {
      pageBg: "#0a0b0d",
      surface: "#101318",
      surface2: "#0d1015",
      border: "rgba(255,255,255,0.10)",
      text: "#f3f4f6",
      muted: "#cbd5e1",
      heading: "#ffffff",
      primary: "#f59e0b",
      primaryText: "#1f1200",
      accent: "#60a5fa",
      accentText: "#031528",
      radius: 16,
      buttonRadius: 999,
      maxWidth: 1180,
      font: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto",
    },
  },
  {
    slug: "bold-green",
    name: "Bold Green",
    tokens: {
      pageBg: "#07160f",
      surface: "#0a2217",
      surface2: "#081c14",
      border: "rgba(34,197,94,0.18)",
      text: "#dcfce7",
      muted: "rgba(220,252,231,0.75)",
      heading: "#f0fdf4",
      primary: "#22c55e",
      primaryText: "#052e16",
      accent: "#60a5fa",
      accentText: "#041a2c",
      radius: 14,
      buttonRadius: 999,
      maxWidth: 1180,
      font: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto",
    },
  },
];

const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id_${Math.random().toString(16).slice(2)}_${Date.now()}`);

const basePage = (themeSlug = "modern-blue") => ({
  version: 1,
  theme_slug: themeSlug,
  site: {
    logoText: "GR8 RESULT",
    nav: [
      { label: "Home", href: "#home" },
      { label: "About", href: "#about" },
      { label: "Services", href: "#services" },
      { label: "Contact", href: "#contact" },
    ],
  },
  pages: [
    {
      slug: "home",
      title: "Home",
      sections: [],
    },
  ],
});

const S = {
  header: (over = {}) => ({
    id: uid(),
    type: "header",
    props: {
      brand: "Your Brand",
      links: [
        { label: "Home", href: "#home" },
        { label: "About", href: "#about" },
        { label: "Services", href: "#services" },
        { label: "Contact", href: "#contact" },
      ],
      ctaLabel: "Get Started",
      ctaHref: "#contact",
      ...over,
    },
  }),
  hero: (over = {}) => ({
    id: uid(),
    type: "hero",
    props: {
      eyebrow: "WELCOME",
      title: "A clear headline that sells the outcome",
      subtitle:
        "Short supporting copy that explains who this is for and why it matters. Keep it simple and direct.",
      primaryLabel: "Book a Call",
      primaryHref: "#contact",
      secondaryLabel: "See Services",
      secondaryHref: "#services",
      imageUrl:
        "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=80",
      ...over,
    },
  }),
  features: (over = {}) => ({
    id: uid(),
    type: "features",
    props: {
      title: "What you get",
      subtitle: "Three core benefits (keep it tight).",
      items: [
        { title: "Benefit 1", text: "Explain the value in one sentence." },
        { title: "Benefit 2", text: "Explain the value in one sentence." },
        { title: "Benefit 3", text: "Explain the value in one sentence." },
      ],
      ...over,
    },
  }),
  services: (over = {}) => ({
    id: uid(),
    type: "services",
    props: {
      title: "Services",
      subtitle: "What you offer and what it does for them.",
      items: [
        { title: "Service 1", text: "Short description." },
        { title: "Service 2", text: "Short description." },
        { title: "Service 3", text: "Short description." },
      ],
      ...over,
    },
  }),
  about: (over = {}) => ({
    id: uid(),
    type: "about",
    props: {
      title: "About",
      text:
        "Write a short, human story. Who you are, who you help, and why you care. 4–6 lines is enough.",
      bullets: ["Trusted experience", "Clear process", "Real results"],
      imageUrl:
        "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=80",
      ...over,
    },
  }),
  testimonials: (over = {}) => ({
    id: uid(),
    type: "testimonials",
    props: {
      title: "Results & feedback",
      items: [
        {
          quote:
            "Replace this with a real testimonial. One to two sentences maximum.",
          name: "Client Name",
          role: "Role / Company",
        },
        {
          quote:
            "Replace this with a real testimonial. One to two sentences maximum.",
          name: "Client Name",
          role: "Role / Company",
        },
      ],
      ...over,
    },
  }),
  pricing: (over = {}) => ({
    id: uid(),
    type: "pricing",
    props: {
      title: "Simple pricing",
      subtitle: "Keep it easy to decide.",
      plans: [
        {
          name: "Starter",
          price: "$49",
          period: "/mo",
          bullets: ["Feature A", "Feature B", "Feature C"],
          primary: false,
        },
        {
          name: "Growth",
          price: "$79",
          period: "/mo",
          bullets: ["Everything in Starter", "Feature D", "Feature E"],
          primary: true,
        },
        {
          name: "Scale",
          price: "$299",
          period: "/mo",
          bullets: ["Everything in Growth", "Advanced automations", "A/B testing"],
          primary: false,
        },
      ],
      ...over,
    },
  }),
  faq: (over = {}) => ({
    id: uid(),
    type: "faq",
    props: {
      title: "FAQ",
      items: [
        { q: "How does it work?", a: "Answer in 1–2 sentences." },
        { q: "How fast can I start?", a: "Answer in 1–2 sentences." },
        { q: "Do you offer support?", a: "Answer in 1–2 sentences." },
      ],
      ...over,
    },
  }),
  cta: (over = {}) => ({
    id: uid(),
    type: "cta",
    props: {
      title: "Ready to go?",
      subtitle: "One clear next step. No waffle.",
      buttonLabel: "Get Started",
      buttonHref: "#contact",
      ...over,
    },
  }),
  contact: (over = {}) => ({
    id: uid(),
    type: "contact",
    props: {
      title: "Contact",
      subtitle: "Add a form later; for now, put your preferred contact details here.",
      email: "hello@yourdomain.com",
      phone: "+61 4xx xxx xxx",
      address: "Your City, AU",
      ...over,
    },
  }),
  footer: (over = {}) => ({
    id: uid(),
    type: "footer",
    props: {
      text: "© " + new Date().getFullYear() + " Your Brand. All rights reserved.",
      links: [
        { label: "Privacy", href: "#" },
        { label: "Terms", href: "#" },
      ],
      ...over,
    },
  }),

  // Funnel sections
  optinHero: (over = {}) => ({
    id: uid(),
    type: "optin_hero",
    props: {
      eyebrow: "FREE DOWNLOAD",
      title: "Get the blueprint that shows you exactly what to do next",
      subtitle:
        "Explain the lead magnet in one sentence. Tell them what changes after they read it.",
      bullets: ["Step-by-step plan", "Templates + examples", "No fluff"],
      formTitle: "Send it to me",
      buttonLabel: "Get Instant Access",
      disclaimer: "We respect your privacy. Unsubscribe anytime.",
      imageUrl:
        "https://images.unsplash.com/photo-1454165205744-3b78555e5572?auto=format&fit=crop&w=1600&q=80",
      ...over,
    },
  }),
  salesHero: (over = {}) => ({
    id: uid(),
    type: "sales_hero",
    props: {
      eyebrow: "NEW OFFER",
      title: "This is the sales page headline (promise a result)",
      subtitle:
        "Support it with a short explanation of who it’s for and what it does.",
      buttonLabel: "Buy Now",
      buttonHref: "#checkout",
      mediaType: "image", // image | video
      mediaUrl:
        "https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=1600&q=80",
      ...over,
    },
  }),
  checkout: (over = {}) => ({
    id: uid(),
    type: "checkout",
    props: {
      title: "Checkout",
      productName: "Your Product",
      price: "$199",
      bullets: ["What’s included 1", "What’s included 2", "What’s included 3"],
      guarantee: "14-day money-back guarantee.",
      buttonLabel: "Complete Purchase",
      note: "Payment integration later (Stripe). For now this is a layout.",
      ...over,
    },
  }),
  thankyou: (over = {}) => ({
    id: uid(),
    type: "thankyou",
    props: {
      title: "You're in!",
      subtitle:
        "Tell them what happens next. Provide the link, booking option, or next step.",
      primaryLabel: "Download / Access",
      primaryHref: "#",
      secondaryLabel: "Book a call",
      secondaryHref: "#",
      ...over,
    },
  }),
};

export const TEMPLATES = [
  // WEBSITE (6)
  {
    slug: "website-business-agency",
    type: "website",
    name: "Business / Agency",
    blurb: "Clean, modern agency site (hero → services → proof → contact).",
    thumb:
      "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => {
      const p = basePage(theme);
      p.pages[0].sections = [
        S.header(),
        S.hero({ title: "A modern website that converts visitors into leads" }),
        S.services(),
        S.features(),
        S.testimonials(),
        S.pricing(),
        S.faq(),
        S.contact(),
        S.footer(),
      ];
      return p;
    },
  },
  {
    slug: "website-coach-personal-brand",
    type: "website",
    name: "Coach / Personal Brand",
    blurb: "Personal brand layout with story + offer + testimonials.",
    thumb:
      "https://images.unsplash.com/photo-1522202195461-067b35f76f79?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => {
      const p = basePage(theme);
      p.pages[0].sections = [
        S.header({ ctaLabel: "Work With Me", ctaHref: "#pricing" }),
        S.hero({
          eyebrow: "COACHING",
          title: "Help people achieve a clear outcome (headline here)",
          primaryLabel: "Apply Now",
          primaryHref: "#pricing",
          secondaryLabel: "My Story",
          secondaryHref: "#about",
        }),
        S.about({ title: "My story" }),
        S.features({ title: "How I help" }),
        S.testimonials(),
        S.pricing({ title: "Work with me" }),
        S.faq(),
        S.contact(),
        S.footer(),
      ];
      return p;
    },
  },
  {
    slug: "website-local-service",
    type: "website",
    name: "Local Service",
    blurb: "Tradie/local business site with services + trust + contact.",
    thumb:
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => {
      const p = basePage(theme);
      p.pages[0].sections = [
        S.header({ ctaLabel: "Call Now", ctaHref: "#contact" }),
        S.hero({
          eyebrow: "LOCAL SERVICE",
          title: "Fast, reliable service in (Your City)",
          primaryLabel: "Get a Quote",
          primaryHref: "#contact",
          secondaryLabel: "Services",
          secondaryHref: "#services",
        }),
        S.services({ title: "What we do" }),
        S.testimonials({ title: "Trusted by locals" }),
        S.faq(),
        S.contact({
          subtitle: "Add opening hours and service area here.",
        }),
        S.footer(),
      ];
      return p;
    },
  },
  {
    slug: "website-saas-simple",
    type: "website",
    name: "SaaS / App",
    blurb: "SaaS marketing site with features + pricing + FAQ.",
    thumb:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => {
      const p = basePage(theme);
      p.pages[0].sections = [
        S.header({ ctaLabel: "Start Free", ctaHref: "#pricing" }),
        S.hero({
          eyebrow: "SOFTWARE",
          title: "One platform to run marketing, CRM, funnels and websites",
          primaryLabel: "Start free",
          primaryHref: "#pricing",
          secondaryLabel: "See features",
          secondaryHref: "#services",
        }),
        S.features({ title: "Core features" }),
        S.services({ title: "Use cases" }),
        S.pricing({ title: "Plans" }),
        S.faq(),
        S.cta({ buttonLabel: "Start now", buttonHref: "#pricing" }),
        S.footer(),
      ];
      return p;
    },
  },
  {
    slug: "website-restaurant-cafe",
    type: "website",
    name: "Restaurant / Cafe",
    blurb: "Menu highlights + social proof + bookings CTA.",
    thumb:
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => {
      const p = basePage(theme);
      p.pages[0].sections = [
        S.header({ ctaLabel: "Book a Table", ctaHref: "#contact" }),
        S.hero({
          eyebrow: "EAT & DRINK",
          title: "A simple headline for your venue",
          subtitle: "Add a short line about food style, location and vibe.",
          primaryLabel: "Book a table",
          primaryHref: "#contact",
          secondaryLabel: "Menu",
          secondaryHref: "#services",
        }),
        S.services({
          title: "Menu highlights",
          subtitle: "List a few signature items.",
          items: [
            { title: "Signature Dish", text: "Short description." },
            { title: "Popular Item", text: "Short description." },
            { title: "Seasonal Special", text: "Short description." },
          ],
        }),
        S.testimonials({ title: "Reviews" }),
        S.contact({ title: "Bookings & location" }),
        S.footer(),
      ];
      return p;
    },
  },
  {
    slug: "website-portfolio-creative",
    type: "website",
    name: "Portfolio / Creative",
    blurb: "Clean portfolio layout with work highlights + contact.",
    thumb:
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => {
      const p = basePage(theme);
      p.pages[0].sections = [
        S.header({ ctaLabel: "Hire Me", ctaHref: "#contact" }),
        S.hero({
          eyebrow: "PORTFOLIO",
          title: "Show your best work with a simple, modern site",
          primaryLabel: "View work",
          primaryHref: "#services",
          secondaryLabel: "Contact",
          secondaryHref: "#contact",
        }),
        S.services({
          title: "Featured work",
          subtitle: "Use these cards as portfolio items.",
          items: [
            { title: "Project 1", text: "What you did + result." },
            { title: "Project 2", text: "What you did + result." },
            { title: "Project 3", text: "What you did + result." },
          ],
        }),
        S.about({ title: "About me" }),
        S.contact(),
        S.footer(),
      ];
      return p;
    },
  },

  // FUNNELS / LANDING (6)
  {
    slug: "funnel-optin-lead-magnet",
    type: "funnel",
    name: "Opt-in / Lead Magnet",
    blurb: "Simple opt-in landing page for list growth.",
    thumb:
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => {
      const p = basePage(theme);
      p.pages[0].sections = [
        S.header({ ctaLabel: "Get it free", ctaHref: "#optin" }),
        S.optinHero(),
        S.testimonials({ title: "What people say" }),
        S.faq({ title: "Questions" }),
        S.footer(),
      ];
      return p;
    },
  },
  {
    slug: "funnel-sales-longform",
    type: "funnel",
    name: "Sales Page (Long Form)",
    blurb: "Long-form offer page with proof + FAQ + CTA.",
    thumb:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => {
      const p = basePage(theme);
      p.pages[0].sections = [
        S.header({ ctaLabel: "Buy now", ctaHref: "#checkout" }),
        S.salesHero(),
        S.features({ title: "What’s included" }),
        S.testimonials(),
        S.pricing({ title: "Choose your plan" }),
        S.faq(),
        S.cta({ title: "Ready?", buttonLabel: "Buy now", buttonHref: "#checkout" }),
        S.checkout(),
        S.footer(),
      ];
      return p;
    },
  },
  {
    slug: "funnel-checkout-page",
    type: "funnel",
    name: "Checkout Page",
    blurb: "Clean checkout layout (product + bullets + guarantee).",
    thumb:
      "https://images.unsplash.com/photo-1556745757-8d76bdb6984b?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => {
      const p = basePage(theme);
      p.pages[0].sections = [
        S.header({ ctaLabel: "Secure checkout", ctaHref: "#checkout" }),
        S.checkout(),
        S.faq({ title: "Before you buy" }),
        S.footer(),
      ];
      return p;
    },
  },
  {
    slug: "funnel-thankyou-page",
    type: "funnel",
    name: "Thank You Page",
    blurb: "Next steps page after opt-in or purchase.",
    thumb:
      "https://images.unsplash.com/photo-1520975867597-0f1b0a6b1b00?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => {
      const p = basePage(theme);
      p.pages[0].sections = [
        S.header({ ctaLabel: "Next step", ctaHref: "#next" }),
        S.thankyou(),
        S.cta({ title: "Want help implementing?", buttonLabel: "Book a call", buttonHref: "#contact" }),
        S.contact(),
        S.footer(),
      ];
      return p;
    },
  },
  {
    slug: "funnel-webinar-registration",
    type: "funnel",
    name: "Webinar Registration",
    blurb: "Webinar reg page with proof + CTA.",
    thumb:
      "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => {
      const p = basePage(theme);
      p.pages[0].sections = [
        S.header({ ctaLabel: "Register", ctaHref: "#optin" }),
        S.optinHero({
          eyebrow: "FREE TRAINING",
          title: "Register for the webinar (headline)",
          subtitle: "Explain who it’s for and what they’ll walk away with.",
          formTitle: "Reserve my seat",
          buttonLabel: "Register now",
        }),
        S.features({ title: "What you’ll learn" }),
        S.testimonials(),
        S.faq(),
        S.footer(),
      ];
      return p;
    },
  },
  {
    slug: "funnel-booking-application",
    type: "funnel",
    name: "Booking / Application",
    blurb: "Simple page to push people to book or apply.",
    thumb:
      "https://images.unsplash.com/photo-1551836022-deb4988cc6c0?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => {
      const p = basePage(theme);
      p.pages[0].sections = [
        S.header({ ctaLabel: "Apply", ctaHref: "#contact" }),
        S.hero({
          eyebrow: "APPLICATION",
          title: "Apply to work with us",
          subtitle: "Short qualifier line. Tell them who is a good fit.",
          primaryLabel: "Apply now",
          primaryHref: "#contact",
          secondaryLabel: "See results",
          secondaryHref: "#testimonials",
        }),
        S.testimonials(),
        S.contact({
          title: "Apply / Contact",
          subtitle: "You can swap this for a form later. For now, collect details here.",
        }),
        S.footer(),
      ];
      return p;
    },
  },
];

export function getTheme(themeSlug) {
  return THEMES.find((t) => t.slug === themeSlug) || THEMES[0];
}

export function getTemplate(templateSlug) {
  return TEMPLATES.find((t) => t.slug === templateSlug) || TEMPLATES[0];
}
