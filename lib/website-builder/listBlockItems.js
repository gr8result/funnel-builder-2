import DOMPurify from "isomorphic-dompurify";
import { getAssetFromLibrary } from "./mediaAssets.js";

function decodeEntitiesOnce(value = "") {
  return String(value || "")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
}

export function listItemPlainText(value = "") {
  let decoded = String(value || "").replace(/\u200b/g, "");
  for (let index = 0; index < 3; index += 1) {
    const next = decodeEntitiesOnce(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  const fragment = DOMPurify.sanitize(decoded, {
    RETURN_DOM_FRAGMENT: true,
    ALLOWED_TAGS: ["span", "strong", "b", "em", "i", "u", "br"],
    ALLOWED_ATTR: [],
  });
  return String(fragment?.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
}

function isUnsafeLiveImageUrl(value = "") {
  const url = String(value || "").trim().toLowerCase();
  return url.startsWith("blob:")
    || url.startsWith("file:")
    || url.startsWith("http://localhost:")
    || url.startsWith("https://localhost:")
    || url.startsWith("http://127.0.0.1:")
    || url.startsWith("https://127.0.0.1:");
}

export function resolveListItemImage(item = {}, options = {}) {
  const normalizedItem = options.normalizedItem && typeof options.normalizedItem === "object" ? options.normalizedItem : {};
  const assetId = item?.imageAssetId || item?.assetId || item?.mediaId || normalizedItem?.imageAssetId || normalizedItem?.assetId || "";
  const asset = getAssetFromLibrary(options.assets, assetId);
  const raw = String(
    asset?.src
    || item?.image
    || item?.imageUrl
    || item?.image_url
    || item?.src
    || item?.mediaUrl
    || normalizedItem?.image
    || normalizedItem?.imageUrl
    || ""
  ).trim();
  if (!raw) return "";
  if (!options.editor && isUnsafeLiveImageUrl(raw)) return "";
  if (options.editor || /^(?:https?:|data:)/i.test(raw) || raw.startsWith("//")) return raw;
  if (raw.startsWith("/assets/") || raw.startsWith("/imported/")) {
    const appBaseUrl = String(options.appBaseUrl || "").replace(/\/$/, "");
    return appBaseUrl ? `${appBaseUrl}${raw}` : raw;
  }
  return raw;
}

export function listItemAltText(item = {}, options = {}) {
  const normalizedItem = options.normalizedItem && typeof options.normalizedItem === "object" ? options.normalizedItem : {};
  return listItemPlainText(
    item?.imageAlt
    || item?.altText
    || item?.alt
    || item?.titleHtml
    || item?.title
    || item?.heading
    || item?.label
    || normalizedItem?.imageAlt
    || normalizedItem?.title
    || options.fallback
    || "List item image"
  ) || String(options.fallback || "List item image");
}
