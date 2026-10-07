import fs from "fs";
import path from "path";
import { withAuth } from "../../../lib/withWorkspace";

// Every path below is spelled out in full on purpose. Next.js output file tracing
// packages whatever directory a path.join(process.cwd(), ...) expression resolves to,
// so a shared "public" or "vendor/elementor-icons" root constant pulls the whole of
// public/ (700+ MB) into this serverless function and breaks the Vercel deploy.
const SOCIAL_ROOT = path.join(process.cwd(), "public", "email-assets", "social");
const SOCIAL_HREF_BASE = "/email-assets/social";
const IMAGE_EXTENSIONS = /\.(svg|png|jpe?g|webp|gif|ico)$/i;
const CUSTOM_LIBRARY_CONFIGS = [
  {
    slug: "webexbaseicon",
    label: "Nextech Base Icons",
    fontFamily: "webexbaseicon",
    classPrefix: "base-icon-",
    cssPath: path.join(process.cwd(), "public", "vendor", "elementor-icons", "webexbaseicon", "style.css"),
  },
  {
    slug: "webexthemeicon",
    label: "Nextech Theme Icons",
    fontFamily: "webexthemeicon",
    classPrefix: "webextheme-icon-",
    cssPath: path.join(process.cwd(), "public", "vendor", "elementor-icons", "webexthemeicon", "style.css"),
  },
  {
    slug: "dticon",
    label: "DethemeKit - Icons",
    fontFamily: "dticon",
    classPrefix: "dticon-",
    cssPath: path.join(process.cwd(), "public", "vendor", "elementor-icons", "dticon", "style.css"),
  },
];

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
    .map((entry) => ({
      key: `social-${entry.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      label: formatLabel(entry.name),
      library: "Social Files",
      group: "Social Files",
      src: `${SOCIAL_HREF_BASE}/${entry.name}`,
    }));
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

async function handler(req, res) {
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

export default withAuth(handler);
