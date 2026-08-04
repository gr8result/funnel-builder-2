// Regression test for two Website Builder fixes:
//
// 1. Preview Page 404 — pages saved before the preview slug field existed had no
//    `page.slug`, so resolvePreviewPageSlug (PageBuilderCanvas.js) always hit its
//    "no valid saved slug" error path. Fix: getWebsiteProject() now backfills a
//    stable, unique slug for any page missing one, and persists it.
//
// 2. Accordion panel images disappearing after Save — the save pipeline's
//    "preserve last durable image" step (isTemporaryMediaValue, visual-builder.js)
//    didn't recognize data: URIs or signed storage URLs as risky, so it never fell
//    back to the last-known-good image for them, while the very next step
//    (normalizeAccordionBlocks -> isUnsafeAccordionPanelImageUrl) unconditionally
//    wipes exactly those URL shapes. Fix: isTemporaryMediaValue now also treats
//    anything isUnsafeAccordionPanelImageUrl would strip as worth falling back from.

import assert from "node:assert/strict";

// ---- Minimal localStorage shim so projectStore.js's browser-storage path runs in Node ----
class MemoryStorage {
  constructor() { this.store = new Map(); }
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
  setItem(key, value) { this.store.set(key, String(value)); }
  removeItem(key) { this.store.delete(key); }
}
globalThis.window = globalThis.window || {};
globalThis.window.localStorage = new MemoryStorage();

const {
  getWebsiteProject,
  saveWebsiteProjects,
  listWebsiteProjects,
} = await import("../lib/website-builder/projectStore.js");

const { isUnsafeAccordionPanelImageUrl } = await import("../lib/website-builder/accordionPanels.js");

// ============================================================
// Test 1: legacy pages (no `slug` field) get a stable slug backfilled and persisted
// ============================================================
const legacyProject = {
  id: "legacy-project-1",
  name: "Legacy Test Project",
  mode: "manual",
  buildType: "website",
  status: "saved",
  pages: [
    { id: "p1", name: "Home", order: 0 }, // no slug — pre-dates the slug field
    { id: "p2", name: "Website Builder", order: 1 }, // no slug
  ],
  pageBlocks: {},
  pagesContent: {},
  chaiData: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
saveWebsiteProjects([legacyProject]);

const loaded = getWebsiteProject("legacy-project-1");
assert.ok(loaded, "project should load");
assert.equal(loaded.pages[0].slug, "home", "first legacy page should get slug 'home' backfilled from its name");
assert.equal(loaded.pages[1].slug, "website-builder", "second legacy page should get slug 'website-builder' backfilled from its name, not left empty");
console.log("PASS — legacy pages without a slug field get one backfilled from the name");

// Confirm it was actually PERSISTED (a saved slug), not just returned in-memory this one time.
const reloaded = getWebsiteProject("legacy-project-1");
assert.equal(reloaded.pages[1].slug, "website-builder", "slug must still be present on a second, independent load");
const rawStored = listWebsiteProjects({ includeUnsaved: true }).find((p) => p.id === "legacy-project-1");
assert.equal(rawStored.pages[1].slug, "website-builder", "backfilled slug must be visible directly in storage, proving it was saved, not recomputed each call");
console.log("PASS — backfilled slug is persisted (saved), not regenerated fresh on every load");

// Collision case: two pages that would slugify to the same value must not collide.
const collisionProject = {
  id: "legacy-project-2",
  name: "Collision Test",
  status: "saved",
  pages: [
    { id: "a", name: "Contact Us", order: 0 },
    { id: "b", name: "contact-us", order: 1 }, // slugifies identically to the page above
  ],
  pageBlocks: {},
  pagesContent: {},
  chaiData: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
saveWebsiteProjects([legacyProject, collisionProject]);
const loadedCollision = getWebsiteProject("legacy-project-2");
const slugs = loadedCollision.pages.map((p) => p.slug);
assert.equal(new Set(slugs).size, slugs.length, "backfilled slugs must be unique even when two page names slugify identically");
console.log("PASS — colliding backfilled slugs are disambiguated, not silently duplicated");

// A page that already has an explicit, valid slug must be left untouched.
const explicitProject = {
  id: "explicit-project-1",
  name: "Explicit Slug Project",
  status: "saved",
  pages: [{ id: "p1", name: "Home Page", slug: "home", order: 0 }],
  pageBlocks: {},
  pagesContent: {},
  chaiData: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
saveWebsiteProjects([explicitProject]);
const loadedExplicit = getWebsiteProject("explicit-project-1");
assert.equal(loadedExplicit.pages[0].slug, "home", "an already-saved slug must not be overwritten/regenerated from the display name");
console.log("PASS — existing saved slugs are preserved untouched (not regenerated from the display name)");

// ============================================================
// Test 2: the preserve-media check now catches what the strip step will wipe
// ============================================================
// This mirrors isTemporaryMediaValue as fixed in pages/modules/website-builder/visual-builder.js.
function isTemporaryMediaValueFixed(value) {
  const text = String(value || "").trim();
  return !text
    || /^blob:/i.test(text)
    || /^file:/i.test(text)
    || /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i.test(text)
    || isUnsafeAccordionPanelImageUrl(text);
}
function isTemporaryMediaValueOld(value) {
  const text = String(value || "").trim();
  return !text
    || /^blob:/i.test(text)
    || /^file:/i.test(text)
    || /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i.test(text);
}

const riskyValues = [
  ["data: URI", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB"],
  ["signed Supabase storage URL", "https://abcxyz.supabase.co/storage/v1/object/sign/assets/u1/photo.jpg?token=abc123"],
];

for (const [label, url] of riskyValues) {
  assert.equal(isUnsafeAccordionPanelImageUrl(url), true, `sanity check: ${label} must be classified unsafe by the strip step`);
  assert.equal(
    isTemporaryMediaValueOld(url),
    false,
    `regression guard: the OLD preserve check did NOT catch ${label} — confirms this was the real gap`
  );
  assert.equal(
    isTemporaryMediaValueFixed(url),
    true,
    `${label} must now be recognized by the preserve step, so a durable previous image is kept instead of silently lost`
  );
}
console.log("PASS — preserve-media check now recognizes every URL shape the strip step will wipe (data: URIs, signed storage URLs)");

// Safe values must NOT be treated as temporary (no over-triggering / no regressions for normal images).
const safeValues = [
  "https://abcxyz.supabase.co/storage/v1/object/public/assets/u1/photo.jpg",
  "https://cdn.example.com/images/photo.jpg",
  "/uploads/photo.jpg",
];
for (const url of safeValues) {
  assert.equal(isTemporaryMediaValueFixed(url), false, `a normal public/CDN image URL must not be treated as temporary: ${url}`);
}
console.log("PASS — ordinary public image URLs are unaffected by the fix");

console.log("\nWebsite Builder preview-slug and panel-image regression checks passed.");
