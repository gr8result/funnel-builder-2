import fs from "fs";
import path from "path";

const PUBLIC_ROOT = path.join(process.cwd(), "public");
const SOCIAL_ROOT = path.join(PUBLIC_ROOT, "email-assets", "social");
const CUSTOM_ICON_LIBRARY_ROOT = path.join(PUBLIC_ROOT, "vendor", "elementor-icons");
const IMAGE_EXTENSIONS = /\.(svg|png|jpe?g|webp|gif|ico)$/i;
const CUSTOM_LIBRARY_CONFIGS = [
  {
    slug: "webexbaseicon",
    label: "Nextech Base Icons",
    fontFamily: "webexbaseicon",
    classPrefix: "base-icon-",
    cssPath: path.join(CUSTOM_ICON_LIBRARY_ROOT, "webexbaseicon", "style.css"),
  },
  {
    slug: "webexthemeicon",
    label: "Nextech Theme Icons",
    fontFamily: "webexthemeicon",
    classPrefix: "webextheme-icon-",
    cssPath: path.join(CUSTOM_ICON_LIBRARY_ROOT, "webexthemeicon", "style.css"),
  },
  {
    slug: "dticon",
    label: "DethemeKit - Icons",
    fontFamily: "dticon",
    classPrefix: "dticon-",
    cssPath: path.join(CUSTOM_ICON_LIBRARY_ROOT, "dticon", "style.css"),
  },
];

function toPosix(value) {
  return String(value || "").replace(/\\/g, "/");
}

function toHref(absolutePath) {
  const relative = toPosix(path.relative(PUBLIC_ROOT, absolutePath));
  return relative.startsWith("/") ? relative : `/${relative}`;
}

function formatLabel(fileName) {
  return String(fileName || "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || "Icon";
}

function formatTokenLabel(token) {
  return String(token || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || "Icon";
}

function listSocialIcons() {
  let entries = [];
  try {
    entries = fs.readdirSync(SOCIAL_ROOT, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.test(entry.name))
    .map((entry) => {
      const absolutePath = path.join(SOCIAL_ROOT, entry.name);
      return {
        key: `social-${entry.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        label: formatLabel(entry.name),
        library: "Social Files",
        group: "Social Files",
        src: toHref(absolutePath),
      };
    });
}

function listCustomFontIcons() {
  return CUSTOM_LIBRARY_CONFIGS.flatMap((config) => {
    let css = "";
    try {
      css = fs.readFileSync(config.cssPath, "utf8");
    } catch {
      return [];
    }

    const pattern = new RegExp(`\\.(${config.classPrefix}[a-zA-Z0-9_-]+):before\\s*\\{\\s*content:\\s*"\\\\([a-fA-F0-9]+)";`, "g");
    const entries = [];
    const seen = new Set();
    let match;
    while ((match = pattern.exec(css))) {
      const className = String(match[1] || "");
      const codePoint = Number.parseInt(String(match[2] || ""), 16);
      if (!className || Number.isNaN(codePoint) || seen.has(className)) continue;
      seen.add(className);
      const token = className.replace(config.classPrefix, "");
      entries.push({
        key: `font-${config.slug}-${className}`,
        label: formatTokenLabel(token),
        library: config.label,
        group: config.label,
        fontFamily: config.fontFamily,
        glyph: String.fromCodePoint(codePoint),
      });
    }

    return entries.sort((left, right) => left.label.localeCompare(right.label));
  });
}

export default function handler(req, res) {
  try {
    const entries = [...listCustomFontIcons(), ...listSocialIcons()];
    const seen = new Set();
    const deduped = entries
      .filter((entry) => {
        const key = String(entry?.src || entry?.key || "");
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((left, right) => `${left.library || left.group} ${left.label}`.localeCompare(`${right.library || right.group} ${right.label}`));

    res.status(200).json({ entries: deduped });
  } catch (error) {
    console.error("Icon library discovery failed:", error);
    res.status(200).json({ entries: [] });
  }
}