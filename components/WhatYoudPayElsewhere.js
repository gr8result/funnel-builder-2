/**
 * WhatYoudPayElsewhere
 *
 * A reusable "competitor cost comparison" table widget.
 * Drop it anywhere — pricing pages, landing pages, sales decks.
 *
 * Props
 * ─────
 * rows         {Array}  Required. Each item:
 *                { category: string,
 *                  logos: [{ domain: string, name: string }],
 *                  price: number | null }   — null = "unique" row (no price shown)
 *
 * planName     {string}  Label for your plan row.  Default: "COMPETITOR ANALYSIS"
 * planPrice    {number}  Your plan's monthly price. Default: 299
 * planTagline  {string}  Sub-label under planName.  Default: "Everything above, included"
 * title        {string}  Heading. Default: ""
 * eyebrow      {string}  Small uppercase label above title. Default: "our All-in-One Platform"
 * subtitle     {string}  Body text below title.
 * uniqueLabel  {string}  Text shown for null-price rows. Default: `Unique to ${planName}`
 * disclaimer   {string}  Fine-print below table.
 * ctaLabel     {string}  Optional CTA button text (omit to hide button).
 * onCtaClick   {func}    Click handler for CTA button.
 *
 * Usage example
 * ─────────────
 * import WhatYoudPayElsewhere from "../components/WhatYoudPayElsewhere";
 *
 * <WhatYoudPayElsewhere
 *   rows={myRows}
 *   planName="Starter Plan"
 *   planPrice={49}
 *   title="Stop paying for 6 tools"
 *   ctaLabel="Start free today"
 *   onCtaClick={() => router.push("/signup")}
 * />
 */

import React from "react";

function CheckBadge() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <circle cx="13" cy="13" r="13" fill="#2563eb" />
      <path d="M7 13.5l4 4 8-9" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Logo({ domain, name, src }) {
  const imgSrc = src || (domain ? `https://logo.clearbit.com/${domain}` : null);
  if (!imgSrc) return null;
  return (
    <img
      src={imgSrc}
      alt={name}
      title={name}
      width={36}
      height={36}
      style={{
        borderRadius: "50%",
        background: "#fff",
        objectFit: "contain",
        border: "1.5px solid rgba(255,255,255,0.15)",
        flexShrink: 0,
        width: 36,
        height: 36,
        minWidth: 36,
        minHeight: 36,
      }}
      onError={e => {
        const el = e.currentTarget;
        if (!src && domain && !el.src.includes("google.com")) {
          el.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
        } else {
          el.style.display = "none";
        }
      }}
    />
  );
}

const grid = { display: "grid", gridTemplateColumns: "1fr 220px 160px", alignItems: "center" };
const px = { padding: "0 32px" };

export default function WhatYoudPayElsewhere({
  rows = [],
  planName = "COMPETITOR ANALYSIS",
  planPrice = 299,
  planTagline = "Everything above, included",
  title = "",
  eyebrow = "our All-in-One Platform",
  subtitle = "We replace every tool below — one platform, one price.",
  uniqueLabel,
  disclaimer = "* Pricing based on publicly listed entry-tier plans. Actual costs vary by usage and plan tier.",
  ctaLabel,
  onCtaClick,
}) {
  const total = rows.reduce((s, r) => s + (r.price || 0), 0);
  const savings = total - planPrice;
  const uniqueText = uniqueLabel || `Unique to ${planName}`;

  return (
    <div style={{ color: "#fff", padding: "80px 32px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          {eyebrow && (
            <p style={{ color: "#60a5fa", fontSize: 16, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>
              {eyebrow}
            </p>
          )}
          <h2 style={{ fontSize: 52, fontWeight: 600, lineHeight: 1.15, marginBottom: 16, letterSpacing: "-0.02em" }}>
            {title}
          </h2>
          {subtitle && (
            <p style={{ color: "#9ca3af", fontSize: 18, lineHeight: 1.6, maxWidth: 600, margin: "0 auto" }}>{subtitle}</p>
          )}
        </div>

        {/* ── Table ── */}
        <div style={{ borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>

          {/* Column headers */}
          <div style={{ ...grid, background: "rgba(13,21,38,0.95)", borderBottom: "1px solid rgba(255,255,255,0.1)", padding: "16px 36px", fontSize: 16, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.12em" }}>
            <span>Feature</span>
            <span style={{ ...px, textAlign: "center" }}>Tools you&apos;d need</span>
            <span style={{ textAlign: "right" }}>Cost / mo</span>
          </div>

          {/* Data rows */}
          {rows.map((row, i) => (
            <div
              key={i}
              style={{ ...grid, padding: "20px 36px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: i % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent", transition: "background 0.15s" }}
            >
              <span style={{ fontWeight: 600, fontSize: 16, letterSpacing: "0.03em", color: "#e5e7eb" }}>
                {row.category}
              </span>

              <div style={{ display: "flex", alignItems: "center", gap: 8, ...px, justifyContent: "center" }}>
                {(row.logos || []).map((l, li) => (
                  <Logo key={l.src || l.domain || li} domain={l.domain} name={l.name} src={l.src} />
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "flex-end" }}>
                <span style={{ fontSize: 16, fontWeight: 600, whiteSpace: "nowrap", color: row.price ? "#f1f5f9" : "#60a5fa" }}>
                  {row.price ? `$${row.price}/mo` : uniqueText}
                </span>
                <CheckBadge />
              </div>
            </div>
          ))}

          {/* Total */}
          <div style={{ ...grid, padding: "24px 36px", background: "rgba(13,21,38,0.95)", borderTop: "2px solid rgba(255,255,255,0.12)" }}>
            <span style={{ fontWeight: 600, fontSize: 16, color: "#9ca3af", letterSpacing: "0.04em" }}>
              Total if purchased separately
            </span>
            <div style={px} />
            <span style={{ color: "#f87171", fontWeight: 600, fontSize: 26, textAlign: "right" }}>
              ${total.toLocaleString()}/mo
            </span>
          </div>

          {/* Your plan */}
          <div style={{ ...grid, padding: "24px 36px", background: "rgba(10,30,15,0.95)", borderTop: "1px solid rgba(74,222,128,0.15)" }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 17, color: "#86efac", letterSpacing: "0.02em" }}>
                {planName}
              </span>
              {planTagline && (
                <p style={{ color: "#4ade80", fontSize: 16, marginTop: 4, opacity: 0.8 }}>{planTagline}</p>
              )}
            </div>
            <div style={px} />
            <span style={{ color: "#4ade80", fontWeight: 600, fontSize: 26, textAlign: "right" }}>
              ${planPrice}/mo
            </span>
          </div>

          {/* Savings */}
          <div style={{ ...grid, padding: "28px 36px", background: "rgba(20,83,45,0.6)", borderTop: "2px solid rgba(74,222,128,0.25)" }}>
            <span style={{ fontWeight: 600, fontSize: 22, color: "#86efac", letterSpacing: "0.01em" }}>
              🎉 You save
            </span>
            <div style={px} />
            <span style={{ color: "#86efac", fontWeight: 600, fontSize: 36, textAlign: "right", letterSpacing: "-0.02em" }}>
              ${savings.toLocaleString()}/mo
            </span>
          </div>

        </div>

        {/* Disclaimer */}
        {disclaimer && (
          <p style={{ color: "#9ca3af", fontSize: 16, textAlign: "center", marginTop: 24, lineHeight: 1.6 }}>
            {disclaimer}
          </p>
        )}

        {/* Optional CTA */}
        {ctaLabel && (
          <div style={{ textAlign: "center", marginTop: 40 }}>
            <button
              onClick={onCtaClick}
              style={{ background: "#2563eb", color: "#fff", fontWeight: 600, fontSize: 17, padding: "16px 48px", borderRadius: 12, border: "none", cursor: "pointer", letterSpacing: "0.04em", boxShadow: "0 8px 24px rgba(37,99,235,0.4)" }}
            >
              {ctaLabel}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
