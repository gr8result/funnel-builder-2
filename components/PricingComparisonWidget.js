import React from "react";

// ─── Check / X icons (matching HighLevel's exact circle style) ────────────────

function CheckIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="15" cy="15" r="15" fill="#22c55e" />
      <path d="M8.5 15.5l4.5 4.5 8.5-9.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="15" cy="15" r="15" fill="#ef4444" />
      <path d="M10 10l10 10M20 10l-10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Feature rows (exact same list as HighLevel comparison) ──────────────────

const features = [
  { label: "All-in-One Platform",               gr8: true,  cf: false },
  { label: "Full CRM & Pipeline Management",    gr8: true,  cf: false },
  { label: "Multi-Channel Automation",           gr8: true,  cf: false },
  { label: "Advanced Funnels & AI Builder",     gr8: true,  cf: false },
  { label: "Unlimited Users & Contacts",         gr8: true,  cf: false },
  { label: "White-Label Agency SaaS Platform",  gr8: true,  cf: false },
  { label: "Unlimited Sub-Accounts",            gr8: true,  cf: false },
  { label: "Built-in 2-Way Messaging",          gr8: true,  cf: false },
  { label: "Email + SMS Marketing",             gr8: true,  cf: false },
  { label: "WhatsApp Integration",              gr8: true,  cf: false },
  { label: "AI Employee / Content AI",          gr8: true,  cf: false },
  { label: "Ad Manager (FB + Google)",          gr8: true,  cf: false },
];

// ─── Main widget ──────────────────────────────────────────────────────────────

export default function PricingComparisonWidget() {
  return (
    // Outer wrapper — light blue-gray tint matches HighLevel's table container
    <div className="rounded-2xl overflow-hidden shadow-lg" style={{ background: "#eef2fb" }}>

      {/* Title */}
      <div className="text-center px-6 pt-7 pb-5">
        <h3 className="text-xl font-extrabold text-gray-900 leading-tight">
          The real difference between<br />
          <span className="text-[#1a3c6e]">Gr8 Result</span> and{" "}
          <span className="text-[#c0392b]">ClickFunnels</span>
        </h3>
      </div>

      {/* Table */}
      <div className="mx-4 mb-4 rounded-xl overflow-hidden border border-blue-100 bg-white shadow-sm">

        {/* Header row */}
        <div className="grid grid-cols-[1fr_130px_130px] border-b border-gray-200">
          {/* Features label */}
          <div className="px-5 py-4 bg-[#f0f4fc] flex items-center">
            <span className="text-sm font-bold text-gray-600 uppercase tracking-wide">Features</span>
          </div>

          {/* Gr8 Result header — dark navy column */}
          <div className="bg-[#0d1b2e] flex flex-col items-center justify-center py-4 px-3 gap-2">
            {/* Custom logo badge */}
            <div className="flex items-center gap-1.5">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Stylised "G" spark icon */}
                <circle cx="11" cy="11" r="11" fill="#22c55e" />
                <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="10" fontWeight="900" fontFamily="Arial,sans-serif">G8</text>
              </svg>
              <span className="text-white font-bold text-sm leading-none">Gr8 Result</span>
            </div>
          </div>

          {/* ClickFunnels header — white column */}
          <div className="bg-white flex flex-col items-center justify-center py-4 px-3 gap-2 border-l border-gray-100">
            {/* CF logo */}
            <div className="flex items-center gap-1.5">
              <img
                src="https://logo.clearbit.com/clickfunnels.com"
                alt="ClickFunnels"
                className="w-5 h-5 rounded"
                onError={e => { e.target.style.display = "none"; }}
              />
              <span className="text-gray-700 font-bold text-sm leading-none">ClickFunnels</span>
            </div>
          </div>
        </div>

        {/* Feature rows */}
        {features.map(({ label, gr8, cf }, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_130px_130px] border-b border-gray-100 last:border-b-0"
          >
            {/* Feature name */}
            <div className="px-5 py-4 flex items-center bg-white">
              <span className="text-sm font-medium text-gray-800">{label}</span>
            </div>

            {/* Gr8 Result cell — dark navy */}
            <div className="bg-[#0d1b2e] flex items-center justify-center py-4">
              {gr8 ? <CheckIcon /> : <CrossIcon />}
            </div>

            {/* ClickFunnels cell — white */}
            <div className="bg-white flex items-center justify-center py-4 border-l border-gray-100">
              {cf ? <CheckIcon /> : <CrossIcon />}
            </div>
          </div>
        ))}

        {/* Price row */}
        <div className="grid grid-cols-[1fr_130px_130px] bg-[#f0f4fc] border-t-2 border-blue-200">
          <div className="px-5 py-4 flex items-center">
            <span className="text-sm font-bold text-gray-900">Starting Price</span>
          </div>
          <div className="bg-[#0d1b2e] flex flex-col items-center justify-center py-4">
            <span className="text-xl font-extrabold text-green-400">$79</span>
            <span className="text-xs text-gray-400">/mo</span>
          </div>
          <div className="bg-white flex flex-col items-center justify-center py-4 border-l border-gray-100">
            <span className="text-xl font-extrabold text-red-500">$97</span>
            <span className="text-xs text-gray-400">/mo</span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="px-4 pb-5">
        <button className="w-full bg-[#22c55e] hover:bg-green-500 text-white font-bold py-3.5 rounded-xl text-sm transition-colors shadow-md">
          Try Gr8 Result Free →
        </button>
        <p className="text-center text-xs text-gray-500 mt-2">
          No credit card required · Cancel anytime
        </p>
      </div>
    </div>
  );
}
