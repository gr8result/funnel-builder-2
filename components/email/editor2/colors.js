import { clamp } from "./editorUtils.js";

export function parseColorToRgb(color) {
  const raw = String(color || "").trim();
  const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const value = hex[1].length === 3
      ? hex[1].split("").map((part) => part + part).join("")
      : hex[1];
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
    };
  }

  const rgb = raw.match(/^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (rgb) {
    return {
      r: clamp(Number(rgb[1]), 0, 255),
      g: clamp(Number(rgb[2]), 0, 255),
      b: clamp(Number(rgb[3]), 0, 255),
    };
  }

  return null;
}

export function rgbToHex({ r = 0, g = 0, b = 0 } = {}) {
  const toHex = (value) => clamp(value, 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function parseAlphaFromColor(color, fallback = 0.38) {
  const raw = String(color || "").trim();
  if (/^transparent$/i.test(raw)) return 0;
  const match = raw.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([0-9]*\.?[0-9]+)\s*\)$/i);
  if (!match) return fallback;
  return clamp(Number(match[1]) * 100, 0, 100) / 100;
}

export function composeOverlayColor(baseColor, opacity = 0.38) {
  if (String(baseColor || "").trim().toLowerCase() === "transparent") return "transparent";
  const rgb = parseColorToRgb(baseColor) || { r: 15, g: 23, b: 42 };
  const alpha = clamp(Number(opacity) * 100, 0, 100) / 100;
  if (alpha >= 1) return rgbToHex(rgb);
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

function getColorLuminance(color) {
  const rgb = parseColorToRgb(color);
  if (!rgb) return null;
  const channels = [rgb.r, rgb.g, rgb.b].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}

export function ensureReadableColor(color, background, lightFallback = "#ffffff", darkFallback = "#0f172a") {
  const bgLum = getColorLuminance(background);
  const fgLum = getColorLuminance(color);
  if (bgLum == null) return color || lightFallback;
  if (fgLum == null) return bgLum < 0.5 ? lightFallback : darkFallback;
  return Math.abs(fgLum - bgLum) < 0.36 ? (bgLum < 0.5 ? lightFallback : darkFallback) : color;
}

export function resolvePreferredColor(color, background, lightFallback = "#ffffff", darkFallback = "#0f172a") {
  const preferred = String(color || "").trim();
  return preferred ? preferred : ensureReadableColor("", background, lightFallback, darkFallback);
}
