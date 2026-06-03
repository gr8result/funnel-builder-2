// scripts/export-pricing-grid.cjs
// Run: node scripts/export-pricing-grid.cjs
// Outputs: pricing-grid.xlsx in the project root

const XLSX = require("xlsx");
const path = require("path");

// ─── Data (mirrors data/pricing.js) ──────────────────────────────────────────

const PLATFORM = [
  { id: "starter",      label: "Starter",      price: 129 },
  { id: "growth",       label: "Growth",        price: 299 },
  { id: "scale",        label: "Scale",         price: 449 },
  { id: "professional", label: "Professional",  price: 699 },
];

// Module tiers: [tierId, price, description]
const MODULES = {
  "Email Marketing": [
    ["email-starter", 59,  "5,000 contacts / 50,000 sends"],
    ["email-growth", 99,  "15,000 contacts / 150,000 sends"],
    ["email-pro",    199, "40,000 contacts / 400,000 sends"],
    ["email-advanced",499,"200,000 contacts / 2,000,000 sends"],
  ],
  "SMS Marketing": [
    ["sms-starter",      25,  "500 messages/mo"],
    ["sms-growth",       120, "2,500 messages/mo"],
    ["sms-professional", 229, "5,000 messages/mo"],
    ["sms-business",     429, "10,000 messages/mo"],
  ],
  "Social Media": [
    ["social-starter", 29,  "50 AI posts, 3 profiles"],
    ["social-growth",  79,  "200 AI posts, 7 profiles"],
    ["social-pro",     149, "500 AI posts, 7 profiles"],
    ["social-agency",  299, "2,000 AI posts, 7 profiles"],
  ],
  "Calendar / Booking": [
    ["calendar-starter", 0,   "1 calendar, 50 bookings/mo"],
    ["calendar-growth",  29,  "Unlimited calendars, group booking"],
    ["calendar-pro",     79,  "Unlimited + custom branding"],
    ["calendar-agency",  149, "Full professional tier"],
  ],
  "CRM": [
    ["crm-starter", 0,   "1 pipeline, 500 contacts"],
    ["crm-growth",  29,  "Unlimited pipelines, 5,000 contacts"],
    ["crm-pro",     79,  "Unlimited pipelines, 25,000 contacts"],
    ["crm-agency",  199, "Unlimited everything"],
  ],
  "Website Builder": [
    ["website-starter", 29,  "1 website, templates only"],
    ["website-growth",  29,  "3 websites, custom domain, AI content"],
    ["website-pro",     79,  "7 websites, full AI builder, ecommerce"],
    ["website-agency",  149, "Unlimited websites, full AI"],
  ],
  "Funnels": [
    [null, 0,  "Landing pages only"],
    [null, 0,  "1 funnel included"],
    [null, 0,  "3 funnels included"],
    [null, 0,  "10 funnels included"],
  ],
};

// Which tier index (0-based) is included in each platform plan
const INCLUDED_TIER = {
  "Email Marketing":    [0, 1, 2, 3],   // email-starter included in Starter
  "SMS Marketing":      [0, 1, 2, 3],
  "Social Media":       [0, 1, 2, 3],
  "Calendar / Booking": [0, 1, 2, 3],
  "CRM":                [0, 1, 2, 3],
  "Website Builder":    [0, 1, 2, 3],
  "Funnels":            [0, 1, 2, 3],
};

// Add-on prices paid on top (module billing pages show DELTA prices)
const ADD_ON_PRICES = {
  "Email Marketing":    [59, 99, 199, 499],
  "SMS Marketing":      [25, 120, 229, 429],
  "Social Media":       [29, 79, 149, 299],
  "Calendar / Booking": [0, 29, 79, 149],
  "CRM":                [0, 29, 79, 199],
  "Website Builder":    [0, 29, 79, 149],
  "Funnels":            ["n/a", "n/a", "n/a", "n/a"],
};

// ─── Sheet 1: Platform Plan Summary ──────────────────────────────────────────

function buildPlatformSheet() {
  const rows = [];

  // Header
  rows.push(["", "Starter ($159/mo)", "Growth ($359/mo)", "Scale ($499/mo)", "Professional ($999/mo)"]);

  for (const [mod, tiers] of Object.entries(MODULES)) {
    const row = [mod];
    for (let i = 0; i < 4; i++) {
      const tierIdx = INCLUDED_TIER[mod][i];
      if (tierIdx === null) {
        row.push("— Not included");
      } else {
        const [tierId, price, desc] = tiers[tierIdx];
        row.push(desc);
      }
    }
    rows.push(row);
  }

  // Funnels add-on note
  rows.push([]);
  rows.push(["Funnel add-on packs (any plan)", "+2 funnels $19", "+5 funnels $39", "+10 funnels $79", "Unlimited $99"]);

  return rows;
}

// ─── Sheet 2: Module Standalone Prices ───────────────────────────────────────

function buildModuleSheet() {
  const rows = [];
  rows.push(["Module", "Tier 1", "Price", "Tier 2", "Price", "Tier 3", "Price", "Tier 4", "Price"]);

  for (const [mod, tiers] of Object.entries(MODULES)) {
    if (mod === "Funnels") continue; // add-ons handled separately
    const row = [mod];
    for (const [tierId, price, desc] of tiers) {
      row.push(desc, price === 0 ? "Free" : `$${price}/mo`);
    }
    rows.push(row);
  }

  rows.push([]);
  rows.push(["Funnel Add-ons", "+2 funnels", "$19", "+5 funnels", "$39", "+10 funnels", "$79", "Unlimited", "$99"]);

  return rows;
}

// ─── Sheet 3: Add-on (Delta) Prices ──────────────────────────────────────────

function buildAddOnSheet() {
  const rows = [];
  rows.push(["Module", "Add-on price on Starter", "Add-on price on Growth", "Add-on price on Scale", "Add-on price on Professional"]);
  rows.push(["", "(upgrade to next tier)", "(upgrade to next tier)", "(upgrade to next tier)", "(upgrade to next tier)"]);

  for (const [mod, prices] of Object.entries(ADD_ON_PRICES)) {
    const row = [mod];
    for (let i = 0; i < 4; i++) {
      const p = prices[i];
      row.push(p === "n/a" ? "see add-on packs" : p === 0 ? "Included ($0)" : `$${p}/mo`);
    }
    rows.push(row);
  }

  return rows;
}

// ─── Build workbook ───────────────────────────────────────────────────────────

const wb = XLSX.utils.book_new();

const ws1 = XLSX.utils.aoa_to_sheet(buildPlatformSheet());
ws1["!cols"] = [{ wch: 22 }, { wch: 38 }, { wch: 38 }, { wch: 38 }, { wch: 38 }];
XLSX.utils.book_append_sheet(wb, ws1, "Platform Plans");

const ws2 = XLSX.utils.aoa_to_sheet(buildModuleSheet());
ws2["!cols"] = [{ wch: 22 }, { wch: 38 }, { wch: 14 }, { wch: 38 }, { wch: 14 }, { wch: 38 }, { wch: 14 }, { wch: 38 }, { wch: 14 }];
XLSX.utils.book_append_sheet(wb, ws2, "Module Standalone Prices");

const ws3 = XLSX.utils.aoa_to_sheet(buildAddOnSheet());
ws3["!cols"] = [{ wch: 22 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 28 }];
XLSX.utils.book_append_sheet(wb, ws3, "Add-on (Delta) Prices");

const outPath = path.join(__dirname, "..", "pricing-grid.xlsx");
XLSX.writeFile(wb, outPath);
console.log("Written:", outPath);
