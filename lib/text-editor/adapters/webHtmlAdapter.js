// webHtmlAdapter — converts a TextStyle to React inline style objects.
//
// Used by:  Website Builder, Funnel Builder, Landing Page Builder,
//           Course Page Editor, Product Page Editor, Blog/Content Editor
//
// Output shape:
//   {
//     containerStyle:  React.CSSProperties  — outer wrapper (background, padding, border-radius)
//     textStyle:       React.CSSProperties  — applied to the text node/element
//     cssText:         string               — equivalent CSS string (for <style> tags)
//     responsive:      { tablet, mobile }   — partial styles for breakpoints
//   }

import { getFontStack } from "../fontRegistry";
import { TEXT_STYLE_DEFAULTS } from "../TextStyleSchema";

// ── Main export ───────────────────────────────────────────────────────────────

export function webHtmlAdapter(textStyle = {}) {
  const s = { ...TEXT_STYLE_DEFAULTS, ...textStyle };

  const textCss  = buildTextStyle(s);
  const contCss  = buildContainerStyle(s);

  return {
    containerStyle:  contCss,
    textStyle:       textCss,
    cssText:         toCssString({ ...contCss, ...textCss }),
    responsive: {
      tablet: s.responsive?.tablet ? webHtmlAdapter({ ...s, ...s.responsive.tablet, responsive: {} }).textStyle : null,
      mobile: s.responsive?.mobile ? webHtmlAdapter({ ...s, ...s.responsive.mobile, responsive: {} }).textStyle : null,
    },
  };
}

// ── Text-level CSS ────────────────────────────────────────────────────────────

function buildTextStyle(s) {
  const css = {};

  // Font
  css.fontFamily    = getFontStack(s.fontFamily) || s.fontFamily || "inherit";
  css.fontSize      = `${s.fontSize}px`;
  css.fontWeight    = s.fontWeight;
  css.fontStyle     = s.fontStyle !== "normal" ? s.fontStyle : undefined;
  css.textDecoration= s.textDecoration !== "none" ? s.textDecoration : undefined;
  css.textTransform = s.textTransform  !== "none" ? s.textTransform  : undefined;

  // Colour — gradient takes priority
  if (s.gradient) {
    const gradCss = buildGradientCss(s.gradient);
    css.backgroundImage        = gradCss;
    css.WebkitBackgroundClip  = "text";
    css.backgroundClip        = "text";
    css.WebkitTextFillColor   = "transparent";
    css.color                 = "transparent"; // fallback
  } else {
    css.color = s.color || "inherit";
  }

  // Opacity
  if (s.opacity != null && s.opacity !== 1) css.opacity = s.opacity;

  // Spacing
  css.lineHeight    = s.lineHeight;
  if (s.letterSpacing) css.letterSpacing = `${s.letterSpacing}em`;
  if (s.wordSpacing)   css.wordSpacing   = `${s.wordSpacing}px`;

  // Alignment
  css.textAlign = s.textAlign || "inherit";

  // Shadows & effects
  const shadows = [];

  if (s.shadow) {
    const { x = 2, y = 2, blur = 4, color = "rgba(0,0,0,0.5)" } = s.shadow;
    shadows.push(`${x}px ${y}px ${blur}px ${color}`);
  }

  if (s.glow) {
    const { color: gc = "#ffffff", blur: gb = 12, intensity = 1 } = s.glow;
    for (let i = 0; i < Math.min(Math.ceil(intensity), 3); i++) {
      shadows.push(`0 0 ${gb * (i + 1)}px ${gc}`);
    }
  }

  if (s.outline) {
    // CSS text-stroke for solid outline; fallback to stacked shadows for blur
    const { width = 1, color: oc = "#000000", blur: ob = 0 } = s.outline;
    if (ob === 0) {
      css.WebkitTextStroke = `${width}px ${oc}`;
    } else {
      // Approximate outline via shadows at 8 compass points
      const dirs = [
        [-width, 0], [width, 0], [0, -width], [0, width],
        [-width, -width], [width, -width], [-width, width], [width, width],
      ];
      dirs.forEach(([dx, dy]) => shadows.push(`${dx}px ${dy}px ${ob}px ${oc}`));
    }
  }

  if (shadows.length) css.textShadow = shadows.join(", ");

  return stripUndefined(css);
}

// ── Container CSS (background behind text) ────────────────────────────────────

function buildContainerStyle(s) {
  const css = {};

  if (s.background) {
    const { color = "#ffffff", opacity = 1 } = s.background;
    css.backgroundColor = hexToRgba(color, opacity);
  }

  if (s.padding) {
    const { top = 0, right = 0, bottom = 0, left = 0 } = s.padding;
    css.padding = `${top}px ${right}px ${bottom}px ${left}px`;
  }

  if (s.borderRadius) {
    css.borderRadius = `${s.borderRadius}px`;
  }

  if (s.verticalAlign && s.verticalAlign !== "top") {
    css.display    = "flex";
    css.alignItems = s.verticalAlign === "middle" ? "center" : "flex-end";
  }

  return stripUndefined(css);
}

// ── Gradient helper ───────────────────────────────────────────────────────────

export function buildGradientCss(gradient) {
  if (!gradient) return null;
  const { type = "linear", angle = 135, stops = [] } = gradient;

  if (!stops.length) return null;

  const stopList = stops
    .map(({ color, position }) => `${color} ${position}%`)
    .join(", ");

  if (type === "radial") {
    return `radial-gradient(circle, ${stopList})`;
  }
  return `linear-gradient(${angle}deg, ${stopList})`;
}

// Produces a standard CSS text-shadow string from ShadowDef
export function shadowToCss(shadow) {
  if (!shadow) return "none";
  const { x = 2, y = 2, blur = 4, spread = 0, color = "rgba(0,0,0,0.5)" } = shadow;
  // text-shadow doesn't support spread; silently drop it
  return `${x}px ${y}px ${blur}px ${color}`;
}

// ── Paragraph spacing helper ──────────────────────────────────────────────────
// Inject as a <style> block or in a parent CSS-in-JS context
export function paragraphSpacingCss(textStyle, selector = "p") {
  const s = textStyle?.paragraphSpacing;
  if (!s) return "";
  return `${selector} { margin-bottom: ${s}px; }`;
}

// ── Serialise to plain CSS string ─────────────────────────────────────────────

function toCssString(styleObj) {
  return Object.entries(styleObj)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${camelToKebab(k)}: ${v};`)
    .join(" ");
}

function camelToKebab(str) {
  return str
    .replace(/^Webkit/, "-webkit-")
    .replace(/([A-Z])/g, m => `-${m.toLowerCase()}`);
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function stripUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function hexToRgba(hex, opacity = 1) {
  if (!hex) return `rgba(255,255,255,${opacity})`;
  // Already rgba/rgb
  if (hex.startsWith("rgba") || hex.startsWith("rgb")) return hex;
  const clean = hex.replace("#", "");
  const full  = clean.length === 3
    ? clean.split("").map(c => c + c).join("")
    : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if (isNaN(r)) return hex;
  return opacity >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${opacity})`;
}

// ── Responsive CSS block generator ────────────────────────────────────────────
// Returns a `<style>` string with @media blocks for tablet/mobile overrides.
export function buildResponsiveCss(textStyle, selector = ".gte-text") {
  const { responsive } = textStyle || {};
  if (!responsive?.tablet && !responsive?.mobile) return "";

  const lines = [];

  if (responsive.tablet) {
    const adapted = webHtmlAdapter({ ...textStyle, ...responsive.tablet, responsive: {} });
    const css = toCssString({ ...adapted.containerStyle, ...adapted.textStyle });
    if (css) lines.push(`@media (max-width: 1024px) { ${selector} { ${css} } }`);
  }

  if (responsive.mobile) {
    const adapted = webHtmlAdapter({ ...textStyle, ...responsive.mobile, responsive: {} });
    const css = toCssString({ ...adapted.containerStyle, ...adapted.textStyle });
    if (css) lines.push(`@media (max-width: 640px) { ${selector} { ${css} } }`);
  }

  return lines.join("\n");
}
