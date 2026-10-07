/**
 * Guards the persisted website document against image-reference corruption.
 *
 * Background: Project Hub lost 26 Media Library references when placeholder URLs
 * were written into the canonical draft. Fallback/placeholder values must never be
 * persisted into saved block data - they are display-time concerns only.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SITE_ROOT = path.join(ROOT, "website-builder-sites");

/** Values that must never appear in a persisted image field. */
const FORBIDDEN = [
  { label: "placeholder URL", re: /https?:\/\/(?:www\.)?(?:placehold\.co|placeholder\.com|via\.placeholder\.com)\//i },
  { label: "blob/file URL", re: /^(?:blob:|file:)/i },
  { label: "localhost URL", re: /^https?:\/\/(?:localhost|127\.0\.0\.1)[:/]/i },
  { label: "'Image unavailable' text", re: /image unavailable/i },
];

/**
 * Placeholders a user deliberately kept. Each entry must be justified - this list
 * is intentionally explicit so an accidental regression cannot hide inside it.
 */
const ALLOWED_PLACEHOLDERS = new Set([
  // Project Hub hero mockup: placeholder in the published snapshot too, no original exists.
  "project-hub::ph3-hero::/props/floatingImage",
]);

const IMAGE_KEYS = new Set([
  "image", "imageUrl", "imageSrc", "image_url", "src", "avatar", "avatarUrl", "photo",
  "photoUrl", "backgroundImage", "backgroundImageUrl", "cardImage", "mediaImage",
  "mediaUrl", "assetUrl", "logo", "logoUrl", "iconImage", "iconUrl", "thumbnail",
  "poster", "desktopImage", "mobileImage", "floatingImage", "leftImage", "rightImage",
]);

function pageFiles() {
  const out = [];
  if (!fs.existsSync(SITE_ROOT)) return out;
  for (const user of fs.readdirSync(SITE_ROOT)) {
    const userDir = path.join(SITE_ROOT, user);
    if (!fs.statSync(userDir).isDirectory()) continue;
    for (const project of fs.readdirSync(userDir)) {
      const pagesDir = path.join(userDir, project, "pages");
      if (!fs.existsSync(pagesDir)) continue;
      for (const f of fs.readdirSync(pagesDir)) {
        if (f.endsWith(".json")) out.push({ slug: f.replace(/\.json$/, ""), file: path.join(pagesDir, f) });
      }
    }
  }
  return out;
}

function walk(node, blockId, slug, visit, trail = "") {
  if (Array.isArray(node)) {
    node.forEach((v, i) => walk(v, blockId, slug, visit, `${trail}[${i}]`));
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node)) {
    const at = `${trail}/${k}`;
    if (typeof v === "string" && IMAGE_KEYS.has(k)) visit(k, v, at);
    else walk(v, blockId, slug, visit, at);
  }
}

const pages = pageFiles();
assert.ok(pages.length > 0, "expected at least one persisted website page");

const violations = [];
let scanned = 0;

for (const { slug, file } of pages) {
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const block of doc.blocks || []) {
    const blockId = String(block?.id || "");
    walk(block, blockId, slug, (key, value, at) => {
      scanned += 1;
      for (const { label, re } of FORBIDDEN) {
        if (!re.test(value)) continue;
        const token = `${slug}::${blockId}::${at}`;
        if (ALLOWED_PLACEHOLDERS.has(token)) return;
        violations.push(`${label} persisted at ${token} -> ${value.slice(0, 110)}`);
      }
    });
  }
}

if (violations.length) {
  console.error(`\n${violations.length} forbidden image reference(s) persisted:\n`);
  for (const v of violations) console.error("  - " + v);
  assert.fail(`${violations.length} forbidden image reference(s) found in the persisted website document`);
}

// Project Hub must retain the Media Library references restored from the published snapshot.
const hub = pages.find((p) => p.slug === "project-hub");
if (hub) {
  const raw = fs.readFileSync(hub.file, "utf8");
  const assetRefs = (raw.match(/supabase\.co\/storage\/v1\/object\/public\/assets\//g) || []).length;
  assert.ok(
    assetRefs >= 20,
    `Project Hub should retain its restored Media Library assets (found ${assetRefs}, expected >= 20)`
  );
}

console.log(`Website image reference integrity checks passed (${scanned} image fields across ${pages.length} pages).`);
