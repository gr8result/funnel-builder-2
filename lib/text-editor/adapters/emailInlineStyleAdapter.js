// emailInlineStyleAdapter — converts a TextStyle to email-safe inline CSS.
//
// Email clients (Gmail, Outlook, Apple Mail, Yahoo) have wildly inconsistent
// CSS support.  This adapter:
//   1. Produces flat inline-style strings (no classes, no @media, no variables)
//   2. Strips or degrades unsupported properties
//   3. Returns an array of `warnings` so the UI can alert the user
//   4. Provides `fallbackStyle` — a maximally-compatible simplified version
//
// Output shape:
//   {
//     inlineStyle:  Record<string, string>   — apply as style={{ ... }} on <td>/<span>
//     inlineString: string                   — "font-family: ...; font-size: ...;"
//     fallbackStyle:Record<string, string>   — hyper-safe version for Outlook
//     warnings:     Warning[]                — [{ property, message, severity }]
//     googleFontTag:string | null            — <link> HTML string for <head> injection
//   }

import { getFontStack, getFontEntry, buildGoogleFontsUrl } from "../fontRegistry";
import { TEXT_STYLE_DEFAULTS } from "../TextStyleSchema";

// ── Warning severity ──────────────────────────────────────────────────────────
export const WARN = { INFO: "info", WARN: "warn", ERROR: "error" };

// ── Main export ───────────────────────────────────────────────────────────────

export function emailInlineStyleAdapter(textStyle = {}) {
  const s = { ...TEXT_STYLE_DEFAULTS, ...textStyle };
  const warnings = [];
  const style = {};

  // ── Font family ─────────────────────────────────────────────────────────────
  const fontEntry = getFontEntry(s.fontFamily);
  style["font-family"] = getFontStack(s.fontFamily) || s.fontFamily || "Arial, sans-serif";

  if (fontEntry?.google) {
    warnings.push({
      property: "fontFamily",
      message:  `"${s.fontFamily}" is a Google Font. It loads in Gmail & Apple Mail but NOT in Outlook. A system-font fallback is included.`,
      severity: WARN.WARN,
    });
  }

  // ── Font size — must be px, never em/rem ───────────────────────────────────
  style["font-size"] = `${s.fontSize || 16}px`;

  // ── Font weight ────────────────────────────────────────────────────────────
  style["font-weight"] = String(s.fontWeight || 400);

  // ── Font style ─────────────────────────────────────────────────────────────
  if (s.fontStyle === "italic") style["font-style"] = "italic";

  // ── Text decoration ────────────────────────────────────────────────────────
  if (s.textDecoration && s.textDecoration !== "none") {
    style["text-decoration"] = s.textDecoration;
  }

  // ── Text transform ─────────────────────────────────────────────────────────
  if (s.textTransform && s.textTransform !== "none") {
    style["text-transform"] = s.textTransform;
  }

  // ── Colour — gradient not supported in email ───────────────────────────────
  if (s.gradient) {
    // Fall back to first stop colour
    const firstStop = s.gradient.stops?.[0]?.color || s.color || "#000000";
    style["color"] = firstStop;
    warnings.push({
      property: "gradient",
      message:  "Gradient text is NOT supported in email clients. The first gradient colour will be used as a solid fallback.",
      severity: WARN.ERROR,
    });
  } else {
    style["color"] = s.color || "#000000";
  }

  // ── Opacity — limited support; applied to color instead ───────────────────
  if (s.opacity != null && s.opacity !== 1) {
    warnings.push({
      property: "opacity",
      message:  "CSS `opacity` is partially supported. Consider baking opacity into the colour value instead.",
      severity: WARN.WARN,
    });
    style["opacity"] = String(s.opacity);
  }

  // ── Line height ────────────────────────────────────────────────────────────
  style["line-height"] = String(s.lineHeight ?? 1.5);

  // ── Letter spacing ─────────────────────────────────────────────────────────
  if (s.letterSpacing) {
    style["letter-spacing"] = `${s.letterSpacing}em`;
    warnings.push({
      property: "letterSpacing",
      message:  "Letter-spacing is ignored by Outlook.",
      severity: WARN.INFO,
    });
  }

  // ── Word spacing ───────────────────────────────────────────────────────────
  if (s.wordSpacing) {
    style["word-spacing"] = `${s.wordSpacing}px`;
    warnings.push({
      property: "wordSpacing",
      message:  "Word-spacing has poor support across email clients.",
      severity: WARN.INFO,
    });
  }

  // ── Alignment — only some clients honour inline text-align ────────────────
  if (s.textAlign && s.textAlign !== "left") {
    style["text-align"] = s.textAlign;
  }

  // ── Text shadow — NOT supported in Outlook ─────────────────────────────────
  if (s.shadow) {
    const { x = 2, y = 2, blur = 4, color: sc = "rgba(0,0,0,0.5)" } = s.shadow;
    style["text-shadow"] = `${x}px ${y}px ${blur}px ${sc}`;
    warnings.push({
      property: "shadow",
      message:  "Text shadow is NOT rendered by Outlook or older Gmail.",
      severity: WARN.WARN,
    });
  }

  // ── Glow — NOT supported in email ─────────────────────────────────────────
  if (s.glow) {
    const { color: gc = "#ffffff", blur: gb = 12 } = s.glow;
    style["text-shadow"] = (style["text-shadow"] ? style["text-shadow"] + ", " : "") +
      `0 0 ${gb}px ${gc}`;
    warnings.push({
      property: "glow",
      message:  "Glow effect is not supported in Outlook or most email clients.",
      severity: WARN.ERROR,
    });
  }

  // ── Text outline — NOT supported in email ──────────────────────────────────
  if (s.outline) {
    warnings.push({
      property: "outline",
      message:  "Text outline (-webkit-text-stroke) is NOT supported in email. This style will be ignored.",
      severity: WARN.ERROR,
    });
    // Do not emit the property
  }

  // ── Background ─────────────────────────────────────────────────────────────
  if (s.background) {
    const { color = "#ffffff", opacity = 1 } = s.background;
    style["background-color"] = opacity >= 1 ? color : hexToRgba(color, opacity);
  }

  // ── Padding ────────────────────────────────────────────────────────────────
  if (s.padding) {
    const { top = 0, right = 0, bottom = 0, left = 0 } = s.padding;
    style["padding"] = `${top}px ${right}px ${bottom}px ${left}px`;
  }

  // ── Border radius — NOT supported in Outlook ──────────────────────────────
  if (s.borderRadius) {
    style["border-radius"] = `${s.borderRadius}px`;
    warnings.push({
      property: "borderRadius",
      message:  "Border radius on text backgrounds is not supported in Outlook.",
      severity: WARN.INFO,
    });
  }

  // ── Animation — NOT supported ─────────────────────────────────────────────
  if (s.animation) {
    warnings.push({
      property: "animation",
      message:  "CSS animations are not supported in email clients and will be ignored.",
      severity: WARN.ERROR,
    });
  }

  // ── Responsive overrides — NOT possible inline ─────────────────────────────
  if (s.responsive?.tablet || s.responsive?.mobile) {
    warnings.push({
      property: "responsive",
      message:  "Responsive breakpoints cannot be applied as inline styles. Media query overrides will be ignored.",
      severity: WARN.WARN,
    });
  }

  // ── Build outputs ──────────────────────────────────────────────────────────
  const inlineString = Object.entries(style)
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ");

  // Fallback: hyper-safe Outlook-compatible style (only web-safe fonts, no advanced effects)
  const fallbackStyle = buildOutlookFallback(s);

  // Google Fonts <link> tag for email <head> (optional; only works in some clients)
  let googleFontTag = null;
  if (fontEntry?.google) {
    const url = buildGoogleFontsUrl([s.fontFamily]);
    if (url) {
      googleFontTag = `<link href="${url}" rel="stylesheet" type="text/css">`;
    }
  }

  return {
    inlineStyle:   style,
    inlineString,
    fallbackStyle,
    warnings,
    googleFontTag,
  };
}

// ── Outlook fallback ──────────────────────────────────────────────────────────
// Uses only web-safe properties that Outlook's Word rendering engine supports.

function buildOutlookFallback(s) {
  const WEB_SAFE_FONTS = [
    "Arial", "Helvetica", "Verdana", "Tahoma", "Trebuchet MS",
    "Georgia", "Times New Roman", "Courier New",
  ];

  const fontEntry = getFontEntry(s.fontFamily);
  const isWebSafe = !fontEntry || fontEntry.system;
  const safeFontStack = isWebSafe
    ? (getFontStack(s.fontFamily) || "Arial, sans-serif")
    : "Arial, sans-serif"; // strip Google Font, Outlook won't load it

  return {
    "font-family":    safeFontStack,
    "font-size":      `${s.fontSize || 16}px`,
    "font-weight":    String(s.fontWeight || 400),
    "font-style":     s.fontStyle === "italic" ? "italic" : "normal",
    "color":          s.color || "#000000",
    "line-height":    String(s.lineHeight ?? 1.5),
    "text-align":     s.textAlign || "left",
    "text-decoration":s.textDecoration !== "none" ? (s.textDecoration || "none") : "none",
    ...(s.background?.color ? { "background-color": s.background.color } : {}),
    ...(s.padding ? { "padding": padToCss(s.padding) } : {}),
  };
}

// ── Utility ───────────────────────────────────────────────────────────────────

function hexToRgba(hex, opacity = 1) {
  const clean = (hex || "").replace("#", "");
  const full  = clean.length === 3 ? clean.split("").map(c => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if (isNaN(r)) return hex;
  return `rgba(${r},${g},${b},${opacity})`;
}

function padToCss(p = {}) {
  const { top = 0, right = 0, bottom = 0, left = 0 } = p;
  return `${top}px ${right}px ${bottom}px ${left}px`;
}

// ── Warning summary helper ─────────────────────────────────────────────────────
// Returns { hasErrors, hasWarnings, count } for quick status display in the UI.
export function summariseWarnings(warnings = []) {
  const hasErrors   = warnings.some(w => w.severity === WARN.ERROR);
  const hasWarnings = warnings.some(w => w.severity === WARN.WARN);
  return { hasErrors, hasWarnings, count: warnings.length };
}
