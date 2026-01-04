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
  "subaccounts": { name: "Subaccounts", price: 19 },
  "digital-products": { name: "Digital Products", price: 19 },

  // ====== EMAIL MARKETING PLANS ======
  "email-starter": {
    name: "Email Marketing — Starter",
    price: 29,
    limits: {
      subscribers: 500,
      monthlyEmails: 1000,
    },
    upgradeTo: "email-growth",
  },
  "email-growth": {
    name: "Email Marketing — Growth",
    price: 75,
    limits: {
      subscribers: 2000,
      monthlyEmails: 10000,
    },
    upgradeTo: "email-expansion",
  },
  "email-expansion": {
    name: "Email Marketing — Expansion",
    price: 250,
    limits: {
      subscribers: 15000,
      monthlyEmails: 30000,
    },
    upgradeTo: "email-enterprise",
  },
  "email-enterprise": {
    name: "Email Marketing — Enterprise",
    price: 350,
    limits: {
      subscribers: 25000,
      monthlyEmails: 100000,
    },
    upgradeTo: "email-agency",
  },
  "email-agency": {
    name: "Email Marketing — Agency",
    price: 0, // Contact support for pricing
    limits: {
      subscribers: "custom",
      monthlyEmails: "custom",
    },
    upgradeTo: null,
  },
};

export default PRICING;
