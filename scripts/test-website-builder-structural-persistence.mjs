import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";

// Default: transport + real filesystem round trips. Opt in to isolated Supabase rows
// with WB_PERSISTENCE_DB=1. No existing draft or publication is ever written.
const database = process.env.WB_PERSISTENCE_DB === "1";
if (database) dotenv.config({ path: ".env.local", quiet: true });
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "wb-persistence-"));
process.env.WEBSITE_BUILDER_SITES_DIR = path.join(temporary, "sites");
process.env.WEBSITE_BUILDER_BACKUPS_DIR = path.join(temporary, "backups");
const id = `fixture-persistence-${crypto.randomUUID()}`;
const userId = process.env.WB_PERSISTENCE_USER_ID || "35ab846e-0764-498b-b1f8-7d2cf27d85a5";
process.env.WEBSITE_LOCK_PROTECTED_PROJECT_IDS = id;
const { normalizeProjectBlocksForSave, compareProjectPersistenceForSave } = await import("../pages/api/website-builder/projects.js");
const { saveWebsiteProjectToServer } = await import("../lib/website-builder/remoteProjects.js");
const { canonicalWebsitePersistencePayload, websitePersistenceHash } = await import("../lib/website-builder/documentVersion.js");
const fileStorage = await import("../lib/website-builder/siteStorage.js");
const names = ["Home", "SMS", "Email", "Website Builder"];
const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";
const clone = (value) => JSON.parse(JSON.stringify(value));
const makeBlocks = (name) => [
  ...["feature-accordion", "side-scroll-accordion", "scroll-stack"].map((type, index) => ({
    id: `${name}-${type}`, type,
    props: {
      title: `${name} ${type}`, imageScale: 88,
      panels: [{ id: "panel-one", title: "Nested panel", imageUrl: "https://example.com/panel.png", responsive: { mobile: { imageScale: 62 } }, blocks: [{ id: "nested-text", type: "text", props: { text: "nested content", custom: { keep: [0, false, null, { image }] } } }] }],
      items: [{ id: "item-one", title: "Nested item", imageUrl: "https://example.com/item.png", children: [{ id: "deep", props: { style: { color: "#123456" }, children: [{ text: "preserve me" }] } }] }],
      responsive: { tablet: { padding: 24 }, mobile: { padding: 12, hidden: false } },
      customSettings: { index, futureField: { values: [1, 2, 3] } },
    },
  })),
  { id: `${name}-image`, type: "image", props: { src: image, imageAssetId: "embedded-image", style: { borderRadius: 16 } } },
  { id: `${name}-text`, type: "text", props: { text: `<p>${name} content</p>` } },
];
let project = normalizeProjectBlocksForSave({
  id, name: "Structural persistence fixture", slug: id, customDomain: `${id}.invalid`, primaryDomain: `${id}.invalid`,
  globalPageWidthMode: "full", containedWidth: 1370, responsiveSettings: { mobile: { breakpoint: 640 } },
  pages: names.map((name, order) => ({ id: name.toLowerCase().replaceAll(" ", "-"), name, slug: name.toLowerCase().replaceAll(" ", "-"), order, pageWidthMode: "full", seo: { title: name }, custom: { retain: true } })),
  pageBlocks: Object.fromEntries(names.map(name => [name, makeBlocks(name)])),
  pagesContent: Object.fromEntries(names.map(name => [name, `<section>${name} retained HTML</section>`])),
  chaiData: Object.fromEntries(names.map(name => [name, { theme: { primaryColor: "#112233" }, customNested: { retain: [true, false] } }])),
  brandAssets: { images: [{ id: "embedded-image", src: image }], videos: [], logo: null },
  globalNavBlock: { id: "global-nav", type: "nav-bar", props: { links: names.map(name => ({ label: name, href: `/${name.toLowerCase().replaceAll(" ", "-")}` })), navLinksManual: true, customResponsive: { mobile: { collapse: true } } } },
  globalFooterBlock: { id: "global-footer", type: "footer", props: { showNewsletter: false, customNested: { retain: true }, linkGroups: [{ id: "custom-links", heading: "Links", links: [{ label: "SMS", href: "/sms" }] }] } },
});
// Exercise JSONB beyond a megabyte without relying on a giant block count.
project.pageBlocks.SMS[0].props.panels[0].largeNestedPayload = "structural-data-".repeat(Number(process.env.WB_PERSISTENCE_STRESS_REPEATS || 75000));
project.chaiData.SMS.blocks = project.pageBlocks.SMS;
assert.equal(websitePersistenceHash(project), websitePersistenceHash(clone(project)), "optional undefined footer fields follow JSON serialization");
const originalFetch = globalThis.fetch;
let restoreAuth = () => {};
let db;
const logs = [];
const originalInfo = console.info;
console.info = (...args) => logs.push(args);
function sameContent(expected, actual, label) {
  assert.deepEqual(clone(canonicalWebsitePersistencePayload(actual)), clone(canonicalWebsitePersistencePayload(expected)), label);
  assert.equal(actual.globalPageWidthMode, expected.globalPageWidthMode, label + " global layout");
  assert.deepEqual(actual.responsiveSettings, expected.responsiveSettings, label + " responsive settings");
}
async function invoke(handler, body, method = "POST") {
  const response = { statusCode: 200, setHeader() {}, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
  await handler({ method, headers: { authorization: "Bearer fixture-token" }, query: {}, body }, response);
  return response;
}
try {
  // Capture the actual client serialization: unscoped saves used to drop every page.
  let transported;
  globalThis.fetch = async (_url, options) => {
    transported = JSON.parse(options.body);
    return new Response(JSON.stringify({ ok: true, project: transported.project }), { status: 200 });
  };
  await saveWebsiteProjectToServer("fixture-token", project);
  sameContent(project, transported.project, "full-project client transport");
  await saveWebsiteProjectToServer("fixture-token", project, { pageName: "SMS" });
  assert.deepEqual(Object.keys(transported.project.pageBlocks), ["SMS"]);
  assert.deepEqual(transported.project.pageBlocks.SMS, project.pageBlocks.SMS, "embedded and nested images survive transport");
  assert.deepEqual(transported.project.brandAssets, project.brandAssets);
  globalThis.fetch = originalFetch;

  const localSaved = await fileStorage.saveSplitWebsiteProject(userId, project);
  sameContent(project, localSaved, "filesystem full save returns every page");
  sameContent(project, await fileStorage.loadFullSplitWebsiteProject(userId, id), "filesystem reload");
  const localSiteSave = await fileStorage.saveSplitWebsiteProject(userId, { ...project, name: "Updated" }, { siteOnly: true });
  sameContent(project, localSiteSave, "filesystem site-only save retains every page");
  const damaged = clone(project);
  damaged.pageBlocks.SMS[0].props.panels[0].blocks = [];
  assert.equal(compareProjectPersistenceForSave(project, damaged, "SMS").ok, false, "verification must detect actual nested loss");
  console.log("PASS: full/scoped client transport, inline images, filesystem full/site-only read-back, and negative nested-loss verification");

  if (database) {
    ({ supabaseAdmin: db } = await import("../lib/supabaseAdmin.js"));
    const originalGetUser = db.auth.getUser;
    // Only authentication is stubbed; storage and publication use real Supabase queries.
    db.auth.getUser = async () => ({ data: { user: { id: userId } }, error: null });
    restoreAuth = () => { db.auth.getUser = originalGetUser; };
    const { default: saveApi } = await import("../pages/api/website-builder/projects.js");
    const { default: publishApi } = await import("../pages/api/websites/publish.js");
    const { loadFullSplitWebsiteProject } = await import("../lib/website-builder/supabaseSiteStorage.js");
    const { createWebsiteUnlockSession, relockWebsite, getWebsiteLockStatus } = await import("../lib/website-builder/contentLock.js");
    let unlock = createWebsiteUnlockSession({ userId, projectId: id, confirmation: "UNLOCK" });
    assert.ok(unlock.ok);
    const save = async (submitted, pageName = "", siteOnly = false) => {
      const response = await invoke(saveApi, { project: submitted, pageName, siteOnly, saveSource: "manual-save", unlockToken: unlock.token });
      assert.equal(response.statusCode, 200, JSON.stringify(response.body?.verification?.persistence?.diffs || response.body));
      assert.equal(response.body.verification.ok, true);
      assert.equal(response.body.verification.persistence.ok, true);
      return response.body.project;
    };
    const unsaved = await invoke(publishApi, { project: { ...project, id: `${id}-unsaved` }, slug: id, customDomain: `${id}.invalid`, unlockToken: unlock.token });
    assert.equal(unsaved.statusCode, 409, "publishing must require a durable draft");
    const saved = await save(project);
    sameContent(project, saved, "API full-project database read-back");
    project = saved;
    for (const pageName of ["SMS", "Email", "Website Builder"]) {
      const expected = clone(project);
      expected.pageBlocks[pageName][0].props.panels[0].blocks[0].props.text = `latest ${pageName} nested edit`;
      expected.chaiData[pageName].blocks = expected.pageBlocks[pageName];
      // Scoped client payload deliberately excludes all other page maps.
      const scoped = { ...expected, pageBlocks: { [pageName]: expected.pageBlocks[pageName] }, pagesContent: { [pageName]: expected.pagesContent[pageName] }, chaiData: { [pageName]: expected.chaiData[pageName] } };
      project = await save(scoped, pageName);
      const reloaded = await loadFullSplitWebsiteProject(userId, id);
      sameContent(expected, reloaded, `${pageName} actual database reload`);
      const raw = await db.from("website_builder_pages").select("blocks,chai_data,html").eq("user_id", userId).eq("site_id", id).eq("name", pageName).single();
      assert.ifError(raw.error);
      assert.deepEqual(raw.data.blocks, expected.pageBlocks[pageName], `${pageName} exact database JSONB`);
      assert.deepEqual(raw.data.chai_data, expected.chaiData[pageName]);
      assert.equal(raw.data.html, expected.pagesContent[pageName]);
      console.log(`PASS: ${pageName} feature/side-scroll/scroll-stack nested props, images, styles and real database verification`);
    }
    const staleSave = await invoke(saveApi, { project, pageName: "SMS", saveSource: "manual-save", unlockToken: unlock.token, baseRevision: 1 });
    assert.equal(staleSave.statusCode, 409, "old revisions must still be rejected");
    sameContent(project, await loadFullSplitWebsiteProject(userId, id), "rejected stale save leaves content intact");
    const siteOnly = { ...project, name: "Site-only update" };
    delete siteOnly.pageBlocks; delete siteOnly.pagesContent; delete siteOnly.chaiData; delete siteOnly.brandAssets;
    const siteSaved = await save(siteOnly, "", true);
    sameContent(project, siteSaved, "site-only save preserves omitted content/assets");
    project = siteSaved;
    relockWebsite(id, unlock.token);
    assert.equal(getWebsiteLockStatus(id).locked, true);
    console.log("PASS: Save and Lock persistence and relock");
    unlock = createWebsiteUnlockSession({ userId, projectId: id, confirmation: "UNLOCK" });
    const stale = clone(project);
    stale.name = "Stale website name";
    stale.pageBlocks.SMS = [];
    stale.globalNavBlock.props.stale = true;
    stale.brandAssets.images[0].src = "https://example.com/stale-image.png";
    globalThis.fetch = (url, options) => new URL(String(url)).hostname === `${id}.invalid`
      ? Promise.resolve(new Response("Isolated fixture: no live HTTP host", { status: 404 }))
      : originalFetch(url, options);
    for (let publishIndex = 0; publishIndex < 2; publishIndex++) {
      if (publishIndex) {
        unlock = createWebsiteUnlockSession({ userId, projectId: id, confirmation: "UNLOCK" });
        const updated = clone(project);
        updated.pageBlocks.SMS[0].props.panels[0].blocks[0].props.text = "newest update before republish";
        updated.chaiData.SMS.blocks = updated.pageBlocks.SMS;
        project = await save(updated, "SMS");
      }
      const result = await invoke(publishApi, { project: stale, slug: id, customDomain: `${id}.invalid`, unlockToken: unlock.token });
      assert.equal(result.statusCode, 200, JSON.stringify(result.body));
      const published = await db.from("published_websites").select("site_data").eq("user_id", userId).eq("project_id", id).single();
      assert.ifError(published.error);
      sameContent(project, published.data.site_data, "published site_data uses current persisted project, not stale request");
      assert.equal(published.data.site_data.name, project.name, "published name uses latest saved project");
      console.log(`PASS: ${publishIndex ? "Update Published Site" : "initial publish"} exact database site_data comparison`);
    }
  } else {
    console.log("Database scenarios not run; set WB_PERSISTENCE_DB=1 to test isolated Supabase save/publish rows.");
  }
} finally {
  globalThis.fetch = originalFetch;
  restoreAuth();
  console.info = originalInfo;
  if (db) {
    assert.ok(id.startsWith("fixture-persistence-"));
    for (const table of ["published_websites", "website_builder_page_versions", "website_builder_pages", "website_builder_sites"]) {
      const result = await db.from(table).delete().eq("user_id", userId).eq(table === "published_websites" ? "project_id" : "site_id", id);
      assert.ifError(result.error);
    }
  }
  assert.ok(path.basename(temporary).startsWith("wb-persistence-"));
  await fs.rm(temporary, { recursive: true, force: true });
}
