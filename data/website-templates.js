// /data/website-templates.js
// Starter Website Templates (System)

export const WEBSITE_TEMPLATES = [
  {
    name: "Service Business",
    category: "service",
    template: {
      siteName: "Your Business Name",
      theme: "Modern Blue",
      sections: [
        {
          type: "hero",
          kicker: "WELCOME",
          headline: "Professional services that get results",
          subheadline:
            "We help businesses grow with clear strategy, great execution, and measurable outcomes.",
          bullets: ["Clear pricing", "Fast turnaround", "Real support"],
          buttonText: "Book a call",
        },
        {
          type: "testimonials",
          heading: "What our clients say",
          items: [
            {
              quote: "Straightforward, professional, and effective.",
              name: "Alex R.",
              title: "Business Owner",
            },
            {
              quote: "We saw results within weeks.",
              name: "Jamie L.",
              title: "Director",
            },
          ],
        },
        {
          type: "faq",
          heading: "Frequently asked questions",
          items: [
            {
              q: "How quickly can we start?",
              a: "Most projects begin within a few days.",
            },
            {
              q: "Is there a contract?",
              a: "No long-term lock-ins.",
            },
          ],
        },
        {
          type: "footer",
          text: "© Your Business. All rights reserved.",
        },
      ],
    },
  },

  {
    name: "SaaS Landing Page",
    category: "saas",
    template: {
      siteName: "Your App",
      theme: "Modern Blue",
      sections: [
        {
          type: "hero",
          kicker: "INTRODUCING",
          headline: "One platform. Everything you need.",
          subheadline:
            "Manage your business, automate your workflow, and grow faster — all in one place.",
          bullets: ["No setup pain", "All-in-one", "Built to scale"],
          buttonText: "Start free",
        },
        {
          type: "testimonials",
          heading: "Loved by teams",
          items: [
            {
              quote: "We replaced 5 tools with this.",
              name: "Chris M.",
              title: "Founder",
            },
            {
              quote: "Clean, fast, and intuitive.",
              name: "Dana S.",
              title: "Product Lead",
            },
          ],
        },
        {
          type: "footer",
          text: "© Your App. All rights reserved.",
        },
      ],
    },
  },

  {
    name: "Fitness / Health Brand",
    category: "health",
    template: {
      siteName: "Waite and Sea",
      theme: "Modern Blue",
      sections: [
        {
          type: "hero",
          kicker: "WAITE & SEA",
          headline: "Train better. Feel stronger.",
          subheadline:
            "Programs, nutrition, and coaching designed for real results.",
          bullets: ["Expert coaching", "Proven methods", "Real community"],
          buttonText: "Join now",
        },
        {
          type: "testimonials",
          heading: "Real transformations",
          items: [
            {
              quote: "Best shape of my life.",
              name: "Sam T.",
              title: "Client",
            },
          ],
        },
        {
          type: "footer",
          text: "© Waite and Sea. All rights reserved.",
        },
      ],
    },
  },
];
