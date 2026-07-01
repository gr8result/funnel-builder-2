// TextStylePreview — live preview of a TextStyle, rendered exactly as it will
// appear in the target context (web, email, canvas).
//
// Props:
//   textStyle   TextStyle
//   mode        "web" | "email" | "canvas"  — affects the preview rendering
//   sampleText  string   — overrides the default sample string
//   background  string   — preview panel background colour

import { webHtmlAdapter, buildGradientCss } from "../../lib/text-editor/adapters/webHtmlAdapter";
import { emailInlineStyleAdapter }           from "../../lib/text-editor/adapters/emailInlineStyleAdapter";
import { getFontStack }                      from "../../lib/text-editor/fontRegistry";
import useFontLoader                         from "../../hooks/useFontLoader";

const DEFAULT_SAMPLE = "The quick brown fox jumps over the lazy dog";

export default function TextStylePreview({
  textStyle,
  mode = "web",
  sampleText,
  background = "#0f172a",
}) {
  const s    = textStyle || {};
  const text = sampleText || DEFAULT_SAMPLE;

  useFontLoader(s.fontFamily);

  return (
    <div style={{
      background,
      borderRadius: 10,
      padding: "18px 16px",
      minHeight: 80,
      display: "flex",
      flexDirection: "column",
      gap: 8,
    }}>
      <PreviewContent textStyle={s} mode={mode} text={text} />
      <ModeLabel mode={mode} />
    </div>
  );
}

// ── Mode-specific renderers ───────────────────────────────────────────────────

function PreviewContent({ textStyle, mode, text }) {
  if (mode === "canvas") {
    return <CanvasPreview textStyle={textStyle} text={text} />;
  }

  if (mode === "email") {
    return <EmailPreview textStyle={textStyle} text={text} />;
  }

  return <WebPreview textStyle={textStyle} text={text} />;
}

// Web preview — renders inline React styles via webHtmlAdapter
function WebPreview({ textStyle, text }) {
  const { containerStyle, textStyle: textCss } = webHtmlAdapter(textStyle);

  return (
    <div style={containerStyle}>
      <span style={textCss}>{text}</span>
    </div>
  );
}

// Email preview — uses email-safe inline styles
function EmailPreview({ textStyle, text }) {
  const { inlineStyle, warnings } = emailInlineStyleAdapter(textStyle);

  // Convert kebab-case keys to camelCase for React
  const reactStyle = Object.fromEntries(
    Object.entries(inlineStyle).map(([k, v]) => [kebabToCamel(k), v])
  );

  return (
    <div>
      <span style={reactStyle}>{text}</span>
      {warnings.some(w => w.severity === "error") && (
        <div style={{ marginTop: 8, padding: "4px 8px", background: "rgba(239,68,68,0.15)", borderRadius: 6, fontSize: 11, color: "#fca5a5" }}>
          ⚠ Some styles are not email-safe — check the Email Warnings tab.
        </div>
      )}
    </div>
  );
}

// Canvas preview — a styled span that approximates canvas text rendering
function CanvasPreview({ textStyle, text }) {
  const s    = textStyle || {};
  const font = getFontStack(s.fontFamily) || "Arial";
  const grad = s.gradient ? buildGradientCss(s.gradient) : null;

  const style = {
    fontFamily:    font,
    fontSize:      `${s.fontSize || 16}px`,
    fontWeight:    s.fontWeight || 400,
    fontStyle:     s.fontStyle || "normal",
    textDecoration:s.textDecoration !== "none" ? s.textDecoration : undefined,
    textTransform: s.textTransform  !== "none" ? s.textTransform  : undefined,
    lineHeight:    s.lineHeight ?? 1.5,
    letterSpacing: s.letterSpacing ? `${s.letterSpacing}em` : undefined,
    opacity:       s.opacity ?? 1,
    textAlign:     s.textAlign || "left",
    wordBreak:     "break-word",
    // Colour / gradient
    ...(grad ? {
      backgroundImage:      grad,
      WebkitBackgroundClip: "text",
      backgroundClip:       "text",
      WebkitTextFillColor:  "transparent",
      color:                "transparent",
    } : {
      color: s.color || "#000000",
    }),
    // Shadow / glow combined
    ...(s.shadow || s.glow ? {
      textShadow: [
        s.shadow ? `${s.shadow.x||0}px ${s.shadow.y||0}px ${s.shadow.blur||4}px ${s.shadow.color||"rgba(0,0,0,0.5)"}` : null,
        s.glow   ? `0 0 ${s.glow.blur||12}px ${s.glow.color||"#ffffff"}` : null,
      ].filter(Boolean).join(", "),
    } : {}),
    // Outline
    ...(s.outline ? { WebkitTextStroke: `${s.outline.width||1}px ${s.outline.color||"#000"}` } : {}),
  };

  return (
    <div style={{ padding: "8px", background: "rgba(255,255,255,0.03)", borderRadius: 8, textAlign: s.textAlign || "left" }}>
      <span style={style}>{text}</span>
      <div style={{ marginTop: 6, fontSize: 10, color: "#475569" }}>
        Canvas / Image output — approximate preview
      </div>
    </div>
  );
}

// ── Label ─────────────────────────────────────────────────────────────────────

const MODE_LABELS = {
  web:    { label: "Web output", color: "#0ea5e9" },
  email:  { label: "Email output", color: "#f59e0b" },
  canvas: { label: "Image / canvas output", color: "#a855f7" },
};

function ModeLabel({ mode }) {
  const m = MODE_LABELS[mode] || MODE_LABELS.web;
  return (
    <div style={{ fontSize: 10, color: m.color, letterSpacing: "0.06em", fontWeight: 600, textTransform: "uppercase" }}>
      {m.label}
    </div>
  );
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function kebabToCamel(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
