import { withAuth } from "../../../lib/withWorkspace";
// pages/api/website/import-html.js
// POST {
//   url?: string,
//   html?: string,
//   projectName?: string,
//   stylePack?: "executive"|"vibrant"|"editorial"|"minimal",
//   crawl?: boolean,
//   maxPages?: number
// }

const STYLE_PACKS = {
  executive: {
    navBg: "#0b1220",
    navText: "#e2e8f0",
    heroBg: "#1d4ed8",
    textBg: "#ffffff",
    textColor: "#0f172a",
    footerBg: "#0f172a",
    footerText: "#e2e8f0",
  },
  vibrant: {
    navBg: "#111827",
    navText: "#ecfeff",
    heroBg: "#0891b2",
    textBg: "#ecfeff",
    textColor: "#083344",
    footerBg: "#0f172a",
    footerText: "#e0f2fe",
  },
  editorial: {
    navBg: "#1f2937",
    navText: "#f9fafb",
    heroBg: "#4b5563",
    textBg: "#ffffff",
    textColor: "#111827",
    footerBg: "#111827",
    footerText: "#f3f4f6",
  },
  minimal: {
    navBg: "#0f172a",
    navText: "#f8fafc",
    heroBg: "#334155",
    textBg: "#ffffff",
    textColor: "#0f172a",
    footerBg: "#1e293b",
    footerText: "#f1f5f9",
  },
};

const GENERIC_FONT_TOKENS = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "system-ui",
  "ui-sans-serif",
  "ui-serif",
  "ui-monospace",
  "emoji",
  "math",
  "fangsong",
  "cursive",
  "fantasy",
]);

function makeImportedAssetId(seed = "asset") {
  return `imported-${String(seed || "asset").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "asset"}-${Math.random().toString(16).slice(2, 8)}`;
}

function sanitizeAssetName(value, fallback = "Imported asset") {
  const cleaned = String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}

function inferAssetType(src = "") {
  const value = String(src || "").toLowerCase();
  if (value.startsWith("data:image/svg+xml")) return "image/svg+xml";
  if (value.startsWith("data:image/png")) return "image/png";
  if (value.startsWith("data:image/webp")) return "image/webp";
  if (value.startsWith("data:image/gif")) return "image/gif";
  if (/\.svg([?#].*)?$/i.test(value)) return "image/svg+xml";
  if (/\.png([?#].*)?$/i.test(value)) return "image/png";
  if (/\.webp([?#].*)?$/i.test(value)) return "image/webp";
  if (/\.gif([?#].*)?$/i.test(value)) return "image/gif";
  return "image/jpeg";
}

function resolveSourceUrl(raw, baseUrl) {
  const input = String(raw || "").trim();
  if (!input) return "";
  if (/^(data:image\/|blob:)/i.test(input)) return input;
  if (/^(javascript:|mailto:|tel:)/i.test(input)) return "";
  try {
    return new URL(input, baseUrl).href;
  } catch {
    return "";
  }
}

function buildImportedAsset(src, fallbackName, typeHint = "") {
  const resolved = String(src || "").trim();
  if (!resolved) return null;

  let derivedName = fallbackName;
  if (/^data:image\//i.test(resolved)) {
    derivedName = fallbackName;
  } else {
    try {
      const parsed = new URL(resolved);
      const leaf = parsed.pathname.split("/").filter(Boolean).pop();
      if (leaf) derivedName = sanitizeAssetName(leaf, fallbackName);
    } catch {
      derivedName = sanitizeAssetName(fallbackName, fallbackName);
    }
  }

  return {
    id: makeImportedAssetId(`${derivedName}-${typeHint || "asset"}`),
    name: sanitizeAssetName(derivedName, fallbackName),
    type: typeHint || inferAssetType(resolved),
    src: resolved,
  };
}

function scoreFeatureAsset(asset) {
  const name = String(asset?.name || "").toLowerCase();
  const src = String(asset?.src || "").toLowerCase();
  let score = 0;
  if (/^data:image\/svg\+xml/i.test(src)) score += 40;
  if (/\.svg([?#].*)?$/i.test(src)) score += 28;
  if (/icon|symbol|badge|mark/.test(name)) score += 12;
  if (/logo|brand/.test(name)) score += 4;
  if (/favicon|apple touch|mask icon/.test(name)) score -= 30;
  return score;
}

function dedupeImportedAssets(assets, max = 48) {
  const seen = new Set();
  const output = [];
  for (const asset of Array.isArray(assets) ? assets : []) {
    const src = String(asset?.src || "").trim();
    if (!src || seen.has(src)) continue;
    seen.add(src);
    output.push(asset);
    if (output.length >= max) break;
  }
  return output;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex) {
  const raw = String(hex || "").replace("#", "").trim();
  if (!/^[0-9a-f]{3,8}$/i.test(raw)) return null;
  const normalized = raw.length === 3
    ? raw.split("").map((char) => `${char}${char}`).join("")
    : raw.length === 4
      ? raw.slice(0, 3).split("").map((char) => `${char}${char}`).join("")
      : raw.length >= 6
        ? raw.slice(0, 6)
        : raw;
  if (normalized.length !== 6) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbStringToRgb(value) {
  const match = String(value || "").match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  const parts = match[1].split(",").map((part) => Number.parseFloat(part.trim()));
  if (parts.length < 3 || parts.slice(0, 3).some((part) => Number.isNaN(part))) return null;
  return {
    r: clamp(Math.round(parts[0]), 0, 255),
    g: clamp(Math.round(parts[1]), 0, 255),
    b: clamp(Math.round(parts[2]), 0, 255),
  };
}

function hslStringToRgb(value) {
  const match = String(value || "").match(/hsla?\(([^)]+)\)/i);
  if (!match) return null;
  const parts = match[1].split(",").map((part) => part.trim());
  if (parts.length < 3) return null;

  const h = Number.parseFloat(parts[0]);
  const s = Number.parseFloat(parts[1]);
  const l = Number.parseFloat(parts[2]);
  if ([h, s, l].some((part) => Number.isNaN(part))) return null;

  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s / 100, 0, 1);
  const light = clamp(l / 100, 0, 1);
  const chroma = (1 - Math.abs(2 * light - 1)) * sat;
  const segment = hue / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;

  if (segment >= 0 && segment < 1) {
    red = chroma;
    green = x;
  } else if (segment < 2) {
    red = x;
    green = chroma;
  } else if (segment < 3) {
    green = chroma;
    blue = x;
  } else if (segment < 4) {
    green = x;
    blue = chroma;
  } else if (segment < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  const offset = light - chroma / 2;
  return {
    r: Math.round((red + offset) * 255),
    g: Math.round((green + offset) * 255),
    b: Math.round((blue + offset) * 255),
  };
}

function parseColor(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  return hexToRgb(text) || rgbStringToRgb(text) || hslStringToRgb(text);
}

function rgbToHex(rgb) {
  if (!rgb) return null;
  return `#${[rgb.r, rgb.g, rgb.b]
    .map((channel) => clamp(channel, 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function relativeLuminance(rgb) {
  if (!rgb) return 0;
  const channel = (value) => {
    const normalized = clamp(value, 0, 255) / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

function colorSaturation(rgb) {
  if (!rgb) return 0;
  const values = [rgb.r, rgb.g, rgb.b].map((value) => clamp(value, 0, 255) / 255);
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max === min) return 0;
  const lightness = (max + min) / 2;
  return lightness > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

function contrastTextFor(color, darkText = "#0f172a", lightText = "#f8fafc") {
  const rgb = parseColor(color);
  return relativeLuminance(rgb) > 0.58 ? darkText : lightText;
}

function collectThemeColors(html) {
  const matches = String(html || "").match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi) || [];
  const counts = new Map();

  matches.forEach((entry) => {
    const rgb = parseColor(entry);
    const hex = rgbToHex(rgb);
    if (!hex) return;
    counts.set(hex, (counts.get(hex) || 0) + 1);
  });

  return [...counts.entries()]
    .map(([hex, count]) => ({
      hex,
      count,
      rgb: parseColor(hex),
      luminance: relativeLuminance(parseColor(hex)),
      saturation: colorSaturation(parseColor(hex)),
    }))
    .sort((a, b) => b.count - a.count);
}

function extractNamedCssColor(html, names) {
  const source = String(html || "");
  for (const name of names) {
    const regex = new RegExp(`(?:--${name}|${name}-color)\\s*:\\s*(#[0-9a-f]{3,8}|rgba?\\([^)]*\\)|hsla?\\([^)]*\\))`, "i");
    const match = source.match(regex);
    const hex = rgbToHex(parseColor(match?.[1] || ""));
    if (hex) return hex;
  }
  return null;
}

function pickReadableLightColor(candidate, fallback) {
  const rgb = parseColor(candidate);
  if (!rgb) return fallback;
  return relativeLuminance(rgb) > 0.72 ? rgbToHex(rgb) : fallback;
}

function pickThemeColor(colors, predicate, sortValue, fallback) {
  const matches = colors.filter((entry) => predicate(entry));
  if (!matches.length) return fallback?.hex || null;

  const sorted = [...matches].sort((a, b) => {
    const delta = sortValue(a) - sortValue(b);
    if (delta !== 0) return delta;
    return b.count - a.count;
  });

  return sorted[0]?.hex || fallback?.hex || null;
}

function extractFontFamilies(html) {
  const seen = new Set();
  const fonts = [];
  const regex = /font-family\s*:\s*([^;}{]+)/gi;
  let match;

  while ((match = regex.exec(String(html || "")))) {
    const family = String(match[1] || "")
      .split(",")
      .map((part) => part.trim().replace(/^['"]|['"]$/g, ""))
      .find((part) => part && !GENERIC_FONT_TOKENS.has(part.toLowerCase()));
    if (!family) continue;

    const normalized = family.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    fonts.push(family);
    if (fonts.length >= 4) break;
  }

  return fonts;
}

function inferThemeTokens(html, fallbackStyle) {
  const colors = collectThemeColors(html);
  const fonts = extractFontFamilies(html);
  const explicitAccent = extractNamedCssColor(html, ["brand", "primary", "accent", "cta"]);
  const explicitDark = extractNamedCssColor(html, ["nav-bg", "header-bg", "surface-dark", "dark", "ink"]);
  const explicitLight = pickReadableLightColor(
    extractNamedCssColor(html, ["surface", "background", "canvas", "light"]),
    null
  );

  const darkColor = explicitDark || pickThemeColor(colors, (entry) => entry.luminance < 0.3, (entry) => entry.luminance, null) || fallbackStyle.navBg;
  const lightColor = explicitLight || pickThemeColor(colors, (entry) => entry.luminance > 0.82, (entry) => -entry.luminance, null) || fallbackStyle.textBg;
  const accentColor = explicitAccent || pickThemeColor(
    colors,
    (entry) => entry.saturation > 0.28 && entry.luminance > 0.18 && entry.luminance < 0.82,
    (entry) => -((entry.saturation * 100) - (Math.abs(entry.luminance - 0.46) * 38) + Math.min(entry.count, 6)),
    colors[0]
  ) || fallbackStyle.heroBg;
  const mutedColor = pickThemeColor(colors, (entry) => entry.luminance > 0.72 && entry.luminance < 0.95, (entry) => Math.abs(entry.luminance - 0.84), colors[1]) || lightColor;

  return {
    navBg: darkColor,
    navText: contrastTextFor(darkColor, fallbackStyle.textColor, fallbackStyle.navText),
    heroBg: accentColor,
    heroText: contrastTextFor(accentColor, fallbackStyle.textColor, "#ffffff"),
    textBg: lightColor,
    textColor: contrastTextFor(lightColor, fallbackStyle.textColor, fallbackStyle.navText),
    footerBg: darkColor,
    footerText: contrastTextFor(darkColor, fallbackStyle.textColor, fallbackStyle.footerText),
    accent: accentColor,
    muted: mutedColor,
    headingFont: fonts[0] ? `'${fonts[0]}', ${fallbackStyle.headingFont || fallbackStyle.bodyFont || "sans-serif"}` : fallbackStyle.headingFont,
    bodyFont: fonts[1]
      ? `'${fonts[1]}', ${fallbackStyle.bodyFont || fallbackStyle.headingFont || "sans-serif"}`
      : fonts[0]
        ? `'${fonts[0]}', ${fallbackStyle.bodyFont || fallbackStyle.headingFont || "sans-serif"}`
        : fallbackStyle.bodyFont,
  };
}

function collectNavLinks(html, baseUrl, max = 5) {
  const links = [];
  const seen = new Set();
  const matches = [...String(html || "").matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];

  matches.forEach((match) => {
    if (links.length >= max) return;
    const label = stripTags(match[2] || "").replace(/\s+/g, " ").trim();
    const href = String(match[1] || "").trim();
    if (!label || label.length > 24) return;
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return;

    let resolved = href;
    try {
      resolved = new URL(href, baseUrl).pathname || href;
    } catch {
      resolved = href;
    }

    const key = `${label.toLowerCase()}|${resolved}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ label, href: resolved === "/" ? "#home" : resolved });
  });

  return links;
}

function rid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `imp_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function stripTags(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function encodeSvgDataUrl(svgMarkup) {
  const compact = String(svgMarkup || "").replace(/\s+/g, " ").trim();
  if (!compact) return "";
  return `data:image/svg+xml;utf8,${encodeURIComponent(compact)}`;
}

function uniqByText(values) {
  const seen = new Set();
  return values.filter((v) => {
    const key = String(v || "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pickTitleFromHtml(html) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return stripTags(h1[1]);

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) return stripTags(title[1]);

  return "Website";
}

function pickMetaDescription(html) {
  const m = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  return m ? stripTags(m[1]) : "";
}

function collectParagraphs(html, max = 4) {
  const matches = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripTags(m[1]))
    .filter((line) => line.length > 40)
    .slice(0, max);
  return uniqByText(matches);
}

function collectHeadings(html, max = 6) {
  const matches = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)]
    .map((m) => stripTags(m[1]))
    .filter(Boolean)
    .slice(0, max);
  return uniqByText(matches);
}

function collectImages(html, baseUrl, max = 12) {
  const images = [...String(html || "").matchAll(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi)]
    .map((m) => resolveSourceUrl(m[1], baseUrl))
    .filter(Boolean)
    .slice(0, max * 3);

  return uniqByText(images).slice(0, max);
}

function collectButtons(html, baseUrl, max = 2) {
  const links = [...html.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => ({
      href: resolveSourceUrl(m[1], baseUrl) || String(m[1] || "#").trim(),
      label: stripTags(m[2] || "Learn More"),
    }))
    .filter((a) => a.label && a.label.length <= 40)
    .sort((a, b) => scoreButtonCandidate(b) - scoreButtonCandidate(a))
    .slice(0, max);

  return links;
}

function collectLogoAsset(html, baseUrl, siteTitle = "") {
  const matches = [...String(html || "").matchAll(/<img\b([^>]*)>/gi)];
  for (const match of matches) {
    const attrs = String(match[1] || "");
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
    if (!srcMatch) continue;
    const metadata = attrs.toLowerCase();
    if (!/(logo|brand|wordmark|mark|symbol)/i.test(metadata)) continue;
    const src = resolveSourceUrl(srcMatch[1], baseUrl);
    if (!src) continue;
    return buildImportedAsset(src, `${siteTitle || "Imported"} logo`, inferAssetType(src));
  }
  return null;
}

function collectIconAssets(html, baseUrl, siteTitle = "Imported", max = 32) {
  const assets = [];

  const linkMatches = [...String(html || "").matchAll(/<link[^>]*rel=["']([^"']*(?:icon|apple-touch-icon|mask-icon)[^"']*)["'][^>]*href=["']([^"']+)["'][^>]*>/gi)];
  linkMatches.forEach((match, index) => {
    const src = resolveSourceUrl(match[2], baseUrl);
    const asset = buildImportedAsset(src, `${siteTitle} icon ${index + 1}`, inferAssetType(src));
    if (asset) assets.push(asset);
  });

  const imageMatches = [...String(html || "").matchAll(/<img\b([^>]*)>/gi)];
  imageMatches.forEach((match, index) => {
    const attrs = String(match[1] || "");
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
    if (!srcMatch) return;
    const src = resolveSourceUrl(srcMatch[1], baseUrl);
    if (!src) return;
    const width = Number.parseInt((attrs.match(/width=["']?(\d+)/i) || [])[1] || "0", 10) || 0;
    const height = Number.parseInt((attrs.match(/height=["']?(\d+)/i) || [])[1] || "0", 10) || 0;
    const metadata = attrs.toLowerCase();
    const isIconLike = /icon|logo|favicon|brand|symbol|badge/.test(metadata)
      || /\.svg([?#].*)?$/i.test(src)
      || ((width && width <= 160) && (height && height <= 160));
    if (!isIconLike) return;
    const asset = buildImportedAsset(src, `${siteTitle} asset ${index + 1}`, inferAssetType(src));
    if (asset) assets.push(asset);
  });

  const useMatches = [...String(html || "").matchAll(/<(?:use|image)[^>]+(?:href|xlink:href)=["']([^"']+)["'][^>]*>/gi)];
  useMatches.forEach((match, index) => {
    const href = String(match[1] || "").split("#")[0];
    const src = resolveSourceUrl(href, baseUrl);
    if (!src) return;
    const asset = buildImportedAsset(src, `${siteTitle} sprite ${index + 1}`, inferAssetType(src));
    if (asset) assets.push(asset);
  });

  const inlineSvgs = [...String(html || "").matchAll(/<svg\b[\s\S]*?<\/svg>/gi)];
  inlineSvgs.forEach((match, index) => {
    const svgMarkup = String(match[0] || "").trim();
    if (!svgMarkup) return;
    const encoded = encodeSvgDataUrl(svgMarkup);
    const asset = buildImportedAsset(encoded, `${siteTitle} inline icon ${index + 1}`, "image/svg+xml");
    if (asset) assets.push(asset);
  });

  return dedupeImportedAssets(assets, max);
}

function collectStylesheetUrls(html, baseUrl, max = 8) {
  const urls = [];
  const seen = new Set();
  const matches = [...String(html || "").matchAll(/<link[^>]*rel=["']([^"']*stylesheet[^"']*)["'][^>]*href=["']([^"']+)["'][^>]*>/gi)];

  matches.forEach((match) => {
    if (urls.length >= max) return;
    const href = resolveSourceUrl(match[2], baseUrl);
    if (!href || seen.has(href)) return;
    seen.add(href);
    urls.push(href);
  });

  return urls;
}

function collectAssetsFromCss(cssText, cssUrl, siteTitle = "Imported", max = 32) {
  const assets = [];
  const seen = new Set();
  const matches = [...String(cssText || "").matchAll(/url\(([^)]+)\)/gi)];

  matches.forEach((match, index) => {
    if (assets.length >= max) return;
    const raw = String(match[1] || "").trim().replace(/^['"]|['"]$/g, "");
    if (!raw || /^data:font\//i.test(raw) || /\.woff2?([?#].*)?$/i.test(raw) || /\.ttf([?#].*)?$/i.test(raw) || /\.eot([?#].*)?$/i.test(raw)) return;
    const src = resolveSourceUrl(raw, cssUrl);
    if (!src || seen.has(src)) return;
    if (!/(\.svg([?#].*)?$|\.png([?#].*)?$|\.jpe?g([?#].*)?$|\.webp([?#].*)?$|\.gif([?#].*)?$|^data:image\/)/i.test(src)) return;
    seen.add(src);
    const asset = buildImportedAsset(src, `${siteTitle} stylesheet asset ${index + 1}`, inferAssetType(src));
    if (asset) assets.push(asset);
  });

  return dedupeImportedAssets(assets, max);
}

function scoreButtonCandidate(button) {
  const label = String(button?.label || "").trim().toLowerCase();
  if (!label) return -100;
  let score = 0;
  if (/^(home|about|services?|pricing|contact|blog)$/.test(label)) score -= 10;
  if (/(get|book|start|claim|buy|shop|request|schedule|contact|learn|quote|call|apply|join|download)/.test(label)) score += 8;
  if (label.length >= 8) score += 2;
  if (label.length > 28) score -= 2;
  if (String(button?.href || "").trim() === "/") score -= 6;
  return score;
}

function toSentence(text) {
  const v = String(text || "").trim();
  if (!v) return "";
  return /[.!?]$/.test(v) ? v : `${v}.`;
}

function polishHeadline(rawTitle, fallbackProjectName) {
  const base = String(rawTitle || fallbackProjectName || "Your Next Big Launch").trim();
  if (!base) return "Launch a premium digital experience";
  if (base.length > 18) return base;
  return `${base}: built for credibility and growth`;
}

function polishSubheadline(metaDescription, firstParagraph) {
  const source = String(metaDescription || firstParagraph || "").trim();
  if (!source) {
    return "A clear message, polished visuals, and conversion-ready structure designed to turn visitors into action.";
  }
  const trimmed = source.slice(0, 220);
  return toSentence(trimmed);
}

function titleFromPath(pathname) {
  const normalized = String(pathname || "").replace(/^\/+|\/+$/g, "");
  if (!normalized) return "Home";
  const last = normalized.split("/").filter(Boolean).pop() || "Home";
  return last
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function objectiveForPageName(name) {
  const key = String(name || "").toLowerCase();
  if (key.includes("home")) return "Establish trust and present the core offer";
  if (key.includes("about")) return "Build authority and brand credibility";
  if (key.includes("service") || key.includes("product") || key.includes("pricing")) return "Show value and move visitors toward decision";
  if (key.includes("contact") || key.includes("book")) return "Capture qualified inquiries";
  if (key.includes("blog") || key.includes("article")) return "Educate and build topical trust";
  return "Move visitors toward action";
}

function addCandidate(candidates, href, baseUrl) {
  if (!href) return;
  const raw = String(href || "").trim();
  if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) return;

  let parsed;
  try {
    parsed = new URL(raw, baseUrl);
  } catch {
    return;
  }

  const base = new URL(baseUrl);
  if (parsed.origin !== base.origin) return;
  if (/\.(pdf|jpg|jpeg|png|gif|webp|svg|zip|rar)$/i.test(parsed.pathname)) return;

  const clean = `${parsed.origin}${parsed.pathname.replace(/\/$/, "") || "/"}`;
  candidates.add(clean);
}

function scorePath(pathname) {
  const value = String(pathname || "").toLowerCase();
  if (value === "/" || value === "") return 100;
  if (value.includes("about")) return 90;
  if (value.includes("service")) return 88;
  if (value.includes("product")) return 86;
  if (value.includes("pricing")) return 84;
  if (value.includes("contact")) return 82;
  if (value.includes("book")) return 80;
  if (value.includes("blog")) return 70;
  return 40 - Math.min(value.split("/").length, 5);
}

function buildImportedBlocks({ html, sourceUrl, stylePack, projectName, importedCssAssets = [] }) {
  const baseStyle = STYLE_PACKS[stylePack] || STYLE_PACKS.executive;
  const inferredTheme = inferThemeTokens(html, baseStyle);
  const style = { ...baseStyle, ...inferredTheme };
  const title = pickTitleFromHtml(html);
  const metaDescription = pickMetaDescription(html);
  const headings = collectHeadings(html);
  const paragraphs = collectParagraphs(html);
  const images = collectImages(html, sourceUrl);
  const buttons = collectButtons(html, sourceUrl);
  const navLinks = collectNavLinks(html, sourceUrl);
  const iconAssets = dedupeImportedAssets([
    ...collectIconAssets(html, sourceUrl, title || projectName || "Imported"),
    ...(Array.isArray(importedCssAssets) ? importedCssAssets : []),
  ], 40);
  const logoAsset = collectLogoAsset(html, sourceUrl, title || projectName || "Imported");
  const featureImages = images.filter((src) => !iconAssets.some((asset) => asset.src === src));
  const featureCardAssets = [...iconAssets]
    .filter((asset) => !/favicon|apple touch|mask icon/i.test(String(asset?.name || "")))
    .sort((left, right) => scoreFeatureAsset(right) - scoreFeatureAsset(left));

  const polishedHeadline = polishHeadline(title, projectName);
  const polishedSub = polishSubheadline(metaDescription, paragraphs[0]);
  const featureItems = headings.slice(0, 4).map((heading, index) => ({
    title: heading,
    body: paragraphs[index + 1] || "",
    image: featureCardAssets[index]?.src || featureImages[index + 1] || iconAssets[index]?.src || "",
    imageX: 50,
    imageY: 50,
  }));
  const bodyText = [metaDescription, ...paragraphs.slice(0, 2)].filter(Boolean).map(toSentence).join("\n\n");
  const heroImage = featureImages[0] || images[0] || "";
  const importedAssets = dedupeImportedAssets([
    ...(logoAsset ? [logoAsset] : []),
    ...iconAssets,
    ...images.map((src, index) => buildImportedAsset(src, `${title || projectName || "Imported"} image ${index + 1}`, inferAssetType(src))).filter(Boolean),
  ], 48);

  const blocks = [
    {
      id: rid(),
      type: "nav-bar",
      props: {
        brand: title || projectName || "Your Brand",
        links: navLinks.length ? navLinks : [
          { label: "Home", href: "#home" },
          { label: "About", href: "#about" },
          { label: "Services", href: "#services" },
          { label: "Contact", href: "#contact" },
        ],
        ctaText: buttons[0]?.label || "Get Started",
        ctaLink: buttons[0]?.href || "#contact",
        backgroundColor: style.navBg,
        textColor: style.navText,
        buttonBackgroundColor: style.accent,
        buttonTextColor: contrastTextFor(style.accent, style.textColor, "#ffffff"),
        headingFontFamily: style.headingFont,
        bodyFontFamily: style.bodyFont,
      },
    },
    {
      id: rid(),
      type: "hero",
      props: {
        headline: polishedHeadline,
        subheadline: polishedSub,
        ctaText: buttons[0]?.label || "Learn More",
        ctaLink: buttons[0]?.href || "#contact",
        backgroundStyle: heroImage ? "image" : "gradient",
        backgroundImage: heroImage,
        backgroundColor: style.heroBg,
        textColor: style.heroText,
        headingFontFamily: style.headingFont,
        bodyFontFamily: style.bodyFont,
      },
    },
  ];

  if (featureItems.length) {
    blocks.push({
      id: rid(),
      type: "feature-list",
      props: {
        title: "Highlights",
        items: featureItems,
        layout: "columns",
        accentColor: style.accent,
        backgroundColor: style.muted,
        headingFontFamily: style.headingFont,
        bodyFontFamily: style.bodyFont,
      },
    });
  }

  if (bodyText) {
    blocks.push({
      id: rid(),
      type: "text",
      props: {
        text: bodyText,
        alignment: "left",
        textColor: style.textColor,
        backgroundColor: style.textBg,
        headingFontFamily: style.headingFont,
        bodyFontFamily: style.bodyFont,
      },
    });
  }

  if (images.length > 1) {
    blocks.push({
      id: rid(),
      type: "image-gallery",
      props: {
        title: "Gallery",
        columns: 3,
        images: featureImages.slice(1, 7).map((src, idx) => ({ src, alt: `Imported image ${idx + 1}` })),
        backgroundColor: style.textBg,
      },
    });
  }

  blocks.push({
    id: rid(),
    type: "cta-button",
    props: {
      text: buttons[1]?.label || "Contact Us",
      link: buttons[1]?.href || "#contact",
      alignment: "center",
      style: "primary",
      backgroundColor: style.accent,
      textColor: contrastTextFor(style.accent, style.textColor, "#ffffff"),
      headingFontFamily: style.headingFont,
      bodyFontFamily: style.bodyFont,
    },
  });

  blocks.push({
    id: rid(),
    type: "text",
    props: {
      text: `© ${new Date().getFullYear()} ${title || projectName || "Your Brand"}. All rights reserved.`,
      alignment: "center",
      textColor: style.footerText,
      backgroundColor: style.footerBg,
      headingFontFamily: style.headingFont,
      bodyFontFamily: style.bodyFont,
    },
  });

  return {
    title,
    pageName: titleFromPath(new URL(sourceUrl).pathname),
    objective: objectiveForPageName(titleFromPath(new URL(sourceUrl).pathname)),
    blocks,
    importedAssets,
    logoAsset,
  };
}

async function fetchHtml(url) {
  // SSRF protection: only allow https:// to public hosts
  let parsedUrl;
  try { parsedUrl = new URL(url); } catch { throw new Error("Invalid URL"); }
  if (parsedUrl.protocol !== "https:") throw new Error("URL must use https");
  const host = parsedUrl.hostname.toLowerCase();
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1|0\.0\.0\.0)/.test(host)) {
    throw new Error("URL must be a public address");
  }
  const fetched = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 WebsiteBuilderImporter",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!fetched.ok) {
    throw new Error(`Could not fetch URL (${fetched.status})`);
  }

  return String(await fetched.text()).slice(0, 1_500_000);
}

async function fetchCssAssetPool(html, baseUrl, projectName = "Imported") {
  const stylesheets = collectStylesheetUrls(html, baseUrl, 8);
  if (!stylesheets.length) return [];

  const results = await Promise.all(stylesheets.map(async (cssUrl) => {
    try {
      const response = await fetch(cssUrl, {
        headers: {
          "user-agent": "Mozilla/5.0 WebsiteBuilderImporter",
          accept: "text/css,*/*;q=0.1",
        },
      });
      if (!response.ok) return [];
      const cssText = String(await response.text()).slice(0, 400_000);
      return collectAssetsFromCss(cssText, cssUrl, projectName, 16);
    } catch {
      return [];
    }
  }));

  return dedupeImportedAssets(results.flat(), 40);
}

function discoverInternalUrls(html, baseUrl, maxPages) {
  const candidates = new Set();
  const matches = [...String(html || "").matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>/gi)];

  matches.forEach((m) => addCandidate(candidates, m[1], baseUrl));

  const root = new URL(baseUrl);
  const sorted = [...candidates]
    .filter((href) => href !== `${root.origin}${root.pathname.replace(/\/$/, "") || "/"}`)
    .sort((a, b) => scorePath(new URL(b).pathname) - scorePath(new URL(a).pathname));

  return sorted.slice(0, Math.max(0, maxPages - 1));
}

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    let {
      url,
      html,
      projectName,
      stylePack = "executive",
      crawl = false,
      maxPages = 4,
    } = req.body || {};

    if (!html && !url) {
      return res.status(400).json({ ok: false, error: "Provide url or html" });
    }

    const safeStylePack = STYLE_PACKS[String(stylePack || "").toLowerCase()] ? String(stylePack).toLowerCase() : "executive";
    const safeMaxPages = Math.min(8, Math.max(1, Number(maxPages) || 4));
    const doCrawl = !!crawl;

    if (url) {
      const target = String(url || "").trim();
      if (!/^https?:\/\//i.test(target)) {
        return res.status(400).json({ ok: false, error: "Use a full URL starting with http:// or https://" });
      }

      const rootHtml = await fetchHtml(target);
      const rootCssAssets = await fetchCssAssetPool(rootHtml, target, projectName || "Imported Website");
      const targets = [target];

      if (doCrawl && safeMaxPages > 1) {
        const discovered = discoverInternalUrls(rootHtml, target, safeMaxPages);
        discovered.forEach((link) => targets.push(link));
      }

      const pageResults = [];
      for (let i = 0; i < targets.length; i += 1) {
        const sourceUrl = targets[i];
        try {
          const sourceHtml = i === 0 ? rootHtml : await fetchHtml(sourceUrl);
          const cssAssets = i === 0 ? rootCssAssets : await fetchCssAssetPool(sourceHtml, sourceUrl, projectName || "Imported Website");
          const result = buildImportedBlocks({
            html: sourceHtml,
            sourceUrl,
            stylePack: safeStylePack,
            projectName,
            importedCssAssets: cssAssets,
          });
          pageResults.push({ sourceUrl, ...result });
        } catch {
          // Ignore page-level fetch failures so import still works for the rest.
        }
      }

      if (!pageResults.length) {
        return res.status(400).json({ ok: false, error: "Could not import pages from this URL" });
      }

      const cleanProjectName = String(projectName || pageResults[0].title || "Imported Website").trim();
      const usedNames = new Set();
      const pages = [];
      const pageBlocks = {};
      const importedImages = [];
      let importedLogo = null;

      pageResults.forEach((result, idx) => {
        let name = idx === 0 ? "Home" : result.pageName || `Page ${idx + 1}`;
        if (usedNames.has(name)) {
          let n = 2;
          while (usedNames.has(`${name} ${n}`)) n += 1;
          name = `${name} ${n}`;
        }

        usedNames.add(name);
        pages.push({ name, objective: result.objective || objectiveForPageName(name) });
        pageBlocks[name] = result.blocks;
        importedImages.push(...(Array.isArray(result.importedAssets) ? result.importedAssets : []));
        if (!importedLogo && result.logoAsset?.src) importedLogo = result.logoAsset;
      });

      return res.status(200).json({
        ok: true,
        projectName: cleanProjectName,
        pages,
        pageBlocks,
        brandAssets: {
          logo: importedLogo,
          images: dedupeImportedAssets(importedImages.filter((asset) => asset?.src && asset.src !== importedLogo?.src), 48),
        },
      });
    }

    const baseSourceUrl = String(url || "https://import.local/").trim() || "https://import.local/";
    const cssAssets = /^https?:\/\//i.test(baseSourceUrl)
      ? await fetchCssAssetPool(String(html || "").slice(0, 1_500_000), baseSourceUrl, projectName || "Imported Website")
      : [];

    const single = buildImportedBlocks({
      html: String(html || "").slice(0, 1_500_000),
      sourceUrl: baseSourceUrl,
      stylePack: safeStylePack,
      projectName,
      importedCssAssets: cssAssets,
    });

    return res.status(200).json({
      ok: true,
      projectName: String(projectName || single.title || "Imported Website").trim(),
      pages: [{ name: "Home", objective: "Imported from HTML" }],
      pageBlocks: {
        Home: single.blocks,
      },
      brandAssets: {
        logo: single.logoAsset || null,
        images: dedupeImportedAssets((single.importedAssets || []).filter((asset) => asset?.src && asset.src !== single.logoAsset?.src), 48),
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || "Import failed" });
  }
}

export default withAuth(handler);
