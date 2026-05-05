// --- Animated/External Templates ---
// Removed TEMPLATES.push. All templates should be defined inline in the TEMPLATES array below.

import { WEBSITE_TEMPLATE_PROFILES } from "./templateProfiles";
import { buildWebsiteTemplateBlueprint } from "./templateBlueprints";


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

const templatePage = (slug, title, sections, objective = "") => ({
  slug,
  title,
  objective,
  sections: Array.isArray(sections) ? sections.filter(Boolean) : [],
});

const staticSection = (type, props) => (props ? { type, props } : null);

function buildProfiledWebsite(theme, templateSlug) {
  const profile = WEBSITE_TEMPLATE_PROFILES[templateSlug];
  if (!profile) {
    return basePage(theme);
  }

  const blueprint = buildWebsiteTemplateBlueprint(templateSlug, profile);
  if (blueprint) {
    return {
      version: 1,
      theme_slug: theme,
      site: blueprint.site,
      pages: blueprint.pages,
    };
  }

  const aboutSlug = profile.about?.slug || "about";
  const servicesSlug = profile.servicesPage?.slug || "services";
  const contactSlug = profile.contactPage?.slug || "contact";
  const proofSlug = profile.proofPage?.slug || null;

  const pagesMeta = [
    { slug: "home", title: "Home" },
    { slug: aboutSlug, title: profile.about?.pageTitle || "About" },
    { slug: servicesSlug, title: profile.servicesPage?.pageTitle || "Services" },
    ...(proofSlug ? [{ slug: proofSlug, title: profile.proofPage?.pageTitle || "Results" }] : []),
    { slug: contactSlug, title: profile.contactPage?.pageTitle || "Contact" },
  ];

  const navLinks = pagesMeta.map((page) => ({
    label: page.title,
    href: page.slug === "home" ? "/" : `/${page.slug}`,
  }));

  const header = (overrides = {}) =>
    S.header({
      brand: profile.siteName,
      links: navLinks,
      ctaLabel: profile.navCtaLabel || "Contact",
      ctaHref: profile.navCtaHref || `/${contactSlug}`,
      ...overrides,
    });

  const footer = () =>
    S.footer({
      text: `© ${new Date().getFullYear()} ${profile.siteName}. All rights reserved.`,
      links: [
        { label: "Privacy", href: "#" },
        { label: "Terms", href: "#" },
      ],
    });

  const home = profile.home || {};
  const about = profile.about || {};
  const servicesPage = profile.servicesPage || {};
  const proofPage = profile.proofPage || null;
  const contactPage = profile.contactPage || {};

  return {
    version: 1,
    theme_slug: theme,
    site: {
      logoText: profile.siteName,
      nav: navLinks,
    },
    pages: [
      templatePage(
        "home",
        "Home",
        [
          header(),
          home.hero ? S.hero(home.hero) : null,
          staticSection("stats", home.stats),
          home.services ? S.services(home.services) : null,
          home.features ? S.features(home.features) : null,
          staticSection("gallery", home.gallery),
          staticSection("team", home.team),
          home.testimonials ? S.testimonials(home.testimonials) : null,
          home.pricing ? S.pricing(home.pricing) : null,
          home.faq ? S.faq(home.faq) : null,
          home.newsletter ? staticSection("newsletter", home.newsletter) : null,
          home.cta ? S.cta(home.cta) : null,
          footer(),
        ],
        home.objective || "Establish trust and present the core offer."
      ),
      templatePage(
        aboutSlug,
        about.pageTitle || "About",
        [
          header(),
          S.about({
            title: about.title || `About ${profile.siteName}`,
            text: about.text || "Add your origin story and positioning here.",
            bullets: about.bullets || [],
            imageUrl: about.imageUrl || "",
          }),
          staticSection("team", about.team),
          staticSection("stats", about.stats),
          about.testimonials ? S.testimonials(about.testimonials) : null,
          footer(),
        ],
        about.objective || "Build trust through the story and the people behind the business."
      ),
      templatePage(
        servicesSlug,
        servicesPage.pageTitle || "Services",
        [
          header(),
          servicesPage.hero ? S.hero(servicesPage.hero) : null,
          servicesPage.services ? S.services(servicesPage.services) : null,
          servicesPage.features ? S.features(servicesPage.features) : null,
          servicesPage.pricing ? S.pricing(servicesPage.pricing) : null,
          servicesPage.faq ? S.faq(servicesPage.faq) : null,
          servicesPage.cta ? S.cta(servicesPage.cta) : null,
          footer(),
        ],
        servicesPage.objective || "Explain the core offers and how buyers can move forward."
      ),
      ...(proofPage
        ? [
            templatePage(
              proofSlug,
              proofPage.pageTitle || "Results",
              [
                header(),
                proofPage.hero ? S.hero(proofPage.hero) : null,
                staticSection("gallery", proofPage.gallery),
                staticSection("stats", proofPage.stats),
                proofPage.testimonials ? S.testimonials(proofPage.testimonials) : null,
                proofPage.cta ? S.cta(proofPage.cta) : null,
                footer(),
              ],
              proofPage.objective || "Use proof, visuals, and results to reinforce the buying decision."
            ),
          ]
        : []),
      templatePage(
        contactSlug,
        contactPage.pageTitle || "Contact",
        [
          header(),
          contactPage.hero ? S.hero(contactPage.hero) : null,
          contactPage.contact ? S.contact(contactPage.contact) : null,
          contactPage.faq ? S.faq(contactPage.faq) : null,
          footer(),
        ],
        contactPage.objective || "Capture qualified enquiries and make the next step clear."
      ),
    ],
  };
}

const directBlock = (type, props = {}) => ({
  id: uid(),
  direct: true,
  type,
  props,
});

function buildFunnelTemplate(theme, config) {
  const brand = config.brand || "Growth Atelier";
  const palette = {
    navBg: config.palette?.navBg || "#071521",
    navText: config.palette?.navText || "#e0f2fe",
    navButtonBg: config.palette?.navButtonBg || "#22c55e",
    navButtonText: config.palette?.navButtonText || "#052e1a",
    heroBg: config.palette?.heroBg || "#0f172a",
    heroText: config.palette?.heroText || "#dbeafe",
    heroHeadline: config.palette?.heroHeadline || "#ffffff",
    heroButtonBg: config.palette?.heroButtonBg || "#22c55e",
    heroButtonText: config.palette?.heroButtonText || "#052e1a",
    textBg: config.palette?.textBg || "#ffffff",
    textColor: config.palette?.textColor || "#0f172a",
    mutedBg: config.palette?.mutedBg || "#f8fafc",
    accent: config.palette?.accent || "#0ea5e9",
    footerBg: config.palette?.footerBg || "#081120",
    footerText: config.palette?.footerText || "#dbeafe",
  };
  const navLinks = Array.isArray(config.navLinks) && config.navLinks.length
    ? config.navLinks
    : [
        { label: "Overview", href: "#overview" },
        { label: "Proof", href: "#proof" },
        { label: "FAQ", href: "#faq" },
        { label: "Start", href: "#start" },
      ];
  const pageTitle = config.pageTitle || config.name || "Landing Page";
  const sections = [
    directBlock("nav-bar", {
      variant: config.navVariant || "split-dark",
      stickyMode: config.navStickyMode || "sticky-transparent",
      fullWidthBackground: true,
      mobileMenuStyle: "hamburger",
      showLogo: true,
      brand,
      links: navLinks,
      ctaText: config.navCtaText || config.hero?.ctaText || "Start Now",
      ctaLink: config.navCtaLink || config.hero?.ctaLink || "#start",
      backgroundColor: palette.navBg,
      textColor: palette.navText,
      buttonColor: palette.navButtonBg,
      buttonTextColor: palette.navButtonText,
    }),
    directBlock(config.hero?.type || "hero", {
      heroVariant: config.hero?.variant || "split",
      headline: config.hero?.headline || "Production-ready landing page starter",
      subheadline: config.hero?.subheadline || "Use this section to position the offer, the audience, and the next step clearly.",
      ctaText: config.hero?.ctaText || "Get Started",
      ctaLink: config.hero?.ctaLink || "#start",
      backgroundStyle: config.hero?.backgroundImage ? "image" : "gradient",
      backgroundImage: config.hero?.backgroundImage || "",
      backgroundColor: config.hero?.backgroundColor || palette.heroBg,
      textColor: config.hero?.textColor || palette.heroText,
      headlineColor: config.hero?.headlineColor || palette.heroHeadline,
      buttonColor: config.hero?.buttonColor || palette.heroButtonBg,
      buttonTextColor: config.hero?.buttonTextColor || palette.heroButtonText,
      minHeight: config.hero?.minHeight || "640px",
      floatingImage: config.hero?.floatingImage || "",
      floatingX: config.hero?.floatingX,
      floatingY: config.hero?.floatingY,
      floatingWidth: config.hero?.floatingWidth,
      floatingHeight: config.hero?.floatingHeight,
      contentWidth: config.hero?.contentWidth,
    }),
    ...asArray(config.sections),
    directBlock("text", {
      text: config.footerText || `© ${new Date().getFullYear()} ${brand}. Built as a launch-ready starter with real structure, media, and conversion flow.`,
      alignment: "center",
      backgroundColor: palette.footerBg,
      textColor: palette.footerText,
    }),
  ];

  return {
    version: 1,
    theme_slug: theme,
    site: {
      logoText: brand,
      nav: navLinks,
    },
    pages: [
      templatePage(
        config.slug || "home",
        pageTitle,
        sections,
        config.objective || "Turn traffic into qualified action with a landing page that feels finished, not placeholder."
      ),
    ],
  };
}

function buildLeadMagnetLong(theme) {
  return buildFunnelTemplate(theme, {
    slug: "home",
    brand: "Launch Sprint",
    pageTitle: "Lead Magnet Landing Page",
    objective: "Capture qualified leads with a premium long-form opt-in page.",
    navLinks: [
      { label: "Why It Works", href: "#overview" },
      { label: "Inside", href: "#inside" },
      { label: "Proof", href: "#proof" },
      { label: "Get It", href: "#start" },
    ],
    navCtaText: "Get the Kit",
    navCtaLink: "#start",
    palette: {
      navBg: "#071521",
      navText: "#d7f4ff",
      navButtonBg: "#34d399",
      navButtonText: "#052e1a",
      heroBg: "#081120",
      heroText: "#dbeafe",
      heroHeadline: "#ffffff",
      heroButtonBg: "#34d399",
      heroButtonText: "#052e1a",
      footerBg: "#071521",
      footerText: "#d7f4ff",
    },
    hero: {
      variant: "split",
      headline: "A lead magnet page that feels like the start of the premium offer, not a throwaway freebie",
      subheadline: "Use this long-form version when the download, checklist, or mini-training needs more context. It layers promise, credibility, content previews, and repeated signup prompts so the page can convert colder traffic with less friction.",
      ctaText: "Get Instant Access",
      ctaLink: "#start",
      backgroundImage: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1800&q=80",
      floatingImage: "https://images.unsplash.com/photo-1558655146-364adaf1fcc9?auto=format&fit=crop&w=900&q=80",
      floatingX: 78,
      floatingY: 55,
      floatingWidth: 280,
      floatingHeight: 280,
      minHeight: "700px",
    },
    sections: [
      directBlock("stats", {
        items: [
          { value: "12", label: "conversion prompts on-page" },
          { value: "3", label: "trust layers before signup" },
          { value: "1", label: "clear irresistible next step" },
        ],
      }),
      directBlock("feature-list", {
        title: "What makes this version stronger",
        featureVariant: "cards",
        items: [
          "A high-clarity hero with visual depth and one obvious CTA.",
          "Mid-page explanation sections for colder traffic that needs more belief before opting in.",
          "Proof, content previews, FAQ, and a full form section instead of one thin signup bar.",
        ],
      }),
      directBlock("columns-3", {
        title: "What subscribers get immediately",
        column1Title: "Messaging prompts",
        column1Image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=80",
        column1: "Headline frameworks, CTA ideas, and offer-positioning prompts you can adapt fast.",
        column2Title: "Page structure",
        column2Image: "https://images.unsplash.com/photo-1496171367470-9ed9a91ea931?auto=format&fit=crop&w=900&q=80",
        column2: "A practical outline for hero, proof, objections, FAQ, and sign-up sections.",
        column3Title: "Implementation notes",
        column3Image: "https://images.unsplash.com/photo-1487014679447-9f8336841d58?auto=format&fit=crop&w=900&q=80",
        column3: "Short explanations that help the reader deploy the asset the same day they download it.",
      }),
      directBlock("testimonial", {
        text: "We replaced a weak top-of-funnel page with this long-form structure and the opt-in rate lifted immediately because visitors finally understood the value before the form.",
        author: "Renee Walsh",
        role: "Growth Strategist",
      }),
      directBlock("image-stack", {
        title: "Show the asset and the promise together",
        backgroundColor: "#f8fafc",
        minHeight: "620px",
        images: [
          {
            src: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
            x: 70,
            y: 80,
            width: 300,
            height: 220,
            rotation: -5,
            zIndex: 1,
          },
          {
            src: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=900&q=80",
            x: 260,
            y: 180,
            width: 320,
            height: 230,
            rotation: 4,
            zIndex: 2,
          },
          {
            kind: "text",
            content: "Preview the deliverable. Reinforce the transformation. Ask for the signup again.",
            x: 610,
            y: 120,
            width: 360,
            height: 220,
            fontSize: 34,
            textColor: "#0f172a",
            zIndex: 3,
          },
        ],
      }),
      directBlock("text", {
        text: `This long-form template is designed for people who do not yet trust the brand, do not fully understand the offer, or need a reason to exchange their email.

      Use this section to explain why the asset exists, what problem it solves, and why the reader should act now instead of saving the page for later.

      Strong landing pages are rarely short on clarity. They are short on fluff. This version gives you the room to educate without losing momentum.`,
        backgroundColor: "#ffffff",
        textColor: "#0f172a",
      }),
      directBlock("cta-button", {
        eyebrow: "Want the full resource?",
        title: "Put a conversion moment before the final form",
        description: "Use this middle CTA when readers are convinced halfway down the page.",
        text: "Send Me the Kit",
        link: "#start",
      }),
      directBlock("faq", {
        title: "Questions before people opt in",
        items: [
          {
            question: "Who is this best for?",
            answer: "Teams, consultants, and operators who want a stronger landing page structure without starting from a blank canvas.",
          },
          {
            question: "What format does the lead magnet come in?",
            answer: "Set this to PDF, workbook, checklist, video lesson, or template bundle depending on your offer.",
          },
          {
            question: "Can I use this for paid traffic?",
            answer: "Yes. That is exactly why this version adds more context, proof, and repeated signup opportunities.",
          },
        ],
      }),
      directBlock("contact-form", {
        title: "Get the landing page kit",
        subtitle: "Ask for the minimum information needed, then deliver the asset fast.",
        mediaImage: "https://images.unsplash.com/photo-1558655146-364adaf1fcc9?auto=format&fit=crop&w=1200&q=80",
        mediaPosition: "right",
        formVariant: "stacked-glow",
        fields: [
          { label: "First name", name: "firstName", placeholder: "Alex" },
          { label: "Work email", name: "email", placeholder: "alex@company.com" },
          { label: "What are you building?", name: "projectType", placeholder: "Lead magnet funnel, webinar page, sales page..." },
        ],
        submitText: "Get Instant Access",
        buttonBackgroundColor: "#071521",
        buttonTextColor: "#ffffff",
      }),
    ],
  });
}

function buildLeadMagnetShort(theme) {
  return buildFunnelTemplate(theme, {
    slug: "home",
    brand: "Launch Sprint",
    pageTitle: "Lead Magnet Landing Page",
    objective: "Capture quick opt-ins with a shorter, higher-velocity lead magnet page.",
    navLinks: [
      { label: "Benefits", href: "#overview" },
      { label: "Proof", href: "#proof" },
      { label: "Get It", href: "#start" },
    ],
    navCtaText: "Get the Guide",
    navCtaLink: "#start",
    palette: {
      navBg: "#102235",
      navText: "#eff6ff",
      navButtonBg: "#38bdf8",
      navButtonText: "#082f49",
      heroBg: "#0f172a",
      heroText: "#dbeafe",
      heroHeadline: "#ffffff",
      heroButtonBg: "#38bdf8",
      heroButtonText: "#082f49",
      footerBg: "#102235",
      footerText: "#eff6ff",
    },
    hero: {
      variant: "spotlight",
      headline: "A faster opt-in page for warm traffic, promos, and list-growth campaigns",
      subheadline: "This shorter version keeps the visual quality, real imagery, and proof while reducing scroll depth. It is built for audiences that already know the brand and only need a clear value exchange and a fast signup path.",
      ctaText: "Download the Guide",
      ctaLink: "#start",
      backgroundImage: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1800&q=80",
      minHeight: "620px",
    },
    sections: [
      directBlock("feature-list", {
        title: "What this short version still includes",
        items: [
          "A premium hero with one visible promise and one clear CTA.",
          "A concise value explanation for readers who need a little context, not a full argument.",
          "Proof and a final conversion form so the page still feels complete.",
        ],
      }),
      directBlock("testimonial", {
        text: "This is the kind of short landing page that still looks expensive and thought-through, which matters when the traffic already knows who you are.",
        author: "Marcus Holt",
        role: "Acquisition Lead",
      }),
      directBlock("contact-form", {
        title: "Get the guide now",
        subtitle: "Keep the form short. Let speed do the work.",
        mediaImage: "https://images.unsplash.com/photo-1454165205744-3b78555e5572?auto=format&fit=crop&w=1200&q=80",
        mediaPosition: "right",
        fields: [
          { label: "Name", name: "name", placeholder: "Taylor" },
          { label: "Email", name: "email", placeholder: "taylor@business.com" },
        ],
        submitText: "Send It Through",
        buttonBackgroundColor: "#0f172a",
        buttonTextColor: "#ffffff",
      }),
      directBlock("faq", {
        title: "Quick questions",
        items: [
          { question: "Can this page be used for ads?", answer: "Yes. It is designed for quicker campaigns where the audience already has some awareness." },
          { question: "Can I add more sections later?", answer: "Yes. Start short, then expand if your traffic mix needs more education." },
        ],
      }),
    ],
  });
}

function buildSalesLong(theme) {
  return buildFunnelTemplate(theme, {
    slug: "home",
    brand: "Northline Growth Lab",
    pageTitle: "Long-Form Sales Page",
    objective: "Sell a premium offer with a long-form page that carries visitors from interest to commitment.",
    navLinks: [
      { label: "Offer", href: "#overview" },
      { label: "Results", href: "#proof" },
      { label: "Pricing", href: "#pricing" },
      { label: "Buy", href: "#start" },
    ],
    navCtaText: "See Pricing",
    navCtaLink: "#pricing",
    palette: {
      navBg: "#111827",
      navText: "#f8fafc",
      navButtonBg: "#f59e0b",
      navButtonText: "#1c1917",
      heroBg: "#111827",
      heroText: "#e5e7eb",
      heroHeadline: "#ffffff",
      heroButtonBg: "#f59e0b",
      heroButtonText: "#1c1917",
      footerBg: "#0b1120",
      footerText: "#f8fafc",
    },
    hero: {
      variant: "editorial",
      headline: "A proper long-form sales page should feel like the sales conversation your best closer would have",
      subheadline: "This template gives you the full arc: the big promise, the buyer problem, the mechanism, proof, offer stack, pricing, objection handling, and repeated calls to action. Use it when the sale needs belief, not just urgency.",
      ctaText: "Choose Your Plan",
      ctaLink: "#pricing",
      backgroundImage: "https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=1800&q=80",
      minHeight: "720px",
    },
    sections: [
      directBlock("stats", {
        items: [
          { value: "7", label: "belief-building sections" },
          { value: "3", label: "conversion points before checkout" },
          { value: "1", label: "clear premium offer path" },
        ],
      }),
      directBlock("text", {
        text: `The strongest long-form pages do not ramble. They sequence information so the buyer can reach the decision with less internal resistance.

      Use this section to state the cost of inaction, the reason the old approach fails, and the specific shift your product, service, or program creates.`,
        backgroundColor: "#ffffff",
        textColor: "#0f172a",
      }),
      directBlock("feature-list", {
        title: "What the offer includes",
        featureVariant: "cards",
        items: [
          "A clear mechanism section so buyers understand why this works differently.",
          "A deliverables section that turns vague value into tangible included assets.",
          "A premium pricing block with plans, highlights, and enough detail to reduce hesitation.",
          "FAQ and CTA sections placed after proof so objections are handled near the buying moment.",
        ],
      }),
      directBlock("image-gallery", {
        title: "Use visuals to sell the experience, not just decorate the page",
        images: [
          { src: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80", alt: "Offer presentation" },
          { src: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80", alt: "Dashboard proof" },
          { src: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80", alt: "Team collaboration" },
        ],
      }),
      directBlock("testimonial", {
        text: "The page finally gave the offer enough room to feel premium. We stopped sounding like we were selling a commodity and started converting the right buyers.",
        author: "Alicia Grant",
        role: "Program Founder",
      }),
      directBlock("testimonial", {
        text: "What changed was not only the design. The sequencing of the proof, deliverables, and pricing made the buying decision much easier.",
        author: "Noah Bennett",
        role: "Revenue Consultant",
      }),
      directBlock("columns-2", {
        title: "Why this offer lands",
        leftTitle: "Before",
        leftImage: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=80",
        leftContent: "The old page is thin, visually generic, and too short to overcome real objections.",
        rightTitle: "After",
        rightImage: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80",
        rightContent: "This structure lets the reader understand the transformation, see proof, compare tiers, and commit with more confidence.",
      }),
      directBlock("pricing-table", {
        title: "Choose the right purchase path",
        pricingVariant: "spotlight",
        plans: [
          {
            name: "Core",
            price: "$290",
            description: "A lean entry point for buyers who want the framework and implementation plan.",
            features: ["Core training or offer delivery", "Templates and swipe assets", "Immediate access"],
            extras: ["Best for self-starters", "No custom support included"],
            cta: "Start with Core",
          },
          {
            name: "Growth",
            price: "$890",
            description: "The flagship option with the strongest value stack and most obvious fit for serious buyers.",
            features: ["Everything in Core", "Implementation workshop", "Priority support", "Bonus assets"],
            extras: ["Most popular choice", "Best value per outcome"],
            highlighted: true,
            cta: "Choose Growth",
          },
          {
            name: "Scale",
            price: "$1,900",
            description: "Premium path for teams or operators who want more speed, support, or hands-on guidance.",
            features: ["Everything in Growth", "Private strategy review", "Team rollout guidance"],
            extras: ["For operators who want white-glove support"],
            cta: "Go Premium",
          },
        ],
      }),
      directBlock("cta-button", {
        eyebrow: "Still considering it?",
        title: "Give the reader another easy yes",
        description: "Use a mid-late CTA after proof and pricing so high-intent visitors can act without needing the final section.",
        text: "Start with Growth",
        link: "#start",
      }),
      directBlock("faq", {
        title: "Buying objections to handle before checkout",
        items: [
          {
            question: "Who is this not for?",
            answer: "State who should wait, what level of readiness is required, and why fit matters to results.",
          },
          {
            question: "How quickly can someone implement this?",
            answer: "Use this answer to reduce perceived delay and explain the speed-to-value clearly.",
          },
          {
            question: "Why three plans?",
            answer: "Different buyers want different levels of support. The page should make the self-selection feel easy.",
          },
        ],
      }),
      directBlock("contact-form", {
        title: "Start with the right offer tier",
        subtitle: "Use this final section as your application, booking, or purchase-intent form if the sale is not fully self-serve.",
        mediaImage: "https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=1200&q=80",
        mediaPosition: "right",
        formVariant: "dark-glass",
        cardBackgroundColor: "rgba(255,255,255,0.96)",
        fields: [
          { label: "Name", name: "name", placeholder: "Jordan" },
          { label: "Email", name: "email", placeholder: "jordan@company.com" },
          { label: "Preferred tier", name: "tier", placeholder: "Core, Growth, or Scale" },
          { label: "Main goal", name: "goal", type: "textarea", placeholder: "What result are you trying to create in the next 90 days?" },
        ],
        submitText: "Start Now",
        buttonBackgroundColor: "#111827",
        buttonTextColor: "#ffffff",
      }),
    ],
  });
}

function buildSalesShort(theme) {
  return buildFunnelTemplate(theme, {
    slug: "home",
    brand: "Northline Growth Lab",
    pageTitle: "Sales Page",
    objective: "Sell a focused offer with a shorter, faster-moving sales page.",
    navLinks: [
      { label: "Offer", href: "#overview" },
      { label: "Pricing", href: "#pricing" },
      { label: "Buy", href: "#start" },
    ],
    navCtaText: "Buy Now",
    navCtaLink: "#start",
    palette: {
      navBg: "#0b1020",
      navText: "#dbeafe",
      navButtonBg: "#22d3ee",
      navButtonText: "#082f49",
      heroBg: "#0b1020",
      heroText: "#dbeafe",
      heroHeadline: "#ffffff",
      heroButtonBg: "#22d3ee",
      heroButtonText: "#082f49",
      footerBg: "#050914",
      footerText: "#e0e7ff",
    },
    hero: {
      variant: "spotlight",
      headline: "A short sales page for warmer traffic that still looks premium and complete",
      subheadline: "Use this version when the offer is simpler, the audience already knows you, or the buying decision needs less education. It keeps the hero, proof, pricing, and CTA flow tight.",
      ctaText: "Buy Now",
      ctaLink: "#pricing",
      backgroundImage: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1800&q=80",
      minHeight: "620px",
    },
    sections: [
      directBlock("feature-list", {
        title: "What this version does well",
        items: [
          "Makes the offer obvious in the first screen.",
          "Adds enough proof and pricing detail to support faster decisions.",
          "Ends with a strong CTA instead of forcing the reader through unnecessary filler.",
        ],
      }),
      directBlock("testimonial", {
        text: "This format is ideal for remarketing traffic and buyers who already understand the problem. It moves fast without looking thin.",
        author: "Brielle King",
        role: "Offer Strategist",
      }),
      directBlock("pricing-table", {
        title: "Simple pricing",
        pricingVariant: "premium",
        plans: [
          {
            name: "Single Purchase",
            price: "$490",
            description: "One clear offer. One strong next step.",
            features: ["Core deliverable", "Bonus asset", "Immediate access"],
            highlighted: true,
            cta: "Buy Now",
          },
        ],
      }),
      directBlock("cta-button", {
        text: "Complete Purchase",
        link: "#start",
      }),
      directBlock("faq", {
        title: "Last questions",
        items: [
          { question: "Is this enough for colder traffic?", answer: "Usually no. Use the long-form version when the buyer needs more belief and context." },
          { question: "Can I expand it later?", answer: "Yes. This is meant to be a sharp short-form base, not a dead-end layout." },
        ],
      }),
    ],
  });
}

function buildCheckoutPage(theme) {
  return buildFunnelTemplate(theme, {
    slug: "home",
    brand: "Northline Growth Lab",
    pageTitle: "Checkout Page",
    objective: "Finish the buying journey with a cleaner, more trustworthy checkout starter.",
    navLinks: [
      { label: "Summary", href: "#overview" },
      { label: "Guarantee", href: "#proof" },
      { label: "Checkout", href: "#start" },
    ],
    navCtaText: "Secure Checkout",
    navCtaLink: "#start",
    palette: {
      navBg: "#102235",
      navText: "#eff6ff",
      navButtonBg: "#c08457",
      navButtonText: "#1f130a",
      heroBg: "#183b56",
      heroText: "#e0f2fe",
      heroHeadline: "#ffffff",
      heroButtonBg: "#c08457",
      heroButtonText: "#1f130a",
      footerBg: "#102235",
      footerText: "#eff6ff",
    },
    hero: {
      variant: "framed",
      headline: "A checkout page should confirm the decision, not reintroduce confusion",
      subheadline: "This version keeps the order summary, guarantee, proof, and final checkout action clean and premium so the buyer feels safe finishing the transaction.",
      ctaText: "Complete Purchase",
      ctaLink: "#start",
      backgroundImage: "https://images.unsplash.com/photo-1556745757-8d76bdb6984b?auto=format&fit=crop&w=1800&q=80",
      minHeight: "600px",
    },
    sections: [
      directBlock("columns-2", {
        title: "Order summary and buyer reassurance",
        leftTitle: "What they are buying",
        leftImage: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=900&q=80",
        leftContent: "List the core deliverable, access details, bonuses, and exactly what happens after payment.",
        rightTitle: "Why they can buy confidently",
        rightImage: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
        rightContent: "Use this side for guarantee language, security reassurance, support expectations, and any timing detail.",
      }),
      directBlock("pricing-table", {
        title: "Secure order",
        pricingVariant: "clean",
        plans: [
          {
            name: "Growth Intensive",
            price: "$890",
            description: "Complete the order and get onboarding instructions immediately after payment.",
            features: ["Core delivery", "Bonus templates", "Priority onboarding"],
            extras: ["14-day guarantee", "Secure payment flow"],
            highlighted: true,
            cta: "Complete Purchase",
          },
        ],
      }),
      directBlock("testimonial", {
        text: "The cleaner checkout structure reduced hesitation. Buyers could see what they were getting, why it was safe, and what would happen next.",
        author: "Sam Carter",
        role: "Offer Owner",
      }),
      directBlock("faq", {
        title: "Questions before payment",
        items: [
          { question: "When do I get access?", answer: "Use this answer to set expectations around immediate delivery, manual onboarding, or booking confirmation." },
          { question: "What if I need help?", answer: "Explain support response times and where the buyer can go next if something is unclear." },
        ],
      }),
      directBlock("cta-button", {
        text: "Proceed to Payment",
        link: "#start",
      }),
    ],
  });
}

function buildThankYouPage(theme) {
  return buildFunnelTemplate(theme, {
    slug: "home",
    brand: "Northline Growth Lab",
    pageTitle: "Thank You Page",
    objective: "Turn post-signup or post-purchase attention into a clean next-step flow.",
    navLinks: [
      { label: "Next Steps", href: "#overview" },
      { label: "Resources", href: "#proof" },
      { label: "Book", href: "#start" },
    ],
    navCtaText: "See Next Step",
    navCtaLink: "#start",
    palette: {
      navBg: "#1f1207",
      navText: "#fff7ed",
      navButtonBg: "#f59e0b",
      navButtonText: "#2b1707",
      heroBg: "#3b1f0f",
      heroText: "#fff5e6",
      heroHeadline: "#fff7ed",
      heroButtonBg: "#f59e0b",
      heroButtonText: "#2b1707",
      footerBg: "#1f1207",
      footerText: "#fff7ed",
    },
    hero: {
      variant: "editorial",
      headline: "A thank-you page should direct momentum, not waste it",
      subheadline: "Use this page to confirm the action, reduce uncertainty, and move the visitor to the most valuable next step: onboarding, booking, community access, or a strategic upsell.",
      ctaText: "Book Your Next Step",
      ctaLink: "#start",
      backgroundImage: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1800&q=80",
      minHeight: "620px",
    },
    sections: [
      directBlock("columns-3", {
        title: "Tell people exactly what happens next",
        column1Title: "Step 1",
        column1Image: "https://images.unsplash.com/photo-1558655146-364adaf1fcc9?auto=format&fit=crop&w=900&q=80",
        column1: "Confirm access, inbox delivery, or order receipt.",
        column2Title: "Step 2",
        column2Image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
        column2: "Prompt the onboarding action, booking step, or community join.",
        column3Title: "Step 3",
        column3Image: "https://images.unsplash.com/photo-1454165205744-3b78555e5572?auto=format&fit=crop&w=900&q=80",
        column3: "Offer the logical next action while attention is still high.",
      }),
      directBlock("image-gallery", {
        title: "Useful follow-up assets",
        images: [
          { src: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80", alt: "Checklist or dashboard" },
          { src: "https://images.unsplash.com/photo-1454165205744-3b78555e5572?auto=format&fit=crop&w=1200&q=80", alt: "Planning resource" },
          { src: "https://images.unsplash.com/photo-1558655146-364adaf1fcc9?auto=format&fit=crop&w=1200&q=80", alt: "Welcome resource" },
        ],
      }),
      directBlock("cta-button", {
        eyebrow: "Keep the momentum",
        title: "Invite the next meaningful action",
        description: "For example: book onboarding, join the member portal, or schedule a strategy call.",
        text: "Book My Next Step",
        link: "#start",
      }),
      directBlock("contact-form", {
        title: "Need help before the next step?",
        subtitle: "Keep a support or booking option visible so the page feels finished and useful.",
        mediaImage: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80",
        mediaPosition: "right",
        fields: [
          { label: "Name", name: "name", placeholder: "Jamie" },
          { label: "Email", name: "email", placeholder: "jamie@company.com" },
          { label: "What do you need next?", name: "nextStep", type: "textarea", placeholder: "Booking help, onboarding question, resource access..." },
        ],
        submitText: "Send Request",
      }),
    ],
  });
}

function buildWebinarLong(theme) {
  return buildFunnelTemplate(theme, {
    slug: "home",
    brand: "Signal Session",
    pageTitle: "Webinar Registration Page",
    objective: "Drive webinar registrations with a full trust-building event page.",
    navLinks: [
      { label: "Why Attend", href: "#overview" },
      { label: "Agenda", href: "#inside" },
      { label: "Register", href: "#start" },
    ],
    navCtaText: "Reserve My Seat",
    navCtaLink: "#start",
    palette: {
      navBg: "#14112b",
      navText: "#f5f3ff",
      navButtonBg: "#c4b5fd",
      navButtonText: "#1e1b4b",
      heroBg: "#1f1a42",
      heroText: "#ede9fe",
      heroHeadline: "#ffffff",
      heroButtonBg: "#c4b5fd",
      heroButtonText: "#1e1b4b",
      footerBg: "#120f25",
      footerText: "#f5f3ff",
    },
    hero: {
      variant: "editorial",
      headline: "A webinar page should sell the transformation, the presenter, and the urgency to show up live",
      subheadline: "This long-form webinar registration layout gives you a stronger promise, a clearer agenda, more proof, and multiple seat-reservation prompts so the page can convert colder traffic and event promotions with confidence.",
      ctaText: "Reserve My Seat",
      ctaLink: "#start",
      backgroundImage: "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&w=1800&q=80",
      minHeight: "680px",
    },
    sections: [
      directBlock("stats", {
        items: [
          { value: "45m", label: "training length" },
          { value: "3", label: "takeaways promised" },
          { value: "1", label: "clear registration action" },
        ],
      }),
      directBlock("feature-list", {
        title: "Why this registration page converts better",
        items: [
          "Explains exactly what the attendee will learn instead of relying on vague webinar language.",
          "Uses real visuals and proof so the event feels credible before the form.",
          "Repeats the seat-reservation CTA at the moments where belief naturally rises.",
        ],
      }),
      directBlock("columns-3", {
        title: "What attendees will leave with",
        column1Title: "Clear diagnosis",
        column1Image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=900&q=80",
        column1: "A sharper view of the real problem slowing growth or conversion.",
        column2Title: "Practical framework",
        column2Image: "https://images.unsplash.com/photo-1454165205744-3b78555e5572?auto=format&fit=crop&w=900&q=80",
        column2: "A framework they can use immediately after the training ends.",
        column3Title: "Implementation plan",
        column3Image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
        column3: "Specific next actions instead of generic inspiration.",
      }),
      directBlock("testimonial", {
        text: "The event page finally made the training sound worth showing up for live. Registrations improved because the value proposition was finally concrete.",
        author: "Cleo Mercer",
        role: "Audience Growth Manager",
      }),
      directBlock("image-gallery", {
        title: "Make the event feel real",
        images: [
          { src: "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&w=1200&q=80", alt: "Speaker on stage" },
          { src: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80", alt: "Team learning session" },
          { src: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80", alt: "Workshop participants" },
        ],
      }),
      directBlock("faq", {
        title: "Questions before registering",
        items: [
          { question: "Will there be a replay?", answer: "Answer this directly. If you want live attendance, say what is exclusive to the live session." },
          { question: "Who is this best for?", answer: "Describe the audience, readiness level, and business type or role clearly." },
          { question: "What happens after I register?", answer: "Explain confirmation, reminders, calendar links, and any prep material." },
        ],
      }),
      directBlock("contact-form", {
        title: "Reserve your seat",
        subtitle: "Use a focused registration form and keep the promise visible beside it.",
        mediaImage: "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&w=1200&q=80",
        mediaPosition: "right",
        formVariant: "stacked-glow",
        fields: [
          { label: "First name", name: "firstName", placeholder: "Mia" },
          { label: "Email", name: "email", placeholder: "mia@company.com" },
          { label: "Biggest challenge", name: "challenge", placeholder: "Lead flow, offer clarity, webinar attendance..." },
        ],
        submitText: "Reserve My Seat",
      }),
    ],
  });
}

function buildWebinarShort(theme) {
  return buildFunnelTemplate(theme, {
    slug: "home",
    brand: "Signal Session",
    pageTitle: "Webinar Registration Page",
    objective: "Drive quick webinar registrations with a shorter event page.",
    navLinks: [
      { label: "Agenda", href: "#overview" },
      { label: "Register", href: "#start" },
    ],
    navCtaText: "Register Now",
    navCtaLink: "#start",
    palette: {
      navBg: "#1b2233",
      navText: "#e2e8f0",
      navButtonBg: "#d4af37",
      navButtonText: "#23180a",
      heroBg: "#1b2233",
      heroText: "#e2e8f0",
      heroHeadline: "#ffffff",
      heroButtonBg: "#d4af37",
      heroButtonText: "#23180a",
      footerBg: "#101827",
      footerText: "#f8fafc",
    },
    hero: {
      variant: "framed",
      headline: "A faster webinar page for warm audiences and deadline-driven promotions",
      subheadline: "This short version gives you the event promise, speaker credibility, quick agenda, and registration form without a long scroll.",
      ctaText: "Register Now",
      ctaLink: "#start",
      backgroundImage: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1800&q=80",
      minHeight: "600px",
    },
    sections: [
      directBlock("feature-list", {
        title: "What attendees get",
        items: [
          "A concise, high-value training promise.",
          "An immediate reason to register instead of delaying.",
          "A shorter path from headline to form for warmer traffic.",
        ],
      }),
      directBlock("contact-form", {
        title: "Register in under a minute",
        subtitle: "Ideal for warm traffic, launches, and reminder campaigns.",
        mediaImage: "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&w=1200&q=80",
        mediaPosition: "right",
        fields: [
          { label: "Name", name: "name", placeholder: "Chris" },
          { label: "Email", name: "email", placeholder: "chris@company.com" },
        ],
        submitText: "Save My Seat",
      }),
      directBlock("faq", {
        title: "Before registering",
        items: [
          { question: "Is this live?", answer: "Use this answer to create urgency and clarify replay availability." },
          { question: "Who should attend?", answer: "Briefly define the audience and desired result." },
        ],
      }),
    ],
  });
}

function buildBookingLong(theme) {
  return buildFunnelTemplate(theme, {
    slug: "home",
    brand: "Momentum Advisory",
    pageTitle: "Booking and Application Page",
    objective: "Qualify and convert high-intent booking or application traffic with more depth.",
    navLinks: [
      { label: "Fit", href: "#overview" },
      { label: "Process", href: "#inside" },
      { label: "Apply", href: "#start" },
    ],
    navCtaText: "Apply Now",
    navCtaLink: "#start",
    palette: {
      navBg: "#062a24",
      navText: "#ecfeff",
      navButtonBg: "#14b8a6",
      navButtonText: "#042f2e",
      heroBg: "#0b3b33",
      heroText: "#e6fffb",
      heroHeadline: "#ffffff",
      heroButtonBg: "#14b8a6",
      heroButtonText: "#042f2e",
      footerBg: "#05231f",
      footerText: "#dffaf7",
    },
    hero: {
      variant: "framed",
      headline: "A booking page should pre-qualify the lead while making the next step feel desirable",
      subheadline: "This long-form version is built for consultations, discovery calls, applications, and higher-consideration services. It sells the value of the conversation, clarifies fit, and uses the form to improve lead quality before the first call happens.",
      ctaText: "Apply Now",
      ctaLink: "#start",
      backgroundImage: "https://images.unsplash.com/photo-1551836022-deb4988cc6c0?auto=format&fit=crop&w=1800&q=80",
      minHeight: "680px",
    },
    sections: [
      directBlock("feature-list", {
        title: "Why this page works better",
        items: [
          "Clarifies who should apply so the right prospects self-select.",
          "Explains what happens during the call or review so the next step feels valuable.",
          "Uses stronger visuals, proof, and qualification prompts than a generic contact page.",
        ],
      }),
      directBlock("columns-2", {
        title: "Use the page to filter and attract",
        leftTitle: "Good fit",
        leftImage: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80",
        leftContent: "Describe the goals, budget, urgency, and business stage that make someone a strong candidate.",
        rightTitle: "What they get next",
        rightImage: "https://images.unsplash.com/photo-1454165205744-3b78555e5572?auto=format&fit=crop&w=900&q=80",
        rightContent: "Set expectations around the review process, call structure, proposal path, or application follow-up.",
      }),
      directBlock("testimonial", {
        text: "Once we stopped treating the booking page like a generic contact page, the quality of enquiry improved immediately. Better framing creates better leads.",
        author: "Nadia Ellis",
        role: "Consulting Founder",
      }),
      directBlock("pricing-table", {
        title: "Show the paths clearly if there is more than one next step",
        pricingVariant: "matrix",
        plans: [
          {
            name: "Discovery Call",
            price: "$0",
            description: "For high-fit leads who want to explore the opportunity and next step.",
            features: ["Fit review", "Strategy direction", "Next-step recommendation"],
            cta: "Apply for Discovery",
          },
          {
            name: "Paid Audit",
            price: "$390",
            description: "For buyers who want a deeper strategic review before the engagement begins.",
            features: ["Detailed diagnosis", "Prioritised fixes", "Recorded walkthrough"],
            highlighted: true,
            cta: "Choose Paid Audit",
          },
        ],
      }),
      directBlock("faq", {
        title: "Questions to answer before the form",
        items: [
          { question: "How selective is the application process?", answer: "Explain the fit filter honestly so the right buyers respect the bar instead of guessing." },
          { question: "Is the call a sales pitch?", answer: "Clarify whether the next step is diagnostic, strategic, consultative, or a direct application review." },
          { question: "What should applicants prepare?", answer: "Use this space to improve the quality of what prospects submit." },
        ],
      }),
      directBlock("contact-form", {
        title: "Apply or request a booking",
        subtitle: "Ask better questions so the first conversation starts with real context.",
        mediaImage: "https://images.unsplash.com/photo-1551836022-deb4988cc6c0?auto=format&fit=crop&w=1200&q=80",
        mediaPosition: "right",
        formVariant: "editorial-split",
        fields: [
          { label: "Name", name: "name", placeholder: "Morgan" },
          { label: "Email", name: "email", placeholder: "morgan@business.com" },
          { label: "Current business stage", name: "stage", placeholder: "Early traction, scaling, established..." },
          { label: "What do you want help with?", name: "goal", type: "textarea", placeholder: "Lead generation, messaging, conversion, systems..." },
        ],
        submitText: "Submit Application",
        buttonBackgroundColor: "#062a24",
        buttonTextColor: "#ffffff",
      }),
    ],
  });
}

function buildBookingShort(theme) {
  return buildFunnelTemplate(theme, {
    slug: "home",
    brand: "Momentum Advisory",
    pageTitle: "Booking and Application Page",
    objective: "Drive quicker booking or application conversions with a shorter layout.",
    navLinks: [
      { label: "Fit", href: "#overview" },
      { label: "Apply", href: "#start" },
    ],
    navCtaText: "Book Now",
    navCtaLink: "#start",
    palette: {
      navBg: "#f8fafc",
      navText: "#1e293b",
      navButtonBg: "#0f766e",
      navButtonText: "#ecfeff",
      heroBg: "#f1f5f9",
      heroText: "#334155",
      heroHeadline: "#0f172a",
      heroButtonBg: "#0f766e",
      heroButtonText: "#ecfeff",
      footerBg: "#e2e8f0",
      footerText: "#0f172a",
    },
    hero: {
      variant: "framed",
      headline: "A shorter booking page for warmer leads who already want to talk",
      subheadline: "Keep the quality high but move quickly: explain fit, reinforce the value of the call, and make the application or booking action effortless.",
      ctaText: "Book Now",
      ctaLink: "#start",
      backgroundImage: "https://images.unsplash.com/photo-1551836022-deb4988cc6c0?auto=format&fit=crop&w=1800&q=80",
      minHeight: "600px",
    },
    sections: [
      directBlock("feature-list", {
        title: "Ideal for",
        items: [
          "Warm referral traffic.",
          "Follow-up email campaigns and retargeting.",
          "Offers where the main job is to get the prospect onto the calendar fast.",
        ],
      }),
      directBlock("contact-form", {
        title: "Request a booking",
        subtitle: "Use a compact form with just enough qualification to keep the conversation useful.",
        mediaImage: "https://images.unsplash.com/photo-1454165205744-3b78555e5572?auto=format&fit=crop&w=1200&q=80",
        mediaPosition: "right",
        fields: [
          { label: "Name", name: "name", placeholder: "Alex" },
          { label: "Email", name: "email", placeholder: "alex@company.com" },
          { label: "Main priority", name: "priority", placeholder: "Lead flow, offer, growth..." },
        ],
        submitText: "Book My Call",
        buttonBackgroundColor: "#0f766e",
        buttonTextColor: "#ffffff",
      }),
      directBlock("faq", {
        title: "Quick questions",
        items: [
          { question: "Should I use the long version instead?", answer: "Use the long version when you need to build more trust or explain the fit in more detail." },
          { question: "Can this become an application page?", answer: "Yes. Expand the form fields and add more proof or process sections as needed." },
        ],
      }),
    ],
  });
}

function buildAffiliateReviewLong(theme) {
  return buildFunnelTemplate(theme, {
    slug: "home",
    brand: "Offer Scout",
    pageTitle: "Affiliate Review Landing Page",
    objective: "Sell an affiliate offer with a long-form comparison and review page that builds belief before the click-through.",
    navLinks: [
      { label: "Overview", href: "#overview" },
      { label: "Benefits", href: "#benefits" },
      { label: "Proof", href: "#proof" },
      { label: "Get Access", href: "#start" },
    ],
    navCtaText: "See the Offer",
    navCtaLink: "#start",
    palette: {
      navBg: "#0b1324",
      navText: "#e2e8f0",
      navButtonBg: "#f59e0b",
      navButtonText: "#111827",
      heroBg: "#0f172a",
      heroText: "#cbd5e1",
      heroHeadline: "#ffffff",
      heroButtonBg: "#f59e0b",
      heroButtonText: "#111827",
      footerBg: "#0b1324",
      footerText: "#e2e8f0",
    },
    hero: {
      variant: "editorial",
      headline: "A long-form affiliate review page should explain the decision, not just throw buttons at the reader",
      subheadline: "Use this when you need to sell software, courses, memberships, or partner offers to colder traffic. It gives you room for the hook, the why, the comparison, the proof, and the repeated action blocks that serious affiliate pages need.",
      ctaText: "Check Pricing & Bonuses",
      ctaLink: "#start",
      backgroundImage: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1800&q=80",
      minHeight: "700px",
    },
    sections: [
      directBlock("stats", {
        items: [
          { value: "4", label: "buyer objections handled" },
          { value: "3", label: "bonus stacks highlighted" },
          { value: "1", label: "clear next action" },
        ],
      }),
      directBlock("feature-list", {
        title: "Why this review converts better",
        featureVariant: "cards",
        items: [
          "It explains who the offer is for before asking for the click.",
          "It adds comparison, bonuses, screenshots, and buyer-context instead of generic hype.",
          "It uses multiple CTA moments so the page can monetise both scanners and deep readers.",
        ],
      }),
      directBlock("columns-3", {
        title: "What to cover in the review",
        column1Title: "Problem",
        column1Image: "https://images.unsplash.com/photo-1454165205744-3b78555e5572?auto=format&fit=crop&w=900&q=80",
        column1: "State the pain, bottleneck, or missed result the buyer wants fixed.",
        column2Title: "Mechanism",
        column2Image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
        column2: "Explain why this product solves the issue better than patchwork alternatives.",
        column3Title: "Bonuses",
        column3Image: "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=900&q=80",
        column3: "Show the stack, the extras, and the urgency behind buying through your link.",
      }),
      directBlock("image-gallery", {
        title: "Show the product, dashboard, and transformation visually",
        images: [
          { src: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80", alt: "Platform overview" },
          { src: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80", alt: "Reporting dashboard" },
          { src: "https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=1200&q=80", alt: "Results workflow" },
        ],
      }),
      directBlock("testimonial", {
        text: "The long review format worked because buyers could see the fit, the proof, and the bonus stack before clicking through. It felt like guidance, not hard-selling.",
        author: "Tanya Wells",
        role: "Affiliate Publisher",
      }),
      directBlock("pricing-table", {
        title: "Help buyers compare the options",
        pricingVariant: "clean",
        plans: [
          { name: "Starter", price: "$49", description: "Entry tier for solo buyers testing the product.", features: ["Core feature set", "Fast setup", "Basic support"], cta: "See Starter" },
          { name: "Pro", price: "$149", description: "Best fit for serious operators who need stronger capability.", features: ["Advanced workflows", "Templates", "Priority support"], highlighted: true, cta: "See Pro" },
          { name: "Team", price: "$299", description: "For teams rolling the offer out across multiple users.", features: ["Shared seats", "Admin controls", "Reporting"], cta: "See Team" },
        ],
      }),
      directBlock("faq", {
        title: "Questions before the affiliate click",
        items: [
          { question: "Who is this best for?", answer: "Spell out the ideal use case and who will get the fastest payoff." },
          { question: "What makes the offer worth it?", answer: "Use this answer to summarise the main differentiator, outcome, and bonus stack." },
          { question: "Do I need the long page?", answer: "Use the long version for colder traffic, search traffic, and review-style buying journeys." },
        ],
      }),
      directBlock("contact-form", {
        title: "Get the full offer details and bonuses",
        subtitle: "Use this final action block as your CTA handoff to the affiliate offer, bonus page, or bridge step.",
        mediaImage: "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=1200&q=80",
        mediaPosition: "right",
        fields: [
          { label: "Name", name: "name", placeholder: "Jamie" },
          { label: "Email", name: "email", placeholder: "jamie@company.com" },
          { label: "What are you hoping to improve?", name: "goal", placeholder: "Lead flow, conversions, automation, fulfilment..." },
        ],
        submitText: "Show Me the Offer",
        buttonBackgroundColor: "#0f172a",
        buttonTextColor: "#ffffff",
      }),
    ],
  });
}

function buildAffiliateReviewShort(theme) {
  return buildFunnelTemplate(theme, {
    slug: "home",
    brand: "Offer Scout",
    pageTitle: "Affiliate Review Landing Page",
    objective: "Drive faster affiliate clicks with a shorter comparison and review page for warmer traffic.",
    navLinks: [
      { label: "Why It Wins", href: "#overview" },
      { label: "Bonuses", href: "#benefits" },
      { label: "Get Access", href: "#start" },
    ],
    navCtaText: "View the Offer",
    navCtaLink: "#start",
    palette: {
      navBg: "#111827",
      navText: "#f8fafc",
      navButtonBg: "#22c55e",
      navButtonText: "#052e16",
      heroBg: "#0f172a",
      heroText: "#dbeafe",
      heroHeadline: "#ffffff",
      heroButtonBg: "#22c55e",
      heroButtonText: "#052e16",
      footerBg: "#111827",
      footerText: "#f8fafc",
    },
    hero: {
      variant: "spotlight",
      headline: "A shorter affiliate page for buyers who already know the category and just need a confident recommendation",
      subheadline: "Use this version for email traffic, retargeting, and audiences who do not need a full review article but still need proof, bonuses, and a clean CTA path.",
      ctaText: "Get the Deal",
      ctaLink: "#start",
      backgroundImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1800&q=80",
      minHeight: "620px",
    },
    sections: [
      directBlock("feature-list", {
        title: "Keep the short version focused on",
        items: [
          "The buyer outcome and best-fit use case.",
          "One comparison or differentiator block.",
          "A bonus stack and a direct CTA without unnecessary filler.",
        ],
      }),
      directBlock("testimonial", {
        text: "This format works when the audience already trusts the publisher and simply wants the shortest path to the recommendation and the bonus stack.",
        author: "Riley Chen",
        role: "Newsletter Operator",
      }),
      directBlock("cta-button", {
        eyebrow: "Best for warmer traffic",
        title: "Move the reader from interest to click quickly",
        description: "Keep one obvious next action near the middle of the page.",
        text: "Claim Bonuses",
        link: "#start",
      }),
      directBlock("faq", {
        title: "Quick questions",
        items: [
          { question: "When should I use this version?", answer: "Use it for email promos, retargeting, and readers who already understand the product category." },
          { question: "Can I add a comparison table later?", answer: "Yes. Start with this lean version and expand if you need more buyer education." },
        ],
      }),
      directBlock("contact-form", {
        title: "See the offer and bonuses",
        subtitle: "Use a simple handoff form or button block depending on your affiliate flow.",
        mediaImage: "https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1200&q=80",
        mediaPosition: "right",
        fields: [
          { label: "Name", name: "name", placeholder: "Alex" },
          { label: "Email", name: "email", placeholder: "alex@company.com" },
        ],
        submitText: "Take Me There",
        buttonBackgroundColor: "#111827",
        buttonTextColor: "#ffffff",
      }),
    ],
  });
}

function buildBookOfferLong(theme) {
  return buildFunnelTemplate(theme, {
    slug: "home",
    brand: "Author Launch Studio",
    pageTitle: "Book Launch Landing Page",
    objective: "Sell a book, companion guide, or author bundle with a rich long-form launch page.",
    navLinks: [
      { label: "Book", href: "#overview" },
      { label: "Inside", href: "#benefits" },
      { label: "Reviews", href: "#proof" },
      { label: "Order", href: "#start" },
    ],
    navCtaText: "Order the Book",
    navCtaLink: "#start",
    palette: {
      navBg: "#1f2937",
      navText: "#f9fafb",
      navButtonBg: "#fbbf24",
      navButtonText: "#422006",
      heroBg: "#111827",
      heroText: "#e5e7eb",
      heroHeadline: "#ffffff",
      heroButtonBg: "#fbbf24",
      heroButtonText: "#422006",
      footerBg: "#111827",
      footerText: "#f9fafb",
    },
    hero: {
      variant: "editorial",
      headline: "A book landing page should sell the promise, the worldview, and the reading experience",
      subheadline: "Use this long-form version for book launches, nonfiction offers, companion workbooks, or premium author bundles. It gives you space for the hook, chapter highlights, endorsements, imagery, and the order path.",
      ctaText: "Order the Book",
      ctaLink: "#start",
      backgroundImage: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1800&q=80",
      minHeight: "700px",
    },
    sections: [
      directBlock("columns-3", {
        title: "What makes readers say yes",
        column1Title: "Big idea",
        column1Image: "https://images.unsplash.com/photo-1495640388908-05fa85288e61?auto=format&fit=crop&w=900&q=80",
        column1: "Lead with the thesis, contrarian belief, or promise that makes the book feel important.",
        column2Title: "What is inside",
        column2Image: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=900&q=80",
        column2: "Preview the frameworks, chapters, stories, or practical takeaways the buyer gets immediately.",
        column3Title: "Why trust it",
        column3Image: "https://images.unsplash.com/photo-1526243741027-444d633d7365?auto=format&fit=crop&w=900&q=80",
        column3: "Layer endorsements, reader proof, media logos, and the author backstory before the order block.",
      }),
      directBlock("image-stack", {
        title: "Use the cover, spreads, and reader context as sales assets",
        backgroundColor: "#f8fafc",
        minHeight: "620px",
        images: [
          { src: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80", x: 70, y: 90, width: 260, height: 350, rotation: -4, zIndex: 1 },
          { src: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=900&q=80", x: 280, y: 170, width: 320, height: 220, rotation: 6, zIndex: 2 },
          { kind: "text", content: "Preview the cover, chapter layout, endorsements, and bonus workbook here.", x: 630, y: 130, width: 320, height: 220, fontSize: 32, textColor: "#0f172a", zIndex: 3 },
        ],
      }),
      directBlock("testimonial", {
        text: "The long-form page made the book feel like an event, not just another product card. Readers could feel the value before they reached the order button.",
        author: "Harper Jones",
        role: "Launch Strategist",
      }),
      directBlock("feature-list", {
        title: "Long-form book pages should include",
        featureVariant: "cards",
        items: [
          "A promise-led hero with the cover shown as the main visual asset.",
          "Chapter, framework, or lesson previews so the reader understands what they get.",
          "Reviews, endorsements, bonuses, and ordering options grouped near the buying moment.",
        ],
      }),
      directBlock("pricing-table", {
        title: "Offer one or more buying paths",
        pricingVariant: "spotlight",
        plans: [
          { name: "Book Only", price: "$24", description: "For readers who want the core book experience.", features: ["Paperback or ebook", "Immediate access or shipping", "Reader bonuses"], cta: "Order Book" },
          { name: "Book + Workbook", price: "$49", description: "Best for readers who want implementation support.", features: ["Book", "Workbook", "Bonus templates"], highlighted: true, cta: "Order Bundle" },
          { name: "Reader Circle", price: "$99", description: "Premium bundle with live bonus or private Q&A.", features: ["Everything in Bundle", "Private session", "Community access"], cta: "Join Reader Circle" },
        ],
      }),
      directBlock("faq", {
        title: "Questions before ordering",
        items: [
          { question: "Who is this book for?", answer: "Spell out the reader stage, ambition, and pain points this book directly addresses." },
          { question: "Is this practical or inspirational?", answer: "Use this answer to explain the mix of story, frameworks, and action steps." },
          { question: "Should I use long-form for books?", answer: "Yes when the book has a strong thesis, meaningful bonuses, or needs more context to justify the sale." },
        ],
      }),
      directBlock("contact-form", {
        title: "Order the book or bundle",
        subtitle: "Use this final section as your checkout handoff, preorder form, or book bonus registration.",
        mediaImage: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=80",
        mediaPosition: "right",
        fields: [
          { label: "Name", name: "name", placeholder: "Sam" },
          { label: "Email", name: "email", placeholder: "sam@company.com" },
          { label: "Preferred option", name: "option", placeholder: "Book only, bundle, reader circle" },
        ],
        submitText: "Reserve My Copy",
        buttonBackgroundColor: "#111827",
        buttonTextColor: "#ffffff",
      }),
    ],
  });
}

function buildBookOfferShort(theme) {
  return buildFunnelTemplate(theme, {
    slug: "home",
    brand: "Author Launch Studio",
    pageTitle: "Book Launch Landing Page",
    objective: "Sell a book or bundle with a shorter author page that still feels premium.",
    navLinks: [
      { label: "The Book", href: "#overview" },
      { label: "Reviews", href: "#proof" },
      { label: "Order", href: "#start" },
    ],
    navCtaText: "Buy Now",
    navCtaLink: "#start",
    palette: {
      navBg: "#f8fafc",
      navText: "#1f2937",
      navButtonBg: "#f59e0b",
      navButtonText: "#422006",
      heroBg: "#fff7ed",
      heroText: "#7c2d12",
      heroHeadline: "#111827",
      heroButtonBg: "#f59e0b",
      heroButtonText: "#422006",
      footerBg: "#1f2937",
      footerText: "#f9fafb",
    },
    hero: {
      variant: "framed",
      headline: "A shorter launch page for books that already have audience attention",
      subheadline: "Use this version for email launches, social traffic, speaking audiences, and warmer readers who mostly need the premise, a little proof, and an easy way to order.",
      ctaText: "Buy the Book",
      ctaLink: "#start",
      backgroundImage: "https://images.unsplash.com/photo-1495640388908-05fa85288e61?auto=format&fit=crop&w=1800&q=80",
      minHeight: "620px",
    },
    sections: [
      directBlock("feature-list", {
        title: "Keep the short launch page focused on",
        items: [
          "The book promise and who it is written for.",
          "One endorsements or review section to build confidence.",
          "A clear order path with bundle upsell if relevant.",
        ],
      }),
      directBlock("testimonial", {
        text: "This shorter page is ideal when the audience already knows the author and only needs a sharp case for buying now.",
        author: "Nina Brooks",
        role: "Launch Manager",
      }),
      directBlock("faq", {
        title: "Quick questions",
        items: [
          { question: "Should I use the long page?", answer: "Use the long page when the book is the centrepiece of a bigger launch or needs more worldview selling." },
          { question: "Can I upsell a workbook or bonus?", answer: "Yes. The short page still supports a simple bundle or preorder bonus stack." },
        ],
      }),
      directBlock("contact-form", {
        title: "Get your copy",
        subtitle: "Use this final block as the handoff to checkout or preorder registration.",
        mediaImage: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=80",
        mediaPosition: "right",
        fields: [
          { label: "Name", name: "name", placeholder: "Casey" },
          { label: "Email", name: "email", placeholder: "casey@company.com" },
        ],
        submitText: "Buy the Book",
        buttonBackgroundColor: "#1f2937",
        buttonTextColor: "#ffffff",
      }),
    ],
  });
}

function buildPlumberQuoteLong(theme) {
  return buildFunnelTemplate(theme, {
    slug: "home",
    brand: "RapidFlow Plumbing",
    pageTitle: "Plumber Quote Landing Page",
    objective: "Convert local plumbing traffic with a long-form quote page built for trust, urgency, and suburb-level service detail.",
    navLinks: [
      { label: "Services", href: "#overview" },
      { label: "Why Us", href: "#benefits" },
      { label: "Reviews", href: "#proof" },
      { label: "Get Quote", href: "#start" },
    ],
    navCtaText: "Request a Quote",
    navCtaLink: "#start",
    palette: {
      navBg: "#0c4a6e",
      navText: "#e0f2fe",
      navButtonBg: "#f97316",
      navButtonText: "#431407",
      heroBg: "#082f49",
      heroText: "#e0f2fe",
      heroHeadline: "#ffffff",
      heroButtonBg: "#f97316",
      heroButtonText: "#431407",
      footerBg: "#082f49",
      footerText: "#e0f2fe",
    },
    hero: {
      variant: "split",
      headline: "A plumber landing page should make urgency, trust, and next steps obvious in seconds",
      subheadline: "Use this long-form version for local services that need suburb coverage, service breakdowns, trust signals, emergency messaging, and repeated quote prompts before the lead reaches out.",
      ctaText: "Get a Fast Quote",
      ctaLink: "#start",
      backgroundImage: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1800&q=80",
      minHeight: "700px",
    },
    sections: [
      directBlock("stats", {
        items: [
          { value: "24/7", label: "emergency callouts" },
          { value: "5★", label: "review-focused trust layer" },
          { value: "Same Day", label: "service-positioning hook" },
        ],
      }),
      directBlock("services-list", {
        title: "Show the jobs you solve clearly",
        items: [
          { title: "Blocked drains", description: "Fast-response service with before/after outcomes and equipment notes." },
          { title: "Hot water systems", description: "Repairs, replacements, and upgrade options with clear urgency messaging." },
          { title: "Leak detection", description: "Trust-building copy focused on damage prevention and fast diagnosis." },
        ],
      }),
      directBlock("columns-3", {
        title: "What local-service buyers want to know",
        column1Title: "How fast?",
        column1Image: "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=900&q=80",
        column1: "Set expectations around response times, callout windows, and urgent jobs.",
        column2Title: "Can I trust you?",
        column2Image: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=900&q=80",
        column2: "Use licenses, guarantees, insurance, and review proof to remove doubt quickly.",
        column3Title: "Do you service my area?",
        column3Image: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=900&q=80",
        column3: "List suburbs, service zones, and common job types so the visitor feels seen immediately.",
      }),
      directBlock("image-gallery", {
        title: "Use job photos, van shots, and team imagery to build confidence",
        images: [
          { src: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80", alt: "Technician at work" },
          { src: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=80", alt: "Plumbing tools" },
          { src: "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80", alt: "Local service van" },
        ],
      }),
      directBlock("testimonial", {
        text: "The longer quote page helped because it answered the suburb, trust, and response-time questions before the customer ever had to call. That improved lead quality immediately.",
        author: "Darren Mills",
        role: "Local Service Owner",
      }),
      directBlock("faq", {
        title: "Quote-page FAQs that matter",
        items: [
          { question: "Do you offer emergency work?", answer: "Use this to explain hours, after-hours process, and response expectations." },
          { question: "Can I get a fixed quote?", answer: "Clarify inspection needs, callout policy, and how pricing is communicated." },
          { question: "Should a plumber use long-form?", answer: "Yes when the job value is high, competition is heavy, or the page must build trust for colder search traffic." },
        ],
      }),
      directBlock("contact-form", {
        title: "Request a plumbing quote",
        subtitle: "Use stronger qualification here so the team can call back with context and urgency.",
        mediaImage: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80",
        mediaPosition: "right",
        fields: [
          { label: "Name", name: "name", placeholder: "Jordan" },
          { label: "Phone", name: "phone", placeholder: "0412 345 678" },
          { label: "Suburb", name: "suburb", placeholder: "Parramatta" },
          { label: "What do you need fixed?", name: "job", type: "textarea", placeholder: "Blocked drain, hot water issue, leak, renovation plumbing..." },
        ],
        submitText: "Get My Quote",
        buttonBackgroundColor: "#082f49",
        buttonTextColor: "#ffffff",
      }),
    ],
  });
}

function buildPlumberQuoteShort(theme) {
  return buildFunnelTemplate(theme, {
    slug: "home",
    brand: "RapidFlow Plumbing",
    pageTitle: "Plumber Quote Landing Page",
    objective: "Drive quick plumbing quote requests from warmer local traffic with a tighter page.",
    navLinks: [
      { label: "Services", href: "#overview" },
      { label: "Quote", href: "#start" },
    ],
    navCtaText: "Call for a Quote",
    navCtaLink: "#start",
    palette: {
      navBg: "#f8fafc",
      navText: "#0f172a",
      navButtonBg: "#0284c7",
      navButtonText: "#ecfeff",
      heroBg: "#e0f2fe",
      heroText: "#0c4a6e",
      heroHeadline: "#082f49",
      heroButtonBg: "#0284c7",
      heroButtonText: "#ecfeff",
      footerBg: "#082f49",
      footerText: "#e0f2fe",
    },
    hero: {
      variant: "framed",
      headline: "A shorter plumbing page for local traffic that already wants someone fast and reliable",
      subheadline: "Use this version for Google Business traffic, repeat customers, and suburb-level campaigns where speed matters more than deep education.",
      ctaText: "Request a Fast Quote",
      ctaLink: "#start",
      backgroundImage: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1800&q=80",
      minHeight: "600px",
    },
    sections: [
      directBlock("feature-list", {
        title: "The short version should still show",
        items: [
          "Core service types and fast-response language.",
          "One trust block with ratings, guarantees, or years in business.",
          "A simple quote request form with phone and suburb fields.",
        ],
      }),
      directBlock("testimonial", {
        text: "This tighter page works well for branded traffic and urgent local needs where the visitor mainly wants confidence and a quick callback.",
        author: "Megan Price",
        role: "Operations Manager",
      }),
      directBlock("contact-form", {
        title: "Get a quote today",
        subtitle: "Keep it short, practical, and easy to submit from mobile.",
        mediaImage: "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80",
        mediaPosition: "right",
        fields: [
          { label: "Name", name: "name", placeholder: "Taylor" },
          { label: "Phone", name: "phone", placeholder: "0400 111 222" },
          { label: "Suburb", name: "suburb", placeholder: "Blacktown" },
        ],
        submitText: "Request Quote",
        buttonBackgroundColor: "#0284c7",
        buttonTextColor: "#ffffff",
      }),
      directBlock("faq", {
        title: "Quick questions",
        items: [
          { question: "Can I use the short page for ads?", answer: "Yes for branded or warmer local traffic. Use the long page if you need more proof and service detail." },
          { question: "Can I add suburb proof blocks later?", answer: "Yes. The short version is designed to expand if the campaign needs more local trust content." },
        ],
      }),
    ],
  });
}

function buildConsultantApplicationLong(theme) {
  return buildFunnelTemplate(theme, {
    slug: "home",
    brand: "Signal Advisory",
    pageTitle: "Consultant Application Page",
    objective: "Sell consulting or service time with a higher-trust long-form application page.",
    navLinks: [
      { label: "Who It Is For", href: "#overview" },
      { label: "Process", href: "#benefits" },
      { label: "Proof", href: "#proof" },
      { label: "Apply", href: "#start" },
    ],
    navCtaText: "Apply Now",
    navCtaLink: "#start",
    palette: {
      navBg: "#052e2b",
      navText: "#d1fae5",
      navButtonBg: "#a7f3d0",
      navButtonText: "#052e2b",
      heroBg: "#022c22",
      heroText: "#d1fae5",
      heroHeadline: "#ffffff",
      heroButtonBg: "#a7f3d0",
      heroButtonText: "#052e2b",
      footerBg: "#022c22",
      footerText: "#d1fae5",
    },
    hero: {
      variant: "split",
      headline: "Selling service time usually needs more trust, more specificity, and a better fit filter than a generic booking page",
      subheadline: "Use this long-form page for consultants, agencies, strategists, and experts selling premium service time. It gives you enough room to explain fit, method, outcomes, process, and application criteria before the lead submits.",
      ctaText: "Apply to Work Together",
      ctaLink: "#start",
      backgroundImage: "https://images.unsplash.com/photo-1454165205744-3b78555e5572?auto=format&fit=crop&w=1800&q=80",
      minHeight: "700px",
    },
    sections: [
      directBlock("feature-list", {
        title: "What premium service pages need",
        featureVariant: "cards",
        items: [
          "A clear explanation of who the offer is for and who should not apply.",
          "A process section that makes the engagement feel structured and premium.",
          "Proof, outcomes, and qualification language before the application form.",
        ],
      }),
      directBlock("columns-2", {
        title: "Fit over volume",
        leftTitle: "Not a fit",
        leftImage: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=80",
        leftContent: "Visitors who want instant fixes, unclear deliverables, or low-commitment support should filter themselves out.",
        rightTitle: "Ideal fit",
        rightImage: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80",
        rightContent: "The best buyer wants strategic help, values expertise, and is ready to act with urgency once accepted.",
      }),
      directBlock("testimonial", {
        text: "Once the page explained the process and who it was really for, the applications improved immediately. We stopped attracting curiosity clicks and started getting qualified buyers.",
        author: "Lauren Price",
        role: "Growth Consultant",
      }),
      directBlock("faq", {
        title: "Application questions to address",
        items: [
          { question: "What happens after someone applies?", answer: "Use this answer to describe screening, response time, call flow, and onboarding." },
          { question: "Do I need the long page?", answer: "Yes if the sale involves trust, expertise, fit filtering, or a high-ticket service offer." },
          { question: "Can this page sell audits or workshops too?", answer: "Yes. Swap the promise, outcomes, and form fields to fit the service type." },
        ],
      }),
      directBlock("contact-form", {
        title: "Apply to work together",
        subtitle: "Ask enough to improve lead quality without making the form feel punishing.",
        mediaImage: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80",
        mediaPosition: "right",
        fields: [
          { label: "Name", name: "name", placeholder: "Morgan" },
          { label: "Email", name: "email", placeholder: "morgan@business.com" },
          { label: "Company", name: "company", placeholder: "Growth Lab Co" },
          { label: "What do you need help with?", name: "goal", type: "textarea", placeholder: "Messaging, lead generation, conversion, launch planning..." },
        ],
        submitText: "Submit Application",
        buttonBackgroundColor: "#022c22",
        buttonTextColor: "#ffffff",
      }),
    ],
  });
}

function buildConsultantApplicationShort(theme) {
  return buildFunnelTemplate(theme, {
    slug: "home",
    brand: "Signal Advisory",
    pageTitle: "Consultant Application Page",
    objective: "Drive quicker consultant applications from warm referrals and return visitors.",
    navLinks: [
      { label: "Fit", href: "#overview" },
      { label: "Apply", href: "#start" },
    ],
    navCtaText: "Apply",
    navCtaLink: "#start",
    palette: {
      navBg: "#f0fdf4",
      navText: "#14532d",
      navButtonBg: "#166534",
      navButtonText: "#dcfce7",
      heroBg: "#dcfce7",
      heroText: "#166534",
      heroHeadline: "#052e16",
      heroButtonBg: "#166534",
      heroButtonText: "#dcfce7",
      footerBg: "#14532d",
      footerText: "#dcfce7",
    },
    hero: {
      variant: "framed",
      headline: "A shorter application page for referral traffic and buyers who already trust the expert",
      subheadline: "Use this version when the audience already understands the service and mainly needs fit language, one proof layer, and a clean application form.",
      ctaText: "Apply Now",
      ctaLink: "#start",
      backgroundImage: "https://images.unsplash.com/photo-1454165205744-3b78555e5572?auto=format&fit=crop&w=1800&q=80",
      minHeight: "600px",
    },
    sections: [
      directBlock("feature-list", {
        title: "Use the short version when you need",
        items: [
          "A simple fit statement.",
          "One concise proof or process block.",
          "A fast application path from warm traffic.",
        ],
      }),
      directBlock("contact-form", {
        title: "Apply to work together",
        subtitle: "Keep the form practical and high-signal.",
        mediaImage: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80",
        mediaPosition: "right",
        fields: [
          { label: "Name", name: "name", placeholder: "Alex" },
          { label: "Email", name: "email", placeholder: "alex@company.com" },
          { label: "Main priority", name: "priority", placeholder: "Pipeline, positioning, conversion..." },
        ],
        submitText: "Apply",
        buttonBackgroundColor: "#166534",
        buttonTextColor: "#ffffff",
      }),
      directBlock("faq", {
        title: "Quick questions",
        items: [
          { question: "When should I use the long page?", answer: "Use it when the sale needs more explanation, proof, or fit qualification." },
          { question: "Can this become a booking page?", answer: "Yes. Swap the form labels and CTA language to turn it into a direct booking flow." },
        ],
      }),
    ],
  });
}

function buildCourseOfferLong(theme) {
  return buildFunnelTemplate(theme, {
    slug: "home",
    brand: "Skillline Academy",
    pageTitle: "Course Enrollment Landing Page",
    objective: "Sell a digital course, membership, or workshop with a richer long-form enrollment page.",
    navLinks: [
      { label: "Program", href: "#overview" },
      { label: "Modules", href: "#benefits" },
      { label: "Results", href: "#proof" },
      { label: "Enroll", href: "#start" },
    ],
    navCtaText: "See the Curriculum",
    navCtaLink: "#benefits",
    palette: {
      navBg: "#312e81",
      navText: "#eef2ff",
      navButtonBg: "#c4b5fd",
      navButtonText: "#312e81",
      heroBg: "#1e1b4b",
      heroText: "#e0e7ff",
      heroHeadline: "#ffffff",
      heroButtonBg: "#c4b5fd",
      heroButtonText: "#312e81",
      footerBg: "#1e1b4b",
      footerText: "#e0e7ff",
    },
    hero: {
      variant: "spotlight",
      headline: "Long-form course pages work when the buyer needs to believe in the transformation before they believe in the curriculum",
      subheadline: "Use this template for courses, digital programs, cohorts, memberships, and guided trainings that need a bigger promise, module detail, proof, and multiple enrollment prompts.",
      ctaText: "Enroll Now",
      ctaLink: "#start",
      backgroundImage: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1800&q=80",
      minHeight: "700px",
    },
    sections: [
      directBlock("feature-list", {
        title: "What the page should prove",
        featureVariant: "cards",
        items: [
          "The learner outcome is clear and meaningful.",
          "The modules, framework, or support structure feel real and well organised.",
          "The offer stack and pricing make enrollment feel easy to justify.",
        ],
      }),
      directBlock("columns-3", {
        title: "What to showcase",
        column1Title: "Transformation",
        column1Image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
        column1: "Show the before-and-after state clearly so the course feels outcome-led, not content-led.",
        column2Title: "Curriculum",
        column2Image: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=900&q=80",
        column2: "Use modules, milestones, or lesson clusters to prove the program has shape and depth.",
        column3Title: "Support",
        column3Image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80",
        column3: "Explain what support, community, templates, or bonuses reduce the risk of buying.",
      }),
      directBlock("testimonial", {
        text: "The longer enrollment page helped because people could finally see the promise, the roadmap, and the support structure together. It made the course feel substantial.",
        author: "Olivia Marsh",
        role: "Program Creator",
      }),
      directBlock("pricing-table", {
        title: "Give buyers a clear enrollment path",
        pricingVariant: "spotlight",
        plans: [
          { name: "Self-Study", price: "$190", description: "Immediate access to the training and assets.", features: ["Core modules", "Worksheets", "Lifetime access"], cta: "Enroll Self-Study" },
          { name: "Guided", price: "$490", description: "Best for learners who want support and implementation help.", features: ["Everything in Self-Study", "Group coaching", "Templates", "Community"], highlighted: true, cta: "Enroll Guided" },
          { name: "VIP", price: "$990", description: "Premium option for buyers who want the fastest path and direct support.", features: ["Everything in Guided", "Private review", "Priority feedback"], cta: "Apply for VIP" },
        ],
      }),
      directBlock("faq", {
        title: "Enrollment questions",
        items: [
          { question: "Is this good for beginners?", answer: "Clarify the stage, baseline knowledge, and expected commitment needed to succeed." },
          { question: "How quickly can someone see progress?", answer: "Use this to reduce buyer hesitation around time-to-value." },
          { question: "When should I use the short page?", answer: "Use the short page when the audience already knows the creator and the offer needs less explanation." },
        ],
      }),
      directBlock("contact-form", {
        title: "Enroll in the program",
        subtitle: "Use this final block as your checkout or application handoff depending on the offer tier.",
        mediaImage: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
        mediaPosition: "right",
        fields: [
          { label: "Name", name: "name", placeholder: "Jamie" },
          { label: "Email", name: "email", placeholder: "jamie@company.com" },
          { label: "What do you want help with?", name: "goal", placeholder: "Launching, lead generation, writing, ads, systems..." },
        ],
        submitText: "Enroll Now",
        buttonBackgroundColor: "#1e1b4b",
        buttonTextColor: "#ffffff",
      }),
    ],
  });
}

function buildCourseOfferShort(theme) {
  return buildFunnelTemplate(theme, {
    slug: "home",
    brand: "Skillline Academy",
    pageTitle: "Course Enrollment Landing Page",
    objective: "Sell a course or workshop with a shorter enrollment page for warm audiences.",
    navLinks: [
      { label: "Program", href: "#overview" },
      { label: "Enroll", href: "#start" },
    ],
    navCtaText: "Enroll",
    navCtaLink: "#start",
    palette: {
      navBg: "#eef2ff",
      navText: "#312e81",
      navButtonBg: "#4f46e5",
      navButtonText: "#eef2ff",
      heroBg: "#e0e7ff",
      heroText: "#4338ca",
      heroHeadline: "#1e1b4b",
      heroButtonBg: "#4f46e5",
      heroButtonText: "#eef2ff",
      footerBg: "#1e1b4b",
      footerText: "#eef2ff",
    },
    hero: {
      variant: "framed",
      headline: "A shorter course page for warm traffic that already believes in the creator",
      subheadline: "Use this version when the audience mainly needs the offer summary, the enrollment path, and one clean proof layer before buying.",
      ctaText: "Enroll Today",
      ctaLink: "#start",
      backgroundImage: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1800&q=80",
      minHeight: "620px",
    },
    sections: [
      directBlock("feature-list", {
        title: "Short-form still needs",
        items: [
          "A clear transformation promise.",
          "A simple program or module summary.",
          "A direct enrollment CTA with one proof block nearby.",
        ],
      }),
      directBlock("testimonial", {
        text: "This short version is ideal for launches where the list already knows the creator and just needs a sharp reminder of the promise and the enrollment deadline.",
        author: "Keira Patel",
        role: "Education Marketer",
      }),
      directBlock("contact-form", {
        title: "Join the course",
        subtitle: "Use a simple final handoff to checkout or workshop registration.",
        mediaImage: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
        mediaPosition: "right",
        fields: [
          { label: "Name", name: "name", placeholder: "Jordan" },
          { label: "Email", name: "email", placeholder: "jordan@company.com" },
        ],
        submitText: "Enroll Now",
        buttonBackgroundColor: "#4f46e5",
        buttonTextColor: "#ffffff",
      }),
      directBlock("faq", {
        title: "Quick questions",
        items: [
          { question: "Should I use long-form instead?", answer: "Use long-form when the audience needs more proof, curriculum detail, or support explanation before buying." },
          { question: "Can I add pricing tiers later?", answer: "Yes. This short page is meant to be a lean base you can expand into a fuller enrollment page." },
        ],
      }),
    ],
  });
}

export const TEMPLATES = [
  {
    slug: "website-generic-premium",
    type: "website",
    name: "Generic Premium Website",
    blurb: "A polished generic business starter with stats, gallery, team, pricing, newsletter, and strong calls to action.",
    thumb:
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-generic-premium"),
  },
    // --- Animated/External Templates ---
    {
      slug: "framer-animated-portfolio",
      type: "website",
      name: "Framer Animated Portfolio",
      blurb: "A modern, animated portfolio template with hero animation, scroll-triggered fade-ins, and interactive project cards.",
      thumb: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
      build: (theme) => {
        // This is a simplified mapping of the external template.json structure to builder sections
        return {
          version: 1,
          theme_slug: theme,
          site: { logoText: "Your Portfolio", nav: [] },
          pages: [
            {
              slug: "home",
              title: "Home",
              sections: [
                {
                  id: uid(),
                  type: "hero",
                  props: {
                    title: "Showcase Your Work with Style",
                    subtitle: "A stunning animated hero section to grab attention.",
                    backgroundImage: "/lib/website-builder/external-templates/framer-animated-portfolio/hero-bg.jpg",
                    animation: { type: "fade-in", delay: 0, duration: 1 },
                  },
                },
                {
                  id: uid(),
                  type: "about",
                  props: {
                    title: "About Me",
                    text: "I’m a creative professional passionate about design, animation, and web experiences.",
                    animation: { type: "slide-up", delay: 0.2, duration: 0.8 },
                  },
                },
                {
                  id: uid(),
                  type: "projects",
                  props: {
                    title: "Selected Projects",
                    cards: [
                      { title: "Brand Redesign", desc: "A full rebrand for a SaaS company.", image: "/lib/website-builder/external-templates/framer-animated-portfolio/project1.jpg", interactive: true },
                      { title: "Animated Landing Page", desc: "A Framer-powered animated hero.", image: "/lib/website-builder/external-templates/framer-animated-portfolio/project2.jpg", interactive: true },
                      { title: "Mobile App UI", desc: "A smooth, animated mobile UI.", image: "/lib/website-builder/external-templates/framer-animated-portfolio/project3.jpg", interactive: true },
                    ],
                    animation: { type: "stagger-fade", delay: 0.3, duration: 1 },
                  },
                },
                {
                  id: uid(),
                  type: "contact",
                  props: {
                    title: "Let’s Work Together",
                    cta: "Contact Me",
                    email: "hello@yourdomain.com",
                    animation: { type: "fade-in", delay: 0.5, duration: 1 },
                  },
                },
              ],
            },
          ],
        };
      },
    },
  // WEBSITE
  {
    slug: "website-business-agency",
    type: "website",
    name: "Business / Agency",
    blurb: "Sharper agency starter with positioning, capabilities, proof, and conversion sections built for lead gen.",
    thumb:
      "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-business-agency"),
  },
  {
    slug: "website-coach-personal-brand",
    type: "website",
    name: "Coach / Personal Brand",
    blurb: "Authority-style personal brand site with story, signature offer, proof, and application flow.",
    thumb:
      "https://images.pexels.com/photos/4761663/pexels-photo-4761663.jpeg?auto=compress&cs=tinysrgb&w=1200",
    build: (theme) => buildProfiledWebsite(theme, "website-coach-personal-brand"),
  },
  {
    slug: "website-local-service",
    type: "website",
    name: "Local Service",
    blurb: "Tradie and local service layout focused on quotes, suburb coverage, and trust-building proof.",
    thumb:
      "https://images.unsplash.com/photo-1581091215367-59ab6dcef35b?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-local-service"),
  },
  {
    slug: "website-saas-simple",
    type: "website",
    name: "SaaS / App",
    blurb: "Product-led SaaS template with feature stacks, use cases, plan comparison, and trial CTA.",
    thumb:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-saas-simple"),
  },
  {
    slug: "website-restaurant-cafe",
    type: "website",
    name: "Restaurant / Cafe",
    blurb: "Venue template with menu highlights, atmosphere shots, reviews, and booking-first calls to action.",
    thumb:
      "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-restaurant-cafe"),
  },
  {
    slug: "website-portfolio-creative",
    type: "website",
    name: "Portfolio / Creative",
    blurb: "Creative showcase template for designers, videographers, photographers, and studios selling their eye.",
    thumb:
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-portfolio-creative"),
  },
  {
    slug: "website-medical-clinic",
    type: "website",
    name: "Medical / Clinic",
    blurb: "Professional clinic layout for allied health, dental, skin, physio, or specialist practices.",
    thumb:
      "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-medical-clinic"),
  },
  {
    slug: "website-law-firm",
    type: "website",
    name: "Law Firm",
    blurb: "Trust-first legal services template built for credibility, practice areas, and consultation booking.",
    thumb:
      "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-law-firm"),
  },
  {
    slug: "website-real-estate",
    type: "website",
    name: "Real Estate",
    blurb: "Agent and property marketing template with listings highlights, market proof, and appraisal CTA.",
    thumb:
      "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-real-estate"),
  },
  {
    slug: "website-salon-spa",
    type: "website",
    name: "Salon / Spa",
    blurb: "Beauty and wellness template with treatment highlights, social proof, and bookings-first structure.",
    thumb:
      "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-salon-spa"),
  },
  {
    slug: "website-fitness-gym",
    type: "website",
    name: "Gym / Fitness",
    blurb: "High-energy fitness template for gyms, coaching brands, studios, and transformation offers.",
    thumb:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-fitness-gym"),
  },
  {
    slug: "website-home-renovation",
    type: "website",
    name: "Builder / Renovation",
    blurb: "Residential build and renovation template with project gallery, process, and quote CTA.",
    thumb:
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-home-renovation"),
  },
  {
    slug: "website-accounting-bookkeeping",
    type: "website",
    name: "Accounting / Bookkeeping",
    blurb: "Professional services template for accountants, bookkeepers, BAS agents, and CFO-style advisory firms.",
    thumb:
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-accounting-bookkeeping"),
  },
  {
    slug: "website-plumbing-company",
    type: "website",
    name: "Plumbing",
    blurb: "Plumbing-specific website starter built for urgent jobs, hot water, maintenance, and stronger quote conversion.",
    thumb:
      "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-plumbing-company"),
  },
  {
    slug: "website-electrician-company",
    type: "website",
    name: "Electrical",
    blurb: "Electrical services template built for faults, switchboards, lighting installs, upgrades, and cleaner trust signals.",
    thumb:
      "https://images.unsplash.com/photo-1555963966-b7ae5404b6ed?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-electrician-company"),
  },
  {
    slug: "website-hvac-air-conditioning",
    type: "website",
    name: "HVAC / Air Conditioning",
    blurb: "HVAC starter built for repairs, installs, servicing, and maintenance-plan positioning across home and commercial work.",
    thumb:
      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-hvac-air-conditioning"),
  },
  {
    slug: "website-roofing-company",
    type: "website",
    name: "Roofing",
    blurb: "Roofing-focused template with stronger project proof, inspection-led quoting, and repair-to-re-roof framing.",
    thumb:
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-roofing-company"),
  },
  {
    slug: "website-cleaning-services",
    type: "website",
    name: "Cleaning Services",
    blurb: "Cleaning-business template built for recurring bookings, deep cleans, office work, and in-home trust-building.",
    thumb:
      "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-cleaning-services"),
  },
  {
    slug: "website-landscaping-lawn-care",
    type: "website",
    name: "Landscaping / Lawn Care",
    blurb: "Outdoor-services template built for lawn care, landscaping, maintenance plans, and photo-led property improvement work.",
    thumb:
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-landscaping-lawn-care"),
  },
  {
    slug: "website-pest-control",
    type: "website",
    name: "Pest Control",
    blurb: "Pest-control starter built for inspections, treatments, preventative plans, and higher-trust residential or commercial enquiries.",
    thumb:
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-pest-control"),
  },
  {
    slug: "website-solar-energy",
    type: "website",
    name: "Solar",
    blurb: "Solar-energy template built for rooftop systems, battery upgrades, commercial installs, and higher-trust quote flow.",
    thumb:
      "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-solar-energy"),
  },
  {
    slug: "website-pool-service",
    type: "website",
    name: "Pool Service",
    blurb: "Pool-service website starter built for recurring maintenance, water care, equipment checks, and premium outdoor presentation.",
    thumb:
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-pool-service"),
  },
  {
    slug: "website-auto-repair",
    type: "website",
    name: "Auto Repair",
    blurb: "Workshop-focused template built for vehicle servicing, diagnostics, mechanical repairs, and stronger booking confidence.",
    thumb:
      "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-auto-repair"),
  },
  {
    slug: "website-painting-decorating",
    type: "website",
    name: "Painting / Decorating",
    blurb: "Painting and decorating template built for premium finishes, residential repainting, exterior upgrades, and commercial project quoting.",
    thumb:
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-painting-decorating"),
  },
  {
    slug: "website-concreting-company",
    type: "website",
    name: "Concreting",
    blurb: "Concreting template built for driveways, slabs, decorative finishes, builder work, and stronger project-led quoting.",
    thumb:
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-concreting-company"),
  },
  {
    slug: "website-fencing-gates",
    type: "website",
    name: "Fencing / Gates",
    blurb: "Boundary and gates template built for timber, Colorbond, privacy upgrades, and stronger property-improvement positioning.",
    thumb:
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-fencing-gates"),
  },
  {
    slug: "website-flooring-tiling",
    type: "website",
    name: "Flooring / Tiling",
    blurb: "Finish-led flooring and tiling template built for surface upgrades, renovation work, and material-led project sales.",
    thumb:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-flooring-tiling"),
  },
  {
    slug: "website-garage-door-services",
    type: "website",
    name: "Garage Doors",
    blurb: "Garage door specialist template built for repairs, motors, replacements, and access-system trust from the first screen.",
    thumb:
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-garage-door-services"),
  },
  {
    slug: "website-glass-glazing",
    type: "website",
    name: "Glass / Glazing",
    blurb: "Glazing template built for shower screens, custom glass, splashbacks, replacements, and premium finish-led enquiries.",
    thumb:
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-glass-glazing"),
  },
  {
    slug: "website-mortgage-broker",
    type: "website",
    name: "Mortgage Broker",
    blurb: "Broker-led finance template built for first-home buyers, refinancing, investors, and stronger consultation quality.",
    thumb:
      "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-mortgage-broker"),
  },
  {
    slug: "website-ecommerce-store",
    type: "website",
    name: "Ecommerce / Online Store",
    blurb: "Storefront template built for collections, merchandising, product trust, and stronger online shopping flow.",
    thumb:
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildProfiledWebsite(theme, "website-ecommerce-store"),
  },

  // FUNNELS / LANDING (6)
  {
    slug: "funnel-optin-lead-magnet",
    type: "funnel",
    name: "Lead Magnet Landing Page (Long Form)",
    blurb: "Premium long-form opt-in page with richer visuals, stronger proof, and multiple signup moments.",
    thumb:
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildLeadMagnetLong(theme),
  },
  {
    slug: "funnel-optin-lead-magnet-short",
    type: "funnel",
    name: "Lead Magnet Landing Page (Short Form)",
    blurb: "Shorter high-conversion opt-in page for warmer traffic, promos, and faster list growth campaigns.",
    thumb:
      "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildLeadMagnetShort(theme),
  },
  {
    slug: "funnel-sales-longform",
    type: "funnel",
    name: "Sales Page (Long Form)",
    blurb: "Long-form premium sales page with visuals, proof, pricing, objection handling, and repeated CTAs.",
    thumb:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildSalesLong(theme),
  },
  {
    slug: "funnel-sales-shortform",
    type: "funnel",
    name: "Sales Page (Short Form)",
    blurb: "Shorter premium sales page for warmer traffic and simpler offers.",
    thumb:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildSalesShort(theme),
  },
  {
    slug: "funnel-checkout-page",
    type: "funnel",
    name: "Checkout Page",
    blurb: "Upgraded checkout page with order summary, reassurance, FAQ, and a cleaner final action.",
    thumb:
      "https://images.unsplash.com/photo-1556745757-8d76bdb6984b?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildCheckoutPage(theme),
  },
  {
    slug: "funnel-thankyou-page",
    type: "funnel",
    name: "Thank You Page",
    blurb: "Post-signup or post-purchase page with clear next steps, resources, and follow-up action.",
    thumb:
      "https://images.unsplash.com/photo-1520975867597-0f1b0a6b1b00?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildThankYouPage(theme),
  },
  {
    slug: "funnel-webinar-registration",
    type: "funnel",
    name: "Webinar Registration (Long Form)",
    blurb: "Long-form webinar registration page with agenda, proof, imagery, and stronger seat-reservation flow.",
    thumb:
      "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildWebinarLong(theme),
  },
  {
    slug: "funnel-webinar-registration-short",
    type: "funnel",
    name: "Webinar Registration (Short Form)",
    blurb: "Shorter webinar registration page for warmer audiences and tighter event promos.",
    thumb:
      "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildWebinarShort(theme),
  },
  {
    slug: "funnel-booking-application",
    type: "funnel",
    name: "Booking / Application (Long Form)",
    blurb: "Long-form booking or application page that qualifies better leads before the first call.",
    thumb:
      "https://images.unsplash.com/photo-1551836022-deb4988cc6c0?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildBookingLong(theme),
  },
  {
    slug: "funnel-booking-application-short",
    type: "funnel",
    name: "Booking / Application (Short Form)",
    blurb: "Shorter booking or application page for warm leads who already want to talk.",
    thumb:
      "https://images.unsplash.com/photo-1454165205744-3b78555e5572?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildBookingShort(theme),
  },
  {
    slug: "funnel-affiliate-review-long",
    type: "funnel",
    name: "Affiliate Review Page (Long Form)",
    blurb: "Long-form affiliate bridge/review page with comparison structure, bonuses, proof, and repeated click-through CTAs.",
    thumb:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildAffiliateReviewLong(theme),
  },
  {
    slug: "funnel-affiliate-review-short",
    type: "funnel",
    name: "Affiliate Review Page (Short Form)",
    blurb: "Shorter affiliate page for warmer audiences who need a recommendation, bonus stack, and fast CTA path.",
    thumb:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildAffiliateReviewShort(theme),
  },
  {
    slug: "funnel-book-launch-long",
    type: "funnel",
    name: "Book Launch Page (Long Form)",
    blurb: "Long-form author/book launch page with cover-led visuals, endorsements, chapter value, bundles, and order flow.",
    thumb:
      "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildBookOfferLong(theme),
  },
  {
    slug: "funnel-book-launch-short",
    type: "funnel",
    name: "Book Launch Page (Short Form)",
    blurb: "Shorter author launch page for warmer readers, existing audiences, and faster book-buying campaigns.",
    thumb:
      "https://images.unsplash.com/photo-1495640388908-05fa85288e61?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildBookOfferShort(theme),
  },
  {
    slug: "funnel-plumber-quote-long",
    type: "funnel",
    name: "Plumber Quote Page (Long Form)",
    blurb: "Long-form local service page for plumbers and tradies with trust blocks, service detail, suburb context, and stronger lead qualification.",
    thumb:
      "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildPlumberQuoteLong(theme),
  },
  {
    slug: "funnel-plumber-quote-short",
    type: "funnel",
    name: "Plumber Quote Page (Short Form)",
    blurb: "Shorter plumber/local quote page for urgent traffic, branded search, and quick callback conversions.",
    thumb:
      "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildPlumberQuoteShort(theme),
  },
  {
    slug: "funnel-consultant-application-long",
    type: "funnel",
    name: "Consultant Application Page (Long Form)",
    blurb: "Long-form service-time page for consultants, strategists, and premium experts who need fit filtering and trust-building before application.",
    thumb:
      "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildConsultantApplicationLong(theme),
  },
  {
    slug: "funnel-consultant-application-short",
    type: "funnel",
    name: "Consultant Application Page (Short Form)",
    blurb: "Shorter premium service application page for warm referrals, repeat visitors, and faster qualification flows.",
    thumb:
      "https://images.unsplash.com/photo-1454165205744-3b78555e5572?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildConsultantApplicationShort(theme),
  },
  {
    slug: "funnel-course-enrollment-long",
    type: "funnel",
    name: "Course Enrollment Page (Long Form)",
    blurb: "Long-form course or program page with transformation framing, curriculum structure, offer stack, and enrollment CTAs.",
    thumb:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildCourseOfferLong(theme),
  },
  {
    slug: "funnel-course-enrollment-short",
    type: "funnel",
    name: "Course Enrollment Page (Short Form)",
    blurb: "Shorter course/workshop enrollment page for launch lists, warmer traffic, and faster decision-making.",
    thumb:
      "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => buildCourseOfferShort(theme),
  },
];

export function getTheme(themeSlug) {
  return TEMPLATES.find((t) => t.slug === themeSlug) || TEMPLATES[0];
}



// Loads an external template from /lib/website-builder/external-templates/{slug}/template.json
export function getExternalTemplate(slug) {
  if (typeof window !== "undefined") return null;
  if (!slug) return null;

  try {
    const fs = require("fs");
    const path = require("path");
    const templatePath = path.join(
      process.cwd(),
      "lib",
      "website-builder",
      "external-templates",
      slug,
      "template.json"
    );
    if (fs.existsSync(templatePath)) {
      const raw = fs.readFileSync(templatePath, "utf8");
      return JSON.parse(raw);
    }
  } catch (e) {
    // ignore
  }
  return null;
}

export function getTemplate(templateSlug) {
  // Prefer external templates if available
  const ext = getExternalTemplate(templateSlug);
  if (ext) return ext;
  return TEMPLATES.find((t) => t.slug === templateSlug) || TEMPLATES[0];
}

export function getTemplatePageDefinitions(templateSlug, theme = "modern-blue") {
  const built = getTemplate(templateSlug)?.build?.(theme);
  const pages = Array.isArray(built?.pages) ? built.pages : [];
  return pages.map((page, index) => ({
    name: page?.title || page?.name || page?.slug || (index === 0 ? "Home" : `Page ${index + 1}`),
    slug: page?.slug || `page-${index + 1}`,
    objective: page?.objective || "Customize sections and publish this page.",
  }));
}
