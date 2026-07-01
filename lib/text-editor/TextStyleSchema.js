// TextStyle schema — the single shared data model for all text editing across
// the platform (website builder, funnel, email, image, social media, etc.)
//
// Every editor stores text styling as a TextStyle object.
// Render adapters (webHtmlAdapter, emailInlineStyleAdapter, canvasTextAdapter,
// svgTextAdapter) consume this object and produce context-specific output.

import { DEFAULT_FONT_STACK } from "./fontRegistry";

// ── Default values ────────────────────────────────────────────────────────────

export const TEXT_STYLE_DEFAULTS = {
  // Typography
  fontFamily:      "Manrope",          // display name; adapters use getFontStack()
  fontSize:        16,                  // number, pixels
  fontWeight:      400,                 // 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900
  fontStyle:       "normal",            // "normal" | "italic"

  // Decoration
  textDecoration:  "none",              // "none" | "underline" | "line-through" | "overline"
  textTransform:   "none",              // "none" | "uppercase" | "lowercase" | "capitalize"

  // Colour
  color:           "#000000",           // CSS colour string
  gradient:        null,                // GradientDef | null (see below)
  opacity:         1,                   // 0–1

  // Spacing
  lineHeight:      1.5,                 // unitless multiplier
  letterSpacing:   0,                   // em units (e.g. 0.05 = "0.05em")
  wordSpacing:     0,                   // px
  paragraphSpacing:0,                   // px — added as margin-bottom on <p> tags

  // Layout
  textAlign:       "left",             // "left" | "center" | "right" | "justify"
  verticalAlign:   "top",              // "top" | "middle" | "bottom"

  // Effects
  outline:         null,               // OutlineDef | null
  shadow:          null,               // ShadowDef | null
  glow:            null,               // GlowDef | null

  // Background behind text
  background:      null,               // BgDef | null
  padding:         null,               // PaddingDef | null  { top, right, bottom, left }
  borderRadius:    0,                  // px — for background pill/rounded shapes

  // Animation (web only; ignored by email/canvas adapters)
  animation:       null,               // AnimationDef | null

  // Responsive overrides (web only)
  responsive: {
    tablet: null,                      // Partial<TextStyle> | null
    mobile: null,                      // Partial<TextStyle> | null
  },

  // Metadata — not rendered but used by the style library
  _id:             null,               // string | null — id if this is a saved style
  _name:           null,               // string | null — display name in library
  _builtIn:        false,              // true for preset styles shipped with the platform
};

// ── Sub-object shapes (JSDoc-only; no runtime enforcement) ───────────────────
//
// GradientDef
//   type:    "linear" | "radial"
//   angle:   number   (degrees, linear only)
//   stops:   [{ color: string, position: number }]   position 0–100 (%)
//
// OutlineDef
//   width:   number   (px)
//   color:   string
//   blur:    number   (px, 0 = solid)
//
// ShadowDef
//   x:       number   (px)
//   y:       number   (px)
//   blur:    number   (px)
//   spread:  number   (px)
//   color:   string
//
// GlowDef
//   color:   string
//   blur:    number   (px)
//   intensity: number (1 = normal; used to repeat the shadow multiple times)
//
// BgDef
//   color:   string
//   opacity: number   (0–1)
//
// PaddingDef
//   top:     number   (px)
//   right:   number   (px)
//   bottom:  number   (px)
//   left:    number   (px)
//
// AnimationDef
//   type:    "fade-in" | "typewriter" | "slide-up" | "bounce" | string
//   delay:   number   (seconds)
//   duration:number   (seconds)

// ── Factories ─────────────────────────────────────────────────────────────────

export function createTextStyle(overrides = {}) {
  return mergeTextStyle(TEXT_STYLE_DEFAULTS, overrides);
}

// Deep-merge a partial TextStyle onto a base TextStyle.
// Null fields in `patch` clear the corresponding base value.
export function mergeTextStyle(base, patch = {}) {
  const result = { ...TEXT_STYLE_DEFAULTS, ...base };

  for (const key of Object.keys(patch)) {
    if (key === "responsive") {
      result.responsive = {
        tablet: patch.responsive?.tablet !== undefined ? patch.responsive.tablet : (base.responsive?.tablet ?? null),
        mobile: patch.responsive?.mobile !== undefined ? patch.responsive.mobile : (base.responsive?.mobile ?? null),
      };
    } else {
      result[key] = patch[key];
    }
  }

  return result;
}

// ── Validation ────────────────────────────────────────────────────────────────

export function isValidTextStyle(obj) {
  if (!obj || typeof obj !== "object") return false;
  return typeof obj.fontFamily === "string" && typeof obj.fontSize === "number";
}

// ── Migration from legacy data formats ────────────────────────────────────────
//
// Each editor had its own ad-hoc shape.  This function accepts any of the old
// formats and normalises to a valid TextStyle.  Existing data will NOT break.

export function migrateToTextStyle(legacy = {}) {
  if (!legacy || typeof legacy !== "object") return createTextStyle();

  // Already new format
  if (isValidTextStyle(legacy) && "_migrated" in legacy === false) {
    // Check if it has at least a couple of the new keys
    const newKeys = ["fontFamily", "fontSize", "fontWeight", "gradient", "outline"];
    const matchCount = newKeys.filter(k => k in legacy).length;
    if (matchCount >= 3) return createTextStyle(legacy);
  }

  const patch = {};

  // ── font family ────────────────────────────────────────────────────────────
  // Email editor stored as "Poppins, Arial, sans-serif" (CSS stack)
  // Website builder stored as "Poppins" or "Poppins, sans-serif"
  const rawFont = legacy.fontFamily || legacy.font_family || legacy.font || "";
  if (rawFont) {
    const displayName = String(rawFont).split(",")[0].replace(/['"]/g, "").trim();
    patch.fontFamily = displayName || TEXT_STYLE_DEFAULTS.fontFamily;
  }

  // ── font size ──────────────────────────────────────────────────────────────
  const rawSize = legacy.fontSize ?? legacy.font_size ?? legacy.textFontSize ?? legacy.size;
  if (rawSize != null) {
    const num = parseInt(String(rawSize), 10);
    if (Number.isFinite(num)) patch.fontSize = num;
  }

  // ── font weight ────────────────────────────────────────────────────────────
  const rawWeight = legacy.fontWeight ?? legacy.font_weight ?? legacy.fontweight;
  if (rawWeight != null) {
    const num = parseInt(String(rawWeight), 10);
    if (Number.isFinite(num)) patch.fontWeight = num;
    else if (rawWeight === "bold") patch.fontWeight = 700;
  }

  // ── font style ─────────────────────────────────────────────────────────────
  if (legacy.fontStyle === "italic" || legacy.italic === true) patch.fontStyle = "italic";

  // ── decoration ────────────────────────────────────────────────────────────
  if (legacy.textDecoration) patch.textDecoration = legacy.textDecoration;
  if (legacy.underline === true) patch.textDecoration = "underline";
  if (legacy.strikethrough === true) patch.textDecoration = "line-through";

  // ── transform ─────────────────────────────────────────────────────────────
  if (legacy.textTransform) patch.textTransform = legacy.textTransform;

  // ── colour ────────────────────────────────────────────────────────────────
  const rawColor = legacy.color || legacy.textColor || legacy.fill || legacy.text_color;
  if (rawColor) patch.color = rawColor;

  // ── opacity ───────────────────────────────────────────────────────────────
  if (legacy.opacity != null) patch.opacity = Number(legacy.opacity);

  // ── spacing ───────────────────────────────────────────────────────────────
  const rawLH = legacy.lineHeight ?? legacy.line_height ?? legacy.textLineHeight;
  if (rawLH != null) patch.lineHeight = parseFloat(String(rawLH)) || TEXT_STYLE_DEFAULTS.lineHeight;

  const rawLS = legacy.letterSpacing ?? legacy.letter_spacing;
  if (rawLS != null) patch.letterSpacing = parseFloat(String(rawLS)) || 0;

  const rawWS = legacy.wordSpacing ?? legacy.word_spacing;
  if (rawWS != null) patch.wordSpacing = parseFloat(String(rawWS)) || 0;

  // ── alignment ─────────────────────────────────────────────────────────────
  const rawAlign = legacy.textAlign ?? legacy.align ?? legacy.alignment ?? legacy.headlineAlignment;
  if (rawAlign && ["left","center","right","justify"].includes(rawAlign)) {
    patch.textAlign = rawAlign;
  }

  // ── shadow (email/web string format → ShadowDef) ──────────────────────────
  if (legacy.textShadow && typeof legacy.textShadow === "string") {
    patch.shadow = parseCssShadow(legacy.textShadow);
  } else if (legacy.shadow && typeof legacy.shadow === "object") {
    patch.shadow = legacy.shadow;
  }

  // ── background ────────────────────────────────────────────────────────────
  if (legacy.backgroundColor || legacy.bgColor) {
    patch.background = {
      color:   legacy.backgroundColor || legacy.bgColor || "#ffffff",
      opacity: 1,
    };
  }

  // ── padding ───────────────────────────────────────────────────────────────
  if (legacy.padding != null && typeof legacy.padding === "number") {
    patch.padding = { top: legacy.padding, right: legacy.padding, bottom: legacy.padding, left: legacy.padding };
  }

  // ── border radius ─────────────────────────────────────────────────────────
  if (legacy.borderRadius != null) patch.borderRadius = parseInt(String(legacy.borderRadius), 10) || 0;

  return createTextStyle(patch);
}

// Parse a CSS text-shadow string (e.g. "2px 4px 6px rgba(0,0,0,.5)") to ShadowDef
function parseCssShadow(str) {
  if (!str || str === "none") return null;
  const parts = String(str).trim().split(/\s+/);
  const nums = parts.map(p => parseFloat(p)).filter(n => !isNaN(n));
  const colorMatch = str.match(/(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})/);
  return {
    x:      nums[0] ?? 2,
    y:      nums[1] ?? 2,
    blur:   nums[2] ?? 4,
    spread: nums[3] ?? 0,
    color:  colorMatch ? colorMatch[1] : "rgba(0,0,0,0.5)",
  };
}

// ── Built-in named styles (the style library presets) ─────────────────────────

export const BUILT_IN_STYLES = [
  {
    _id: "builtin-hero",
    _name: "Hero Heading",
    _builtIn: true,
    fontFamily: "Montserrat",
    fontSize: 64,
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: -0.02,
    textTransform: "none",
    color: "#0f172a",
  },
  {
    _id: "builtin-h1",
    _name: "Heading 1",
    _builtIn: true,
    fontFamily: "Manrope",
    fontSize: 48,
    fontWeight: 700,
    lineHeight: 1.2,
    color: "#0f172a",
  },
  {
    _id: "builtin-h2",
    _name: "Heading 2",
    _builtIn: true,
    fontFamily: "Manrope",
    fontSize: 36,
    fontWeight: 600,
    lineHeight: 1.25,
    color: "#0f172a",
  },
  {
    _id: "builtin-h3",
    _name: "Heading 3",
    _builtIn: true,
    fontFamily: "Manrope",
    fontSize: 28,
    fontWeight: 600,
    lineHeight: 1.35,
    color: "#0f172a",
  },
  {
    _id: "builtin-paragraph",
    _name: "Paragraph",
    _builtIn: true,
    fontFamily: "Manrope",
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 1.65,
    color: "#334155",
  },
  {
    _id: "builtin-lead",
    _name: "Lead Text",
    _builtIn: true,
    fontFamily: "Manrope",
    fontSize: 20,
    fontWeight: 400,
    lineHeight: 1.6,
    color: "#475569",
  },
  {
    _id: "builtin-caption",
    _name: "Caption",
    _builtIn: true,
    fontFamily: "Manrope",
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.4,
    color: "#64748b",
  },
  {
    _id: "builtin-button",
    _name: "Button Label",
    _builtIn: true,
    fontFamily: "Manrope",
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 0.03,
    textTransform: "uppercase",
    color: "#ffffff",
  },
  {
    _id: "builtin-promo",
    _name: "Promo Text",
    _builtIn: true,
    fontFamily: "Montserrat",
    fontSize: 22,
    fontWeight: 700,
    color: "#f59e0b",
    textTransform: "uppercase",
    letterSpacing: 0.05,
    shadow: { x: 0, y: 2, blur: 8, spread: 0, color: "rgba(0,0,0,0.35)" },
  },
  {
    _id: "builtin-quote",
    _name: "Pull Quote",
    _builtIn: true,
    fontFamily: "Playfair Display",
    fontSize: 26,
    fontWeight: 400,
    fontStyle: "italic",
    lineHeight: 1.55,
    color: "#1e293b",
  },
  {
    _id: "builtin-label",
    _name: "Label / Tag",
    _builtIn: true,
    fontFamily: "Manrope",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.1,
    textTransform: "uppercase",
    color: "#6366f1",
  },
  {
    _id: "builtin-code",
    _name: "Code / Mono",
    _builtIn: true,
    fontFamily: "JetBrains Mono",
    fontSize: 14,
    fontWeight: 400,
    lineHeight: 1.6,
    color: "#0ea5e9",
  },
];

export function getBuiltInStyle(id) {
  return BUILT_IN_STYLES.find(s => s._id === id) || null;
}

export function createBuiltInTextStyle(id) {
  const preset = getBuiltInStyle(id);
  if (!preset) return createTextStyle();
  return createTextStyle(preset);
}
