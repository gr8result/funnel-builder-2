// lib/modules/modules/modules/modules/affiliatessss/adapters/mock.js
// Mock affiliate “network” so pages work immediately.
// Replace with a real adapter later; keep the same method names/signatures.

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

const categories = ["SaaS", "Education", "Marketing", "E-commerce", "Finance", "Productivity"];
const networks = ["MockNet", "DemoHub", "SampleStack"];

const sampleOffers = Array.from({ length: 12 }).map((_, i) => ({
  id: `offer_${i + 1}`,
  name: [
    "Nimbus CRM",
    "CourseCraft LMS",
    "AdPilot",
    "ShopSwift",
    "Ledgerly",
    "FlowDesk",
    "FormFox",
    "MailMaven",
    "Boostly",
    "ClickForge",
    "Tutorly",
    "TrendTap"
  ][i],
  merchant: [
    "Nimbus Labs",
    "Didactica",
    "AdPilot Inc.",
    "Swift Retail",
    "Ledgerly Finance",
    "FlowDesk Ltd",
    "Foxware",
    "Maven Email",
    "Boostly Pty Ltd",
    "Forge Analytics",
    "Tutorly Ed",
    "Tap Media"
  ][i],
  category: categories[i % categories.length],
  network: networks[i % networks.length],
  logo: `https://placehold.co/128x128/png?text=${encodeURIComponent((i+1).toString())}`,
  epc: (Math.random() * 2.2 + 0.3).toFixed(2),       // average EPC
  cookieDays: [30, 45, 60, 90][i % 4],
  commission: ["20%", "30%", "40%", "$10 CPA"][i % 4],
  status: ["open", "invite", "paused"][i % 3],
  previewUrl: `https://example.com/${i + 1}`,
  terms: "Standard promotion terms apply.",
}));

const sampleApplications = [
  { id: "app_101", offerId: "offer_1", name: "Nimbus CRM", submittedAt: daysFromNow(-6), status: "pending" },
  { id: "app_102", offerId: "offer_3", name: "AdPilot", submittedAt: daysFromNow(-11), status: "declined" },
  { id: "app_103", offerId: "offer_5", name: "Ledgerly", submittedAt: daysFromNow(-1), status: "pending" },
];

const sampleApproved = [
  {
    id: "appr_201",
    offerId: "offer_2",
    name: "CourseCraft LMS",
    approvedAt: daysFromNow(-18),
    trackingLink: "https://trk.example.com/cc?aid=123&sid={subid}",
    commission: "30%",
  },
  {
    id: "appr_202",
    offerId: "offer_4",
    name: "ShopSwift",
    approvedAt: daysFromNow(-32),
    trackingLink: "https://trk.example.com/ss?aid=123&sid={subid}",
    commission: "40%",
  },
];

export default {
  // Discovery
  async listOffers({ q, category, network } = {}) {
    let out = sampleOffers.slice();
    if (q) {
      const s = q.toLowerCase();
      out = out.filter(
        (o) =>
          o.name.toLowerCase().includes(s) ||
          o.merchant.toLowerCase().includes(s)
      );
    }
    if (category) out = out.filter((o) => o.category === category);
    if (network) out = out.filter((o) => o.network === network);
    return { items: out, total: out.length };
  },

  async getOffer(id) {
    return sampleOffers.find((o) => o.id === id) || null;
  },

  // Applications
  async listApplications() {
    return { items: sampleApplications.slice(), total: sampleApplications.length };
  },

  // Approved
  async listApproved() {
    return { items: sampleApproved.slice(), total: sampleApproved.length };
  },
};




