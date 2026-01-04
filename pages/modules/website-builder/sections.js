// Central section definitions

export const SECTIONS = {
  hero: {
    label: "Hero",
    color: "#2563eb",
    create: () => ({
      type: "hero",
      heading: "Grow your business faster",
      text: "Everything you need to build high-converting pages.",
      button: "Get Started",
    }),
  },

  heroImage: {
    label: "Hero + Image",
    color: "#7c3aed",
    create: () => ({
      type: "heroImage",
      heading: "Turn visitors into customers",
      text: "Modern, fast, and built to convert.",
      image: "/placeholder.png",
      button: "Learn More",
    }),
  },

  features3: {
    label: "3 Features",
    color: "#0d9488",
    create: () => ({
      type: "features3",
      items: [
        { title: "Fast", text: "Lightning quick load times" },
        { title: "Flexible", text: "Fully custom layouts" },
        { title: "Simple", text: "Easy to edit and scale" },
      ],
    }),
  },

  optin: {
    label: "Opt-in Form",
    color: "#ca8a04",
    create: () => ({
      type: "optin",
      heading: "Get the free guide",
      text: "Enter your email to get instant access.",
      button: "Send me the guide",
    }),
  },

  faq: {
    label: "FAQ",
    color: "#be123c",
    create: () => ({
      type: "faq",
      items: [
        { q: "How does this work?", a: "Drag, drop, publish." },
        { q: "Can I edit later?", a: "Yes, anytime." },
      ],
    }),
  },

  cta: {
    label: "Call To Action",
    color: "#0284c7",
    create: () => ({
      type: "cta",
      heading: "Ready to get started?",
      button: "Start Now",
    }),
  },
};

export const STARTER_TEMPLATES = {
  blank: [],
  optin: [
    "hero",
    "optin",
    "features3",
    "cta",
  ],
  sales: [
    "heroImage",
    "features3",
    "faq",
    "cta",
  ],
};
