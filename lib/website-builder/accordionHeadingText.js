function decodeEntitiesOnce(value = "") {
  return String(value || "")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
}

function decodeStoredHeadingHtml(value = "") {
  let decoded = String(value || "").replace(/\u200b/g, "");
  for (let index = 0; index < 3; index += 1) {
    const next = decodeEntitiesOnce(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

function safeCssColor(value = "") {
  const color = String(value || "").trim();
  if (/^#[0-9a-f]{3,8}$/i.test(color)) return color;
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(color)) return color;
  return "";
}

function normaliseFontSize(value = "") {
  const match = String(value || "").trim().match(/^(\d+(?:\.\d+)?)px$/i);
  if (!match) return "";
  const size = Math.max(8, Math.min(96, Number(match[1])));
  return `${size}px`;
}

function normaliseFontWeight(value = "") {
  const weight = String(value || "").trim().toLowerCase();
  if (["normal", "bold", "lighter", "bolder"].includes(weight)) return weight;
  const numeric = Number(weight);
  return Number.isFinite(numeric) && numeric >= 100 && numeric <= 900 ? String(Math.round(numeric / 100) * 100) : "";
}

function normaliseTextAlign(value = "") {
  const align = String(value || "").trim().toLowerCase();
  return ["left", "center", "right", "justify"].includes(align) ? align : "";
}

function mergeSupportedStyle(target, styleText = "") {
  String(styleText || "").split(";").forEach((declaration) => {
    const separator = declaration.indexOf(":");
    if (separator < 1) return;
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const value = declaration.slice(separator + 1).trim();
    if (property === "font-size" && !target.fontSize) target.fontSize = normaliseFontSize(value);
    if (property === "color" && !target.color) target.color = safeCssColor(value);
    if (property === "font-weight" && !target.fontWeight) target.fontWeight = normaliseFontWeight(value);
    if (property === "text-align" && !target.textAlign) target.textAlign = normaliseTextAlign(value);
  });
}

const ALLOWED_HEADING_TAGS = new Set(["span", "strong", "b", "em", "i", "u", "br"]);

function stripTagsWithContent(value = "", tagName = "") {
  return String(value || "").replace(new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}>`, "gi"), "");
}

function extractSupportedStyleAndText(html = "") {
  let sanitized = stripTagsWithContent(html, "script");
  sanitized = stripTagsWithContent(sanitized, "style");

  const supportedStyle = {};
  const tagRe = /<([a-z][a-z0-9]*)\b([^>]*)>/gi;
  let match;
  while ((match = tagRe.exec(sanitized))) {
    if (!ALLOWED_HEADING_TAGS.has(match[1].toLowerCase())) continue;
    const styleMatch = (match[2] || "").match(/\sstyle\s*=\s*"([^"]*)"/i) || (match[2] || "").match(/\sstyle\s*=\s*'([^']*)'/i);
    if (styleMatch) mergeSupportedStyle(supportedStyle, styleMatch[1]);
  }

  const text = sanitized.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return { text, supportedStyle };
}

export function normalizeAccordionHeading(value = "", fallbacks = {}) {
  const decoded = decodeStoredHeadingHtml(value);
  const { text, supportedStyle } = extractSupportedStyleAndText(decoded);

  return {
    text,
    style: {
      ...(fallbacks.fontSize ? { fontSize: fallbacks.fontSize } : {}),
      ...(fallbacks.color ? { color: fallbacks.color } : {}),
      ...(fallbacks.fontWeight ? { fontWeight: fallbacks.fontWeight } : {}),
      ...(fallbacks.textAlign ? { textAlign: fallbacks.textAlign } : {}),
      ...Object.fromEntries(Object.entries(supportedStyle).filter(([, styleValue]) => styleValue)),
    },
  };
}
