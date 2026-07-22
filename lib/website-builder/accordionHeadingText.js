import DOMPurify from "isomorphic-dompurify";

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

function walkSanitisedNodes(node, supportedStyle) {
  if (!node) return;
  if (typeof node.getAttribute === "function") {
    mergeSupportedStyle(supportedStyle, node.getAttribute("style") || "");
  }
  const children = node.childNodes || [];
  for (let index = 0; index < children.length; index += 1) {
    walkSanitisedNodes(children[index], supportedStyle);
  }
}

export function normalizeAccordionHeading(value = "", fallbacks = {}) {
  const decoded = decodeStoredHeadingHtml(value);
  const fragment = DOMPurify.sanitize(decoded, {
    RETURN_DOM_FRAGMENT: true,
    ALLOWED_TAGS: ["span", "strong", "b", "em", "i", "u", "br"],
    ALLOWED_ATTR: ["style"],
  });
  const supportedStyle = {};
  walkSanitisedNodes(fragment, supportedStyle);
  const text = String(fragment?.textContent || "")
    .replace(/\s+/g, " ")
    .trim();

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
