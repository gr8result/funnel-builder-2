import React from "react";
import WhatYoudPayElsewhere from "../../../components/WhatYoudPayElsewhere";
import PricingPlans from "../../../components/pricing/PricingPlans";
import { WEBSITE_PRICING_PLANS } from "../../../data/pricing";
import { COMPETITOR_COMPARISON_TEMPLATE_PROPS } from "../../../lib/website-builder/pageBlockComponents";

export default function PricingPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#121c26" }}>
      <section style={S.section}>
        <div style={S.inner}>
          <div style={S.hero}>
            <span style={S.eyebrow}>Website Builder Pricing</span>
            <h1 style={S.title}>Build stunning websites with AI</h1>
            <p style={S.copy}>Choose the website builder plan that fits your business today. Upgrade when your site, pages, domains, or client workload grows.</p>
          </div>
          <PricingPlans plans={WEBSITE_PRICING_PLANS} mode="marketing" />
        </div>
      </section>
      <WhatYoudPayElsewhere
        {...COMPETITOR_COMPARISON_TEMPLATE_PROPS}
      />
    </div>
  );
}

const S = {
  section: { color: "#fff", padding: "56px 28px 18px", display: "flex", justifyContent: "center" },
  inner: { width: "100%", maxWidth: 1320 },
  hero: { maxWidth: 760, marginBottom: 30 },
  eyebrow: { display: "inline-flex", color: "#93c5fd", fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 },
  title: { fontSize: 48, lineHeight: 1.05, margin: 0, fontWeight: 700, color: "#fff" },
  copy: { fontSize: 18, lineHeight: 1.65, color: "rgba(255,255,255,0.72)", margin: "14px 0 0" },
};
