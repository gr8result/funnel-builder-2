// canvasTextAdapter — converts a TextStyle to fabric.js IText / Textbox options.
//
// Used by:  Image Editor, Social Media Post Editor
//
// Output shape:
//   {
//     fabricOptions:  object   — pass directly to new fabric.IText(text, options)
//     shadowOptions:  object | null  — fabric.Shadow config (set on object.shadow)
//     applyToObject:  (fabricObj) => void   — helper to apply all options at once
//   }
//
// Usage example:
//   const { fabricOptions, applyToObject } = canvasTextAdapter(textStyle);
//   const textObj = new fabric.IText("Hello", fabricOptions);
//   applyToObject(textObj);
//   canvas.add(textObj);

import { getFontStack, getFontEntry } from "../fontRegistry";
import { TEXT_STYLE_DEFAULTS } from "../TextStyleSchema";

// ── Main export ───────────────────────────────────────────────────────────────

export function canvasTextAdapter(textStyle = {}) {
  const s = { ...TEXT_STYLE_DEFAULTS, ...textStyle };

  const fill          = resolveFill(s);
  const shadowOptions = resolveShadow(s);
  const strokeOptions = resolveStroke(s);

  const fabricOptions = {
    // Typography
    fontFamily:      getFontStack(s.fontFamily) || "Arial",
    fontSize:        s.fontSize || 16,
    fontWeight:      mapWeight(s.fontWeight),
    fontStyle:       s.fontStyle || "normal",
    underline:       s.textDecoration === "underline",
    linethrough:     s.textDecoration === "line-through",
    overline:        s.textDecoration === "overline",
    textDecoration:  undefined, // fabric uses individual flags above

    // Colour / fill
    fill,

    // Opacity
    opacity:         s.opacity != null ? s.opacity : 1,

    // Spacing
    lineHeight:      s.lineHeight ?? 1.5,
    charSpacing:     letterSpacingToFabric(s.letterSpacing, s.fontSize || 16),

    // Alignment
    textAlign:       s.textAlign || "left",

    // Shadow
    shadow:          shadowOptions,

    // Stroke (outline)
    ...strokeOptions,

    // Selection visual defaults
    selectable:      true,
    hasControls:     true,
    hasBorders:      true,
    lockMovementX:   false,
    lockMovementY:   false,
  };

  return {
    fabricOptions,
    shadowOptions,
    strokeOptions,
    // Convenience: call this after constructing to ensure all options are set
    applyToObject(fabricObj) {
      if (!fabricObj) return;
      Object.assign(fabricObj, fabricOptions);
      if (shadowOptions) {
        fabricObj.set("shadow", shadowOptions);
      } else {
        fabricObj.set("shadow", null);
      }
      fabricObj.setCoords?.();
    },
  };
}

// ── Fill resolver (solid colour OR gradient) ──────────────────────────────────

function resolveFill(s) {
  if (!s.gradient || !s.gradient.stops?.length) {
    return s.color || "#000000";
  }

  // fabric.js gradient — must be applied as a fabric.Gradient object
  // We return a description; applyGradient() below handles the full object.
  // For now, return first stop colour as safe fallback (gradient set separately)
  return s.gradient.stops[0]?.color || s.color || "#000000";
}

// Build a fabric.Gradient object for gradient text.
// Requires a reference fabricObj to get bounding box dimensions.
export function buildFabricGradient(gradient, fabricObj) {
  if (!gradient?.stops?.length || !fabricObj) return null;

  try {
    const { Gradient } = getFabric();
    if (!Gradient) return null;

    const w = fabricObj.width  || 200;
    const h = fabricObj.height || 50;

    const coords = gradient.type === "radial"
      ? { x1: w / 2, y1: h / 2, x2: w / 2, y2: h / 2, r1: 0, r2: Math.max(w, h) / 2 }
      : (() => {
          const rad = ((gradient.angle || 135) * Math.PI) / 180;
          return {
            x1: (w / 2) - (Math.cos(rad) * w) / 2,
            y1: (h / 2) - (Math.sin(rad) * h) / 2,
            x2: (w / 2) + (Math.cos(rad) * w) / 2,
            y2: (h / 2) + (Math.sin(rad) * h) / 2,
          };
        })();

    const colorStops = gradient.stops.map(({ color, position }) => ({
      offset: (position || 0) / 100,
      color,
    }));

    return new Gradient({
      type:        gradient.type === "radial" ? "radial" : "linear",
      coords,
      colorStops,
    });
  } catch {
    return null;
  }
}

// Apply gradient fill to an existing fabric text object
export function applyGradientToFabricText(textStyle, fabricObj) {
  if (!textStyle?.gradient || !fabricObj) return;
  const gradient = buildFabricGradient(textStyle.gradient, fabricObj);
  if (gradient) fabricObj.set("fill", gradient);
}

// ── Shadow resolver ───────────────────────────────────────────────────────────

function resolveShadow(s) {
  const shadows = [];

  if (s.shadow) {
    shadows.push(s.shadow);
  }

  if (s.glow) {
    const { color = "#ffffff", blur = 12, intensity = 1 } = s.glow;
    for (let i = 0; i < Math.min(Math.ceil(intensity), 3); i++) {
      shadows.push({ x: 0, y: 0, blur: blur * (i + 1), spread: 0, color });
    }
  }

  if (!shadows.length) return null;

  // fabric.js supports a single Shadow object; combine multiple as comma-string
  const primary = shadows[0];
  return {
    color:       primary.color || "rgba(0,0,0,0.5)",
    blur:        primary.blur  || 4,
    offsetX:     primary.x    || 0,
    offsetY:     primary.y    || 0,
    affectStroke:false,
    includeDefaultValues: true,
  };
}

// ── Stroke / outline resolver ─────────────────────────────────────────────────

function resolveStroke(s) {
  if (!s.outline) return { stroke: null, strokeWidth: 0 };
  const { width = 1, color = "#000000", blur = 0 } = s.outline;
  return {
    stroke:          color,
    strokeWidth:     width,
    paintFirst:      "stroke", // fabric: paint stroke before fill for inner outline look
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// fabric charSpacing is in 1/1000 em units
function letterSpacingToFabric(letterSpacingEm = 0, fontSize = 16) {
  if (!letterSpacingEm) return 0;
  return Math.round(letterSpacingEm * 1000);
}

function mapWeight(weight) {
  const n = parseInt(String(weight || 400), 10);
  if (n >= 700) return "bold";
  return "normal";
}

// Lazy fabric.js accessor — the image editor loads it dynamically
function getFabric() {
  if (typeof window !== "undefined" && window.fabric) return window.fabric;
  return {};
}

// ── Export-ready canvas render helper ─────────────────────────────────────────
// Call this to get a data URL of just the text rendered on a transparent canvas.
// Useful for "export text as image" scenarios in social media editor.
export async function renderTextToDataUrl(textStyle, text = "Sample Text", options = {}) {
  const { width = 800, height = 200, dpr = 2 } = options;

  const canvas = document.createElement("canvas");
  canvas.width  = width  * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const s = { ...TEXT_STYLE_DEFAULTS, ...textStyle };
  const fontStack = getFontStack(s.fontFamily) || "Arial";

  ctx.clearRect(0, 0, width, height);

  // Background
  if (s.background?.color) {
    const { color, opacity = 1 } = s.background;
    ctx.globalAlpha = opacity;
    ctx.fillStyle   = color;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  }

  ctx.globalAlpha = s.opacity ?? 1;
  ctx.font        = `${s.fontStyle === "italic" ? "italic " : ""}${s.fontWeight || 400} ${s.fontSize || 16}px ${fontStack}`;
  ctx.fillStyle   = s.color || "#000000";
  ctx.textAlign   = (s.textAlign === "center" || s.textAlign === "right") ? s.textAlign : "left";
  ctx.textBaseline = "middle";

  // Shadow
  if (s.shadow) {
    ctx.shadowOffsetX = s.shadow.x || 0;
    ctx.shadowOffsetY = s.shadow.y || 0;
    ctx.shadowBlur    = s.shadow.blur || 0;
    ctx.shadowColor   = s.shadow.color || "rgba(0,0,0,0.5)";
  }

  // Draw text
  const xOffset = s.textAlign === "center" ? width / 2 : s.textAlign === "right" ? width : (s.padding?.left || 0);
  ctx.fillText(text, xOffset, height / 2, width);

  return canvas.toDataURL("image/png");
}
