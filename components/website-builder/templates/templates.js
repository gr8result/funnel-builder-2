// /components/website-builder/templates/templates.js
// FULL REPLACEMENT — NO HARDCODED CUSTOMER NAMES

function uid(prefix = "b") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * Templates are intentionally GENERIC.
 * The logged-in user's brand/name is applied later by the app (inheritBrandFrom).
 */
export const TEMPLATES = [
  { key: "starter_clean", name: "Starter — Clean Landing" },
  { key: "starter_product", name: "Starter — Product Launch" },
  { key: "starter_agency", name: "Starter — Agency / Service" },
  { key: "starter_event", name: "Starter — Event / Webinar" },
];

function baseBrand(override = {}) {
  return {
    siteName: override.siteName || "New Website",
    brandName: override.brandName || "Your Business",
    accent: override.accent || "#2297c5",
  };
}

function tpl_clean(brand) {
  return [
    {
      id: uid(),
      type: "hero",
      kicker: "WELCOME",
      headline: "A headline that clearly says what you do",
      subheadline:
        "One short sentence explaining your offer and the outcome your customer gets.",
      bullets: ["Clear promise", "Clear proof", "Clear next step"],
      buttonText: "Get started",
      background: {
        mode: "gradient",
        gradient:
          "linear-gradient(135deg, rgba(34,151,197,0.18), rgba(0,0,0,0.18))",
      },
    },
    {
      id: uid(),
      type: "features",
      heading: "Why choose us",
      items: [
        { title: "Fast", text: "Get a page live quickly and refine later." },
        { title: "Simple", text: "Edit block-by-block without fighting the UI." },
        { title: "Responsive", text: "Looks good on desktop and mobile." },
      ],
      background: { mode: "theme" },
    },
    {
      id: uid(),
      type: "image",
      caption: "Hero / showcase image",
      src: "",
      fit: "cover",
      background: { mode: "transparent" },
    },
    {
      id: uid(),
      type: "cta",
      heading: "Ready to take the next step?",
      body: "Add your CTA text here. Keep it short and direct.",
      buttonText: "Book now",
      background: { mode: "solid", color: "rgba(34,151,197,0.10)" },
    },
    {
      id: uid(),
      type: "footer",
      text: `© ${brand.brandName}. All rights reserved.`,
      background: { mode: "transparent" },
    },
  ];
}

function tpl_product(brand) {
  return [
    {
      id: uid(),
      type: "hero",
      kicker: brand.brandName.toUpperCase(),
      headline: "Launch your next product with confidence",
      subheadline:
        "A clean layout with a strong hero, features, image slot, and CTA — ready for real content.",
      bullets: ["Great first impression", "Feature highlights", "Strong CTA"],
      buttonText: "Join waitlist",
      background: {
        mode: "gradient",
        gradient:
          "linear-gradient(135deg, rgba(34,151,197,0.14), rgba(0,0,0,0.22))",
      },
    },
    {
      id: uid(),
      type: "features",
      heading: "What makes it different",
      items: [
        { title: "Simple", text: "Clear value in plain language." },
        { title: "Useful", text: "Solves a real problem for your customer." },
        { title: "Trusted", text: "Add proof, reviews, logos, or stats." },
      ],
      background: { mode: "theme" },
    },
    {
      id: uid(),
      type: "image",
      caption: "Product image",
      src: "",
      fit: "cover",
      background: { mode: "transparent" },
    },
    {
      id: uid(),
      type: "cta",
      heading: "Get early access",
      body: "Collect emails here and connect it to your lead forms later.",
      buttonText: "Notify me",
      background: { mode: "solid", color: "rgba(34,151,197,0.08)" },
    },
    {
      id: uid(),
      type: "footer",
      text: `© ${brand.brandName}. All rights reserved.`,
      background: { mode: "transparent" },
    },
  ];
}

function tpl_agency(brand) {
  return [
    {
      id: uid(),
      type: "hero",
      kicker: "SERVICE / AGENCY",
      headline: "A premium service page that converts",
      subheadline:
        "Use this for agencies, coaches, tradies, consultants — anyone selling a service.",
      bullets: ["Clear offer", "Simple process", "Quick CTA"],
      buttonText: "Get a quote",
      background: {
        mode: "gradient",
        gradient:
          "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(0,0,0,0.25))",
      },
    },
    {
      id: uid(),
      type: "features",
      heading: "What we do",
      items: [
        { title: "Step 1", text: "We understand your goal." },
        { title: "Step 2", text: "We build a plan." },
        { title: "Step 3", text: "We deliver results." },
      ],
      background: { mode: "theme" },
    },
    {
      id: uid(),
      type: "cta",
      heading: "Want to talk?",
      body: "Put your booking link here (Calendly, GR8 Calendar, etc).",
      buttonText: "Book a call",
      background: { mode: "solid", color: "rgba(244,63,94,0.10)" },
    },
    {
      id: uid(),
      type: "footer",
      text: `© ${brand.brandName}. All rights reserved.`,
      background: { mode: "transparent" },
    },
  ];
}

function tpl_event(brand) {
  return [
    {
      id: uid(),
      type: "hero",
      kicker: "EVENT",
      headline: "Webinar / Event title goes here",
      subheadline:
        "One sentence explaining who it’s for and what they’ll learn or gain.",
      bullets: ["Date & time", "Key outcomes", "Register CTA"],
      buttonText: "Register",
      background: {
        mode: "gradient",
        gradient:
          "linear-gradient(135deg, rgba(34,151,197,0.12), rgba(0,0,0,0.22))",
      },
    },
    {
      id: uid(),
      type: "text",
      heading: "What you’ll learn",
      body:
        "List 3–5 bullet points or short paragraphs. Keep it direct and useful.",
      background: { mode: "transparent" },
    },
    {
      id: uid(),
      type: "cta",
      heading: "Save your seat",
      body: "Connect this to a form later. For now, it’s your layout foundation.",
      buttonText: "Register now",
      background: { mode: "solid", color: "rgba(34,151,197,0.08)" },
    },
    {
      id: uid(),
      type: "footer",
      text: `© ${brand.brandName}. All rights reserved.`,
      background: { mode: "transparent" },
    },
  ];
}

export function makeTemplateSite(templateKey, opts = {}) {
  // inheritBrandFrom is where the app passes the LOGGED IN user's brand
  const inherit = opts.inheritBrandFrom || {};
  const brand = baseBrand({
    siteName: inherit.siteName,
    brandName: inherit.brandName,
    accent: inherit.accent,
  });

  let blocks = [];
  if (templateKey === "starter_product") blocks = tpl_product(brand);
  else if (templateKey === "starter_agency") blocks = tpl_agency(brand);
  else if (templateKey === "starter_event") blocks = tpl_event(brand);
  else blocks = tpl_clean(brand);

  return {
    version: 1,
    brand,
    blocks,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
