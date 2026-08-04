import { getAssetFromLibrary } from "./mediaAssets.js";

function safeTrim(value) {
  return String(value || "").trim();
}

function platformAssetBaseUrl() {
  return safeTrim(
    process.env.NEXT_PUBLIC_PLATFORM_APP_URL
    || process.env.NEXT_PUBLIC_BASE_URL
    || "https://app.gr8result.digital"
  ).replace(/\/$/, "");
}

function isAppOwnedPublicAssetPath(pathname = "") {
  return /^\/(?:assets|email-assets|imported)\//i.test(String(pathname || ""));
}

export function normalizeGridSectionImageUrl(value, platformBase = platformAssetBaseUrl()) {
  const raw = safeTrim(value);
  if (!raw || /^(blob:|file:)/i.test(raw)) return "";
  const base = safeTrim(platformBase).replace(/\/$/, "") || "https://app.gr8result.digital";

  if (raw.startsWith("/") && isAppOwnedPublicAssetPath(raw)) {
    return `${base}${raw}`;
  }

  if (!/^https?:\/\//i.test(raw)) return raw;

  try {
    const url = new URL(raw);
    if (!isAppOwnedPublicAssetPath(url.pathname)) return raw;
    const baseUrl = new URL(base);
    if (url.hostname === baseUrl.hostname) return raw;
    return `${base}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return raw;
  }
}

export function resolveGridSectionItemImageUrl(item = {}, assets = null, options = {}) {
  const assetId = item.imageAssetId || item.assetId || item.mediaAssetId || item.cardImageAssetId || "";
  const assetSrc = assetId ? getAssetFromLibrary(assets, assetId)?.src : "";
  const raw = item.image
    || item.imageUrl
    || item.backgroundImage
    || item.src
    || item.mediaUrl
    || item.cardImage
    || assetSrc
    || "";
  return normalizeGridSectionImageUrl(raw, options.platformBase);
}
