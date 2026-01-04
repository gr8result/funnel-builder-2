// /components/website-builder/blocks/BlockRenderer.js
// FULL REPLACEMENT — makes your new textStyle actually show up (wraps blocks in a style context)
// ✅ Applies font/color/align/weight/italic/underline/lineHeight/letterSpacing globally via wrapper
// ✅ Keeps existing blocks working

import HeroBlock from "./HeroBlock";
import TextBlock from "./TextBlock";
import FeaturesBlock from "./FeaturesBlock";
import ImageBlock from "./ImageBlock";
import CtaBlock from "./CtaBlock";
import FooterBlock from "./FooterBlock";

export default function BlockRenderer({ block, theme, resolvedBackground }) {
  const b = block || {};
  const ts = (b.textStyle && typeof b.textStyle === "object") ? b.textStyle : {};

  const wrapStyle = {
    fontFamily: ts.fontFamily || undefined,
    color: ts.color || undefined,
    textAlign: ts.align || undefined,
    fontSize: ts.fontSize ? `${Number(ts.fontSize)}px` : undefined,
    fontWeight: ts.weight || undefined,
    fontStyle: ts.italic ? "italic" : undefined,
    textDecoration: ts.underline ? "underline" : undefined,
    lineHeight: ts.lineHeight || undefined,
    letterSpacing: ts.letterSpacing != null ? `${Number(ts.letterSpacing)}px` : undefined,
  };

  return (
    <div style={wrapStyle}>
      {renderType(b, theme, resolvedBackground)}
    </div>
  );
}

function renderType(b, theme, resolvedBackground) {
  if (b.type === "hero") return <HeroBlock block={b} theme={theme} resolvedBackground={resolvedBackground} />;
  if (b.type === "text") return <TextBlock block={b} theme={theme} resolvedBackground={resolvedBackground} />;
  if (b.type === "features") return <FeaturesBlock block={b} theme={theme} resolvedBackground={resolvedBackground} />;
  if (b.type === "image") return <ImageBlock block={b} theme={theme} resolvedBackground={resolvedBackground} />;
  if (b.type === "cta") return <CtaBlock block={b} theme={theme} resolvedBackground={resolvedBackground} />;
  if (b.type === "footer") return <FooterBlock block={b} theme={theme} resolvedBackground={resolvedBackground} />;

  // Minimal render for your new layout blocks (so they never break)
  if (b.type === "nav") {
    return (
      <div style={{ padding: 16, background: resolvedBackground || "transparent" }}>
        <div style={nav.row}>
          <div style={nav.brand}>{b.brand || "Brand"}</div>
          <div style={nav.links}>
            {(b.links || ["Home", "About", "Contact"]).map((x, i) => (
              <div key={i} style={nav.link}>{x}</div>
            ))}
          </div>
          <div style={nav.cta}>{b.cta || "Get Started"}</div>
        </div>
      </div>
    );
  }

  if (b.type === "two_col") {
    const left = b.left || {};
    const right = b.right || {};
    const reverse = !!b.reverse;
    return (
      <div style={{ padding: 18, background: resolvedBackground || "transparent" }}>
        <div style={{ fontWeight: 950, fontSize: 24, marginBottom: 12 }}>{b.heading || "Two column section"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14 }}>
          <div style={{ order: reverse ? 2 : 1 }}>
            <div style={{ fontWeight: 950, fontSize: 18 }}>{left.title || "Left title"}</div>
            <div style={{ marginTop: 8, opacity: 0.85, fontWeight: 650 }}>{left.text || "Left text…"}</div>
            <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
              {(left.bullets || []).map((x, i) => (
                <div key={i} style={{ opacity: 0.9, fontWeight: 750 }}>• {x}</div>
              ))}
            </div>
          </div>
          <div style={{ order: reverse ? 1 : 2 }}>
            <div style={twoCol.imgShell}>
              {right.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={right.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={twoCol.dropHint}>Drop an image here (from Images tab)</div>
              )}
            </div>
            <div style={{ marginTop: 8, opacity: 0.7, fontWeight: 800, fontSize: 13 }}>
              {right.caption || "Caption"}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (b.type === "three_col") {
    return (
      <div style={{ padding: 18, background: resolvedBackground || "transparent" }}>
        <div style={{ fontWeight: 950, fontSize: 24 }}>{b.heading || "Three column section"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
          {(b.columns || []).map((c, i) => (
            <div key={i} style={threeCol.card}>
              <div style={{ fontWeight: 950 }}>{c.title || `Column ${i + 1}`}</div>
              <div style={{ marginTop: 6, opacity: 0.8, fontWeight: 650 }}>{c.text || "Text…"}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (b.type === "gallery") {
    const imgs = b.images || [];
    return (
      <div style={{ padding: 18, background: resolvedBackground || "transparent" }}>
        <div style={{ fontWeight: 950, fontSize: 24 }}>{b.heading || "Gallery"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 12 }}>
          {imgs.map((url, i) => (
            <div key={i} style={gallery.cell}>
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={gallery.placeholder}>Drop image</div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 18, background: resolvedBackground || "transparent" }}>
      <div style={{ fontWeight: 900 }}>Unknown block: {String(b.type || "")}</div>
    </div>
  );
}

const nav = {
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    background: "rgba(0,0,0,0.18)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  brand: { fontWeight: 950, fontSize: 16 },
  links: { display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", justifyContent: "center" },
  link: { opacity: 0.85, fontWeight: 850, fontSize: 13 },
  cta: {
    background: "#2297c5",
    color: "#06121d",
    fontWeight: 950,
    padding: "10px 12px",
    borderRadius: 12,
    fontSize: 13,
    whiteSpace: "nowrap",
  },
};

const twoCol = {
  imgShell: {
    width: "100%",
    height: 260,
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.22)",
  },
  dropHint: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.7,
    fontWeight: 900,
  },
};

const threeCol = {
  card: {
    padding: 14,
    borderRadius: 14,
    background: "rgba(0,0,0,0.18)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
};

const gallery = {
  cell: {
    height: 120,
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.22)",
  },
  placeholder: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.65,
    fontWeight: 900,
    fontSize: 12,
  },
};
