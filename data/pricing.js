// /data/pricing.js
// Master pricing file used by Billing + Checkout + Auto Upgrades
// Includes Email Marketing tiers with enforced upgrade hierarchy

const PRICING = {
  // ====== CORE MODULES ======
  "website-builder": { name: "Website Builder", price: 29 },
  "funnels": { name: "Funnels", price: 29 },
  "automation": { name: "Business Automation", price: 29 },
  "courses": { name: "Online Courses", price: 19 },
  "products": { name: "Physical Products", price: 29 },
  "webinars": { name: "Webinars", price: 29 },
  "calendar": { name: "Calendar", price: 19 },
  "subscription": { name: "Subscription Pipeline", price: 19 },
  "communities": { name: "Communities", price: 19 },
  "social": { name: "Social Media", price: 29 },
  // "subaccounts" removed — workspace model replaces agency/subaccount architecture
  "digital-products": { name: "Digital Products", price: 19 },

  // ====== WEBSITE BUILDER PLANS ======
  "website-starter": {
    name: "Website Builder — Starter",
    price: 29,
    limits: { websites: 1, customDomain: false, aiBuilder: false, ecommerce: false, blogPages: 5 },
    upgradeTo: "website-growth",
  },
  "website-growth": {
    name: "Website Builder — Growth",
    price: 59,
    limits: { websites: 2, customDomain: true, aiBuilder: "content", ecommerce: false, blogPages: "unlimited" },
    upgradeTo: "website-pro",
  },
  "website-pro": {
    name: "Website Builder — Scale",
    price: 79,
    limits: { websites: 3, customDomain: true, aiBuilder: "full", ecommerce: true, blogPages: "unlimited" },
    upgradeTo: "website-agency",
  },
  "website-agency": {
    name: "Website Builder — Professional",
    price: 149,
    limits: { websites: 5, customDomain: true, aiBuilder: "full", ecommerce: true, blogPages: "unlimited" },
    upgradeTo: null,
  },

  // ====== CALENDAR BOOKING PLANS ======
  "calendar-starter": {
    name: "Calendar — Starter",
    price: 19,
    limits: { calendars: 1, bookingsPerMonth: 50, bookingPages: 1, teamMembers: 1 },
    upgradeTo: "calendar-growth",
  },
  "calendar-growth": {
    name: "Calendar — Growth",
    price: 29,
    limits: { calendars: "unlimited", bookingsPerMonth: "unlimited", bookingPages: 5, teamMembers: 3 },
    upgradeTo: "calendar-pro",
  },
  "calendar-pro": {
    name: "Calendar — Scale",
    price: 79,
    limits: { calendars: "unlimited", bookingsPerMonth: "unlimited", bookingPages: "unlimited", teamMembers: "unlimited" },
    upgradeTo: "calendar-agency",
  },
  "calendar-agency": {
    name: "Calendar — Professional",
    price: 149,
    limits: { calendars: "unlimited", bookingsPerMonth: "unlimited", bookingPages: "unlimited", teamMembers: "unlimited" },
    upgradeTo: null,
  },

  // ====== EMAIL MARKETING PLANS ======
  "email-free": {
    name: "Email Marketing — Free",
    price: 0,
    limits: { subscribers: 250, monthlyEmails: 500 },
  },
  "email-starter": {
    name: "Email Marketing — Starter",
    price: 59,
    limits: { subscribers: 5000, monthlyEmails: 50000 },
    upgradeTo: "email-growth",
  },
  "email-growth": {
    name: "Email Marketing — Growth",
    price: 99,
    limits: { subscribers: 15000, monthlyEmails: 150000 },
    upgradeTo: "email-pro",
  },
  "email-pro": {
    name: "Email Marketing — Pro",
    price: 199,
    limits: { subscribers: 40000, monthlyEmails: 400000 },
    upgradeTo: "email-advanced",
  },
  "email-advanced": {
    name: "Email Marketing — Advanced",
    price: 499,
    limits: { subscribers: 200000, monthlyEmails: 2000000 },
    upgradeTo: "email-enterprise",
  },
  "email-enterprise": {
    name: "Email Marketing — Enterprise",
    price: 0,
    limits: { subscribers: "custom", monthlyEmails: "custom" },
    upgradeTo: null,
  },
  // Legacy keys
  "email-expansion": {
    name: "Email Marketing — Expansion",
    price: 250,
    limits: { subscribers: 15000, monthlyEmails: 30000 },
  },
  "email-agency": {
    name: "Email Marketing — Agency",
    price: 0,
    limits: { subscribers: "custom", monthlyEmails: "custom" },
  },

  // ====== SMS MARKETING PLANS ======
  "sms-starter": {
    name: "SMS Marketing — Starter",
    price: 25,
    limits: {
      monthlyMessages: 500,
      listSize: 500,
    },
    upgradeTo: "sms-growth",
  },
  "sms-growth": {
    name: "SMS Marketing — Growth",
    price: 120,
    limits: {
      monthlyMessages: 2500,
      listSize: 2500,
    },
    upgradeTo: "sms-professional",
  },
  "sms-professional": {
    name: "SMS Marketing — Professional",
    price: 229,
    limits: {
      monthlyMessages: 5000,
      listSize: 5000,
    },
    upgradeTo: "sms-business",
  },
  "sms-business": {
    name: "SMS Marketing — Business",
    price: 429,
    limits: {
      monthlyMessages: 10000,
      listSize: 10000,
    },
    upgradeTo: "sms-enterprise",
  },
  "sms-enterprise": {
    name: "SMS Marketing — Enterprise",
    price: 0, // Custom pricing
    limits: {
      monthlyMessages: "custom",
      listSize: "custom",
    },
    upgradeTo: null,
  },

  // ====== SOCIAL MEDIA AI PLANS ======
  "social-starter": {
    name: "Social Media — Starter",
    price: 29,
    limits: {
      aiPostsPerMonth: 50,
      platforms: 3,
      aiImagesPerMonth: 10,
      campaigns: 1,
      scheduling: true,
    },
    upgradeTo: "social-growth",
  },
  "social-growth": {
    name: "Social Media — Growth",
    price: 79,
    limits: {
      aiPostsPerMonth: 200,
      platforms: 7,
      aiImagesPerMonth: 50,
      campaigns: 5,
      scheduling: true,
    },
    upgradeTo: "social-pro",
  },
  "social-pro": {
    name: "Social Media — Pro",
    price: 149,
    limits: {
      aiPostsPerMonth: 500,
      platforms: 7,
      aiImagesPerMonth: 150,
      campaigns: 20,
      scheduling: true,
    },
    upgradeTo: "social-agency",
  },
  "social-agency": {
    name: "Social Media — Agency",
    price: 299,
    limits: {
      aiPostsPerMonth: 2000,
      platforms: 7,
      aiImagesPerMonth: 500,
      campaigns: "unlimited",
      scheduling: true,
    },
    upgradeTo: null,
  },

  // ─── CRM tiers ─────────────────────────────────────────────────
  "crm-starter": {
    name: "CRM — Starter",
    price: 19,
    limits: { pipelines: 1, contacts: 500, automationTriggers: false, customFields: 5, apiAccess: false },
    upgradeTo: "crm-growth",
  },
  "crm-growth": {
    name: "CRM — Growth",
    price: 29,
    limits: { pipelines: "unlimited", contacts: 5000, automationTriggers: true, customFields: 25, apiAccess: false },
    upgradeTo: "crm-pro",
  },
  "crm-pro": {
    name: "CRM — Pro",
    price: 79,
    limits: { pipelines: "unlimited", contacts: 25000, automationTriggers: true, customFields: "unlimited", apiAccess: true },
    upgradeTo: "crm-agency",
  },
  "crm-agency": {
    name: "CRM — Agency",
    price: 199,
    limits: { pipelines: "unlimited", contacts: "unlimited", automationTriggers: true, customFields: "unlimited", apiAccess: true },
    upgradeTo: null,
  },

  // ─── Funnel add-on packs ──────────────────────────────────────────
  "funnel-pack-s": {
    name: "Funnels — Pack S",
    price: 19,
    limits: { extraFunnels: 2 },
    upgradeTo: "funnel-pack-m",
  },
  "funnel-pack-m": {
    name: "Funnels — Pack M",
    price: 39,
    limits: { extraFunnels: 5 },
    upgradeTo: "funnel-pack-l",
  },
  "funnel-pack-l": {
    name: "Funnels — Pack L",
    price: 79,
    limits: { extraFunnels: 10 },
    upgradeTo: "funnel-unlimited",
  },
  "funnel-unlimited": {
    name: "Funnels — Unlimited",
    price: 99,
    limits: { extraFunnels: "unlimited" },
    upgradeTo: null,
  },

  // ====== PROJECTS HUB PLANS (Job Board + Gantt Charts combined) ======
  "projects-hub-starter": {
    name: "Projects Hub — Starter",
    price: 35,
    limits: { activeJobs: 3, boards: 1, projects: 5, tasks: 50, users: 2, timeTracking: false, gantt: true, jobBoard: true },
    upgradeTo: "projects-hub-growth",
  },
  "projects-hub-growth": {
    name: "Projects Hub — Growth",
    price: 59,
    limits: { activeJobs: 15, boards: 3, projects: 20, tasks: "unlimited", users: 5, timeTracking: true, gantt: true, jobBoard: true, dependencies: true },
    upgradeTo: "projects-hub-pro",
  },
  "projects-hub-pro": {
    name: "Projects Hub — Scale",
    price: 99,
    limits: { activeJobs: "unlimited", boards: "unlimited", projects: "unlimited", tasks: "unlimited", users: 15, timeTracking: true, gantt: true, jobBoard: true, dependencies: true, resourceAllocation: true, budgetTracking: true, criticalPath: true, clientPortal: true, automation: true },
    upgradeTo: "projects-hub-agency",
  },
  "projects-hub-agency": {
    name: "Projects Hub — Professional",
    price: 159,
    limits: { activeJobs: "unlimited", boards: "unlimited", projects: "unlimited", tasks: "unlimited", users: "unlimited", timeTracking: true, gantt: true, jobBoard: true, dependencies: true, resourceAllocation: true, budgetTracking: true, criticalPath: true, clientPortal: true, automation: true, whiteLabel: true, apiAccess: true },
    upgradeTo: null,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// BASE_PLAN_INCLUDES
// Maps each base platform plan to the module tier that is ALREADY INCLUDED
// in that plan's price.  Used by module billing pages to show DELTA (upgrade)
// pricing instead of the full standalone module price.
//
// Rule: upgradeExtraCost = newTierPrice - includedTierPrice
//
// CRM tier IDs: crm-starter | crm-growth | crm-pro | crm-agency
// Funnel pack IDs: funnel-pack-s | funnel-pack-m | funnel-pack-l | funnel-unlimited
// ─────────────────────────────────────────────────────────────────────────────
// Base platform plans — prices in AUD/month
export const WEBSITE_TIER_ORDER = ["website-starter", "website-growth", "website-pro", "website-agency"];

export const WEBSITE_PRICING_PLANS = [
  {
    id: "website-starter",
    name: "Starter",
    price: PRICING["website-starter"].price,
    priceLabel: `$${PRICING["website-starter"].price} / month`,
    color: "#6366f1",
    marketingCta: "Start Free Trial",
    marketingHref: "/create-account",
    features: [
      "1 website",
      "Drag-and-drop builder",
      "5 pages",
      "Free subdomain",
      "Basic templates",
      "Basic SEO tools",
    ],
  },
  {
    id: "website-growth",
    name: "Growth",
    price: PRICING["website-growth"].price,
    priceLabel: `$${PRICING["website-growth"].price} / month`,
    color: "#22c55e",
    marketingCta: "Get Started",
    marketingHref: "/create-account",
    features: [
      "2 websites",
      "Custom domain",
      "10 pages",
      "AI content generation",
      "Blog & landing pages",
      "Contact forms",
      "Google Analytics",
    ],
  },
  {
    id: "website-pro",
    name: "Scale",
    price: PRICING["website-pro"].price,
    priceLabel: `$${PRICING["website-pro"].price} / month`,
    color: "#f59e0b",
    recommended: true,
    marketingCta: "Get Started",
    marketingHref: "/create-account",
    features: [
      "3 websites",
      "Custom domains",
      "Full AI website builder",
      "AI generate entire site from prompt",
      "Ecommerce & product pages",
      "Advanced analytics",
      "Custom code injection",
      "Priority support",
    ],
  },
  {
    id: "website-agency",
    name: "Professional",
    price: PRICING["website-agency"].price,
    priceLabel: `$${PRICING["website-agency"].price} / month`,
    color: "#7c3aed",
    marketingCta: "Book Demo",
    marketingHref: "/support",
    features: [
      "5 websites",
      "All Scale features",
      "AI site generation (unlimited)",
      "Client management",
      "API access",
      "Dedicated support",
    ],
  },
];

export const WEBSITE_TIER_PRICES = WEBSITE_PRICING_PLANS.reduce((acc, plan) => {
  acc[plan.id] = plan.price;
  return acc;
}, {});

export const WEBSITE_FEATURES = [
  { label: "Websites",                  key: "websites" },
  { label: "Pages",                     key: "pages" },
  { label: "Custom domain",             key: "customDomain" },
  { label: "Drag-and-drop builder",     key: "dragDrop" },
  { label: "Blog",                      key: "blog" },
  { label: "AI content generation",     key: "aiContent" },
  { label: "Full AI site builder",      key: "aiBuilder" },
  { label: "Ecommerce",                 key: "ecommerce" },
  { label: "Custom code injection",     key: "customCode" },
  { label: "Analytics",                 key: "analytics" },
  { label: "API access",                key: "apiAccess" },
];

export const WEBSITE_PLAN_FEATURES = {
  "website-starter": {
    websites: "1", pages: "5", customDomain: false, dragDrop: true, blog: false,
    aiContent: false, aiBuilder: false, ecommerce: false, abTesting: false,
    customCode: false, analytics: "Basic", apiAccess: false,
  },
  "website-growth": {
    websites: "2", pages: "10", customDomain: true, dragDrop: true, blog: true,
    aiContent: true, aiBuilder: false, ecommerce: false, abTesting: false,
    customCode: false, analytics: "Standard", apiAccess: false,
  },
  "website-pro": {
    websites: "3", pages: "Unlimited", customDomain: true, dragDrop: true, blog: true,
    aiContent: true, aiBuilder: true, ecommerce: true, abTesting: true,
    customCode: true, analytics: "Advanced", apiAccess: false,
  },
  "website-agency": {
    websites: "5", pages: "Unlimited", customDomain: true, dragDrop: true, blog: true,
    aiContent: true, aiBuilder: true, ecommerce: true, abTesting: true,
    customCode: true, analytics: "Full", apiAccess: true,
  },
};

export const BASE_PLANS = {
  starter:      { id: "starter",      name: "GR8 RESULT - Starter Plan",      price: 79,  introDiscountPercent: null, introMonths: 0, trialDays: 0 },
  growth:       { id: "growth",       name: "GR8 RESULT - Growth Plan",       price: 249, introDiscountPercent: null, introMonths: 0, trialDays: 0 },
  scale:        { id: "scale",        name: "GR8 RESULT - Scale Plan",        price: 399, introDiscountPercent: null, introMonths: 0, trialDays: 0 },
  professional: { id: "professional", name: "GR8 RESULT - Professional Plan", price: 799, introDiscountPercent: null, introMonths: 0, trialDays: 0 },
};

export const BASE_PLAN_INCLUDES = {
  starter: {
    email:    { tierId: "email-starter",    price: 59  },  // 5,000 contacts, 50,000 sends/mo
    sms:      { tierId: "sms-starter",      price: 25  },  // 500 SMS/mo
    social:   { tierId: "social-starter",   price: 29  },  // 50 AI posts
    calendar: { tierId: "calendar-starter", price: 19  },  // 1 calendar, 50 bookings/mo
    crm:      { tierId: "crm-starter",      price: 19  },  // 1 pipeline, 500 contacts
    website:  { tierId: "website-starter",  price: 29  },  // 1 website, templates only
    funnels:  { included: 0 },                              // landing pages only
  },
  growth: {
    email:    { tierId: "email-growth",     price: 99  },  // 5,000 contacts
    sms:      { tierId: "sms-growth",       price: 120 },  // 2,500 SMS/mo
    social:   { tierId: "social-growth",    price: 79  },  // 200 AI posts
    calendar: { tierId: "calendar-growth",  price: 29  },  // unlimited calendars, group booking
    crm:      { tierId: "crm-growth",       price: 29  },  // unlimited pipelines, 5k contacts
    website:  { tierId: "website-growth",   price: 59  },  // 2 websites, custom domain, AI content
    projectsHub: { tierId: "projects-hub-growth", price: 59 },  // 15 jobs, 20 projects, dependencies
    funnels:  { included: 1 },                              // 1 multi-step funnel
  },
  scale: {
    email:    { tierId: "email-pro",        price: 199 },  // 15,000 contacts
    sms:      { tierId: "sms-professional", price: 229 },  // 5,000 SMS/mo
    social:   { tierId: "social-pro",       price: 149 },  // 500 AI posts
    calendar: { tierId: "calendar-pro",     price: 79  },  // custom branding + automations
    crm:      { tierId: "crm-pro",          price: 79  },  // unlimited pipelines, 25k contacts
    website:  { tierId: "website-pro",      price: 79  },  // 3 websites, full AI builder, ecommerce
    projectsHub: { tierId: "projects-hub-pro", price: 99 },  // unlimited jobs & projects, resource allocation
    funnels:  { included: 3 },                              // 3 multi-step funnels
  },
  professional: {
    email:    { tierId: "email-advanced",   price: 499 },  // 50,000 contacts
    sms:      { tierId: "sms-business",     price: 429  },  // 10,000 SMS/mo
    social:   { tierId: "social-agency",    price: 299  },
    calendar: { tierId: "calendar-agency",  price: 149 },  // full professional tier
    crm:      { tierId: "crm-agency",       price: 199 },  // unlimited + API
    website:  { tierId: "website-agency",   price: 149 },  // 5 websites, full AI
    projectsHub: { tierId: "projects-hub-agency", price: 159 },  // unlimited, white-label, API
    funnels:  { included: 10 },                             // 10 multi-step funnels
  },
};

export default PRICING;

