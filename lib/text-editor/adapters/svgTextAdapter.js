// svgTextAdapter — converts a TextStyle to SVG text element attributes and
// inline styles.  Useful for PDF export, icon generation, or any context
// where vector text is required.
//
// Output shape:
//   {
//     textAttrs:   object   — spread onto <text> or <tspan> elements
//     filterDefs:  string   — SVG <filter> definitions to include in <defs>
//     filterRef:   string | null  — filter="url(#gte-filter)" attribute value
//     wrapText:    (text, maxWidth) => tspanElements   — word-wrap helper
//   }

import { getFontStack } from "../fontRegistry";
import { TEXT_STYLE_DEFAULTS } from "../TextStyleSchema";

let _filterId = 0;
function nextFilterId() { return `gte-filter-${++_filterId}`; }

// ── Main export ───────────────────────────────────────────────────────────────

export function svgTextAdapter(textStyle = {}) {
  const s = { ...TEXT_STYLE_DEFAULTS, ...textStyle };

  const filterId   = nextFilterId();
  const filterDefs = buildFilterDefs(s, filterId);
  const filterRef  = filterDefs ? `url(#${filterId})` : null;

  const textAttrs = {
    "font-family":    getFontStack(s.fontFamily) || "Arial",
    "font-size":      `${s.fontSize || 16}`,
    "font-weight":    String(s.fontWeight || 400),
    "font-style":     s.fontStyle || "normal",
    "text-decoration":s.textDecoration !== "none" ? s.textDecoration : "none",
    "text-anchor":    alignToAnchor(s.textAlign),
    "dominant-baseline": "auto",
    "fill":           resolveSvgFill(s, filterId),
    "opacity":        s.opacity != null ? String(s.opacity) : "1",
    "letter-spacing": s.letterSpacing ? `${s.letterSpacing}em` : "0",
    ...(s.textTransform !== "none" ? { style: `text-transform:${s.textTransform}` } : {}),
    ...(filterRef ? { filter: filterRef } : {}),
    // Stroke / outline
    ...buildStrokeAttrs(s),
  };

  return {
    textAttrs,
    filterDefs,
    filterRef,
    gradientDefs: buildGradientDefs(s, filterId),
    wrapText: (text, maxCharsPerLine = 40) => wrapToTspans(text, maxCharsPerLine, s),
  };
}

// ── Fill ──────────────────────────────────────────────────────────────────────

function resolveSvgFill(s, filterId) {
  if (s.gradient?.stops?.length) {
    return `url(#${filterId}-grad)`;
  }
  return s.color || "#000000";
}

// ── Gradient defs ─────────────────────────────────────────────────────────────

function buildGradientDefs(s, filterId) {
  if (!s.gradient?.stops?.length) return "";

  const { type = "linear", angle = 135, stops } = s.gradient;
  const id = `${filterId}-grad`;

  const stopEls = stops
    .map(({ color, position }) =>
      `<stop offset="${position}%" stop-color="${color}" />`)
    .join("\n    ");

  if (type === "radial") {
    return `<radialGradient id="${id}" cx="50%" cy="50%" r="50%">\n    ${stopEls}\n  </radialGradient>`;
  }

  // Convert angle to x1/y1/x2/y2
  const rad  = (angle * Math.PI) / 180;
  const x2   = (50 + Math.round(Math.cos(rad) * 50));
  const y2   = (50 + Math.round(Math.sin(rad) * 50));
  const x1   = 100 - x2;
  const y1   = 100 - y2;

  return `<linearGradient id="${id}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%" gradientUnits="userSpaceOnUse">\n    ${stopEls}\n  </linearGradient>`;
}

// ── Filter defs (shadow + glow) ───────────────────────────────────────────────

function buildFilterDefs(s, filterId) {
  const hasShadow = !!s.shadow;
  const hasGlow   = !!s.glow;

  if (!hasShadow && !hasGlow) return "";

  const filters = [];

  if (hasShadow) {
    const { x = 2, y = 2, blur = 4, color = "rgba(0,0,0,0.5)" } = s.shadow;
    filters.push(`
      <feDropShadow dx="${x}" dy="${y}" stdDeviation="${blur / 2}" flood-color="${color}" result="shadow" />`);
  }

  if (hasGlow) {
    const { color: gc = "#ffffff", blur: gb = 12 } = s.glow;
    filters.push(`
      <feGaussianBlur in="SourceGraphic" stdDeviation="${gb / 2}" result="blur" />
      <feFlood flood-color="${gc}" result="glowColor" />
      <feComposite in="glowColor" in2="blur" operator="in" result="glowResult" />
      <feMerge><feMergeNode in="glowResult" /><feMergeNode in="SourceGraphic" /></feMerge>`);
  }

  return `<filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%">${filters.join("")}\n  </filter>`;
}

// ── Stroke / outline ──────────────────────────────────────────────────────────

function buildStrokeAttrs(s) {
  if (!s.outline) return {};
  const { width = 1, color = "#000000" } = s.outline;
  return {
    stroke:          color,
    "stroke-width":  String(width),
    "paint-order":   "stroke fill",
  };
}

// ── Text anchor mapping ───────────────────────────────────────────────────────

function alignToAnchor(textAlign) {
  switch (textAlign) {
    case "center":  return "middle";
    case "right":   return "end";
    default:        return "start";
  }
}

// ── Word-wrap helper ──────────────────────────────────────────────────────────
// Returns an array of <tspan> props for multi-line text rendering.

function wrapToTspans(text, maxCharsPerLine = 40, s) {
  const lineHeight = s.lineHeight ?? 1.5;
  const fontSize   = s.fontSize   ?? 16;
  const dy         = lineHeight * fontSize;

  const words  = String(text).split(/\s+/);
  const lines  = [];
  let current  = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  return lines.map((line, i) => ({
    children:     line,
    x:            "0",
    dy:           i === 0 ? "0" : `${dy}`,
  }));
}

// ── Utility: build a complete <svg> snippet for preview ───────────────────────

export function buildSvgPreview(textStyle, text = "Preview Text", width = 400, height = 100) {
  const { textAttrs, filterDefs, gradientDefs, wrapText } = svgTextAdapter(textStyle);
  const tspans = wrapText(text, 50);
  const x      = textAttrs["text-anchor"] === "middle" ? width / 2
               : textAttrs["text-anchor"] === "end"    ? width
               : 16;

  const attrStr = Object.entries(textAttrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");

  const tspanStr = tspans.map(t =>
    `<tspan x="${x}" dy="${t.dy}">${escapeXml(t.children)}</tspan>`
  ).join("\n    ");

  const defs = (filterDefs || gradientDefs)
    ? `<defs>${gradientDefs || ""}${filterDefs || ""}</defs>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  ${defs}
  <text ${attrStr} x="${x}" y="${height / 2}">
    ${tspanStr}
  </text>
</svg>`;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
