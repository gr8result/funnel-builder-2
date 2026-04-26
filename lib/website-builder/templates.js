// --- Animated/External Templates ---
// Removed TEMPLATES.push. All templates should be defined inline in the TEMPLATES array below.


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
  {
    slug: "website-generic-premium",
    type: "website",
    name: "Generic Premium Website",
    blurb: "A polished generic business starter with stats, gallery, team, pricing, newsletter, and strong calls to action.",
    thumb:
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80",
    build: (theme) => {
      const p = basePage(theme);
      p.pages[0].sections = [
        S.header({ ctaLabel: "Start Project", ctaHref: "#contact" }),
        S.hero({
          eyebrow: "MODERN WEBSITE",
          title: "A clean generic website starter that feels premium out of the box",
          subtitle: "Use this as the base for consulting, services, software, local business, or a brand site.",
          primaryLabel: "Get Started",
          primaryHref: "#contact",
          secondaryLabel: "View Services",
          secondaryHref: "#services",
          imageUrl: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80",
        }),
        {
          type: "stats",
          props: {
            title: "Built for serious presentation",
            items: [
              { value: "24/7", label: "Online presence" },
              { value: "3x", label: "Clearer offer structure" },
              { value: "100%", label: "Editable by your team" },
            ],
          },
        },
        S.services({
          title: "Everything a strong website needs",
          subtitle: "Start generic, then tailor every section to the business.",
          items: [
            { title: "Clear messaging", text: "Headline, proof, positioning, and next steps." },
            { title: "Service sections", text: "Packages, features, FAQs, and trust builders." },
            { title: "Lead capture", text: "Strong contact and conversion sections." },
          ],
        }),
        {
          type: "gallery",
          props: {
            title: "Visual Highlights",
            images: [
              { src: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80", alt: "Workspace" },
              { src: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80", alt: "Team" },
              { src: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80", alt: "Strategy" },
            ],
          },
        },
        {
          type: "team",
          props: {
            title: "Present the people behind the business",
            members: [
              { name: "Alex Morgan", role: "Founder", bio: "Position the founder with a clear market promise." },
              { name: "Jordan Lee", role: "Strategy Lead", bio: "Explain how the business actually helps customers succeed." },
            ],
          },
        },
        S.testimonials({ title: "Use proof to reduce hesitation" }),
        S.pricing({ title: "Keep the offer simple and easy to compare" }),
        {
          type: "newsletter",
          props: {
            title: "Stay in the loop",
            subtitle: "Capture leads or subscribers with a clean signup section.",
          },
        },
        S.faq({ title: "Answer the objections before they ask" }),
        S.contact({ title: "Start the conversation" }),
        S.footer(),
      ];
      return p;
    },
  },
    // --- Animated/External Templates ---
    {
      slug: "framer-animated-portfolio",
      type: "website",
      name: "Framer Animated Portfolio",
      blurb: "A modern, animated portfolio template with hero animation, scroll-triggered fade-ins, and interactive project cards.",
      thumb: "/lib/website-builder/external-templates/framer-animated-portfolio/preview.png",
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
      "https://images.pexels.com/photos/4761663/pexels-photo-4761663.jpeg?auto=compress&cs=tinysrgb&w=1200",
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
      "https://images.unsplash.com/photo-1581091215367-59ab6dcef35b?auto=format&fit=crop&w=1200&q=80",
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
      "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1200&q=80",
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



// Loads an external template from /lib/website-builder/external-templates/{slug}/template.json
export function getExternalTemplate(slug) {
  try {
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
