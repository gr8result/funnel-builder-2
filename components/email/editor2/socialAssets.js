import { toAbsoluteUrl } from "./editorUtils.js";

const SOCIAL_ICONS = {
  facebook:  "/email-assets/social/facebook.svg",
  instagram: "/email-assets/social/instagram.svg",
  linkedin:  "/email-assets/social/linkedin.svg",
  x:         "/email-assets/social/x.svg",
  youtube:   "/email-assets/social/youtube.svg",
  pinterest: "/email-assets/social/pinterest.svg",
};

const SOCIAL_EMAIL_ICONS = {
  facebook:  "/email-assets/social/facebook.png",
  instagram: "/email-assets/social/instagram.png",
  linkedin:  "/email-assets/social/linkedin.png",
  x:         "/email-assets/social/x.png",
  youtube:   "/email-assets/social/youtube.png",
  pinterest: "/email-assets/social/pinterest.png",
};

const SOCIAL_ICON_SVG = {
  facebook: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-label="Facebook"><rect width="24" height="24" rx="4" fill="#1877F2"/><path fill="#fff" d="M14.5 8.7V7.2c0-.7.4-1.2 1.2-1.2H17V3h-2.4C12.4 3 11 4.5 11 6.8v1.9H9v3h2V21h3.3v-9.3H17l.5-3h-3z"/></svg>',
  instagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-label="Instagram"><defs><linearGradient id="ig" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f58529"/><stop offset="0.35" stop-color="#dd2a7b"/><stop offset="0.7" stop-color="#8134af"/><stop offset="1" stop-color="#515bd4"/></linearGradient></defs><rect width="24" height="24" rx="6" fill="url(#ig)"/><rect x="6.5" y="6.5" width="11" height="11" rx="3" fill="none" stroke="#fff" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="none" stroke="#fff" stroke-width="2"/><circle cx="16.8" cy="7.8" r="1.1" fill="#fff"/></svg>',
  linkedin: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-label="LinkedIn"><rect width="24" height="24" rx="4" fill="#0A66C2"/><circle cx="7" cy="8" r="1.5" fill="#fff"/><rect x="5.75" y="10" width="2.5" height="8" fill="#fff"/><path fill="#fff" d="M10.5 10h2.4v1.1h.03c.34-.64 1.17-1.31 2.42-1.31 2.6 0 3.08 1.71 3.08 3.93V18H16v-3.73c0-.89-.02-2.03-1.24-2.03-1.24 0-1.43.97-1.43 1.97V18H10.5z"/></svg>',
  x: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-label="X"><rect width="24" height="24" rx="4" fill="#111111"/><path fill="#fff" d="M14.1 10.3 19.3 4h-1.2l-4.5 5.5L10 4H4l5.5 8-5.5 6.7h1.2l4.9-5.9 4.1 5.9H20zM10.7 12l-.5-.7L6 5.2h2.7l3.4 4.9.5.7 4.4 6.3h-2.7z"/></svg>',
  youtube: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-label="YouTube"><rect width="24" height="24" rx="5" fill="#FF0033"/><path fill="#fff" d="M17.8 8.7a2 2 0 0 0-1.4-1.4C15.2 7 12 7 12 7s-3.2 0-4.4.3a2 2 0 0 0-1.4 1.4C6 9.9 6 12 6 12s0 2.1.2 3.3a2 2 0 0 0 1.4 1.4C8.8 17 12 17 12 17s3.2 0 4.4-.3a2 2 0 0 0 1.4-1.4C18 14.1 18 12 18 12s0-2.1-.2-3.3"/><path fill="#fff" d="m10.5 14.6 4.2-2.6-4.2-2.6z"/></svg>',
  pinterest: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-label="Pinterest"><rect width="24" height="24" rx="5" fill="#E60023"/><path fill="#fff" d="M12.3 5C8.6 5 7 7.6 7 9.8c0 1.4.5 2.7 1.6 3.2.2.1.3 0 .4-.2l.2-.9c.1-.2 0-.3-.1-.5-.3-.4-.5-.9-.5-1.6 0-2 1.5-3.8 4-3.8 2.2 0 3.4 1.3 3.4 3.1 0 2.3-1 4.3-2.5 4.3-.8 0-1.4-.7-1.2-1.5.2-1 .7-2.2.7-3 0-.7-.4-1.3-1.2-1.3-.9 0-1.6 1-1.6 2.3 0 .8.3 1.4.3 1.4l-1.1 4.7c-.3 1.1 0 2.5.1 2.6.1.1.2 0 .2-.1.1-.2 1.1-1.4 1.4-2.8l.4-1.6c.2.4 1 .8 1.8.8 2.3 0 3.9-2.1 3.9-4.9C18 7 15.7 5 12.3 5"/></svg>',
};

function svgToDataUri(svg = "") {
  return `data:image/svg+xml;utf8,${encodeURIComponent(String(svg || ""))}`;
}

const SOCIAL_ICON_ALIASES = {
  fb: "facebook",
  facebookicon: "facebook",
  insta: "instagram",
  ig: "instagram",
  linkedincompany: "linkedin",
  linkedinicon: "linkedin",
  twitter: "x",
  tweet: "x",
  xcom: "x",
  yt: "youtube",
  youTube: "youtube",
  pin: "pinterest",
};

const SOCIAL_BADGES = {
  facebook: { label: "f", bg: "#1877f2", color: "#ffffff", fontSize: 18 },
  instagram: { label: "IG", bg: "#e1306c", color: "#ffffff", fontSize: 16 },
  linkedin: { label: "in", bg: "#0a66c2", color: "#ffffff", fontSize: 16 },
  x: { label: "X", bg: "#111111", color: "#ffffff", fontSize: 16 },
  youtube: { label: ">", bg: "#ff0033", color: "#ffffff", fontSize: 16 },
  pinterest: { label: "P", bg: "#e60023", color: "#ffffff", fontSize: 16 },
};

export const SOCIAL_ICON_SIZE = 48;

function getSocialIconPath(name = "") {
  const normalized = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const key = SOCIAL_ICON_ALIASES[normalized] || (normalized === "twitter" ? "x" : normalized);
  return SOCIAL_ICONS[key] || "";
}

export function getSocialIconUrl(name = "") {
  const normalized = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const key = SOCIAL_ICON_ALIASES[normalized] || (normalized === "twitter" ? "x" : normalized);
  const inlineSvg = SOCIAL_ICON_SVG[key];
  if (inlineSvg) return svgToDataUri(inlineSvg);
  return toAbsoluteUrl(getSocialIconPath(name));
}

export function getSocialIconExportUrl(name = "") {
  const normalized = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const key = SOCIAL_ICON_ALIASES[normalized] || (normalized === "twitter" ? "x" : normalized);
  return toAbsoluteUrl(SOCIAL_EMAIL_ICONS[key] || getSocialIconPath(name));
}

export function toEmailAssetUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^(blob:)/i.test(raw)) return "";
  if (/^data:/i.test(raw)) return raw;
  return toAbsoluteUrl(raw);
}

export function isEmailRenderableUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return false;
  if (/^data:image\//i.test(raw)) return true;
  if (/^https?:\/\//i.test(raw)) return true;
  return false;
}

function normalizeSocialPlatformName(name = "") {
  const normalized = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return SOCIAL_ICON_ALIASES[normalized] || (normalized === "twitter" ? "x" : normalized);
}

export function getSocialBadge(name = "") {
  return SOCIAL_BADGES[normalizeSocialPlatformName(name)] || { label: String(name || "?").slice(0, 2).toUpperCase(), bg: "#475569", color: "#ffffff", fontSize: 16 };
}
