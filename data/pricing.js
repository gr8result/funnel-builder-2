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
  "email-free": {
    name: "Email Marketing — Free",
    price: 0,
    limits: { subscribers: 250, monthlyEmails: 500 },
  },
  "email-starter": {
    name: "Email Marketing — Starter",
    price: 29,
    limits: { subscribers: 500, monthlyEmails: 1000 },
    upgradeTo: "email-growth",
  },
  "email-growth": {
    name: "Email Marketing — Growth",
    price: 99,
    limits: { subscribers: 2000, monthlyEmails: 10000 },
    upgradeTo: "email-pro",
  },
  "email-pro": {
    name: "Email Marketing — Pro",
    price: 199,
    limits: { subscribers: 10000, monthlyEmails: 50000 },
    upgradeTo: "email-advanced",
  },
  "email-advanced": {
    name: "Email Marketing — Advanced",
    price: 499,
    limits: { subscribers: 50000, monthlyEmails: 250000 },
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
    price: 250,
    limits: {
      monthlyMessages: 5000,
      listSize: 5000,
    },
    upgradeTo: "sms-business",
  },
  "sms-business": {
    name: "SMS Marketing — Business",
    price: 450,
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
};

export default PRICING;
