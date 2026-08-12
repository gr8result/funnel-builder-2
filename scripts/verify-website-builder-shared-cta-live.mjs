import "dotenv/config";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { getPublishedWebsiteBySlug } from "../lib/website-builder/publicationStore.js";
import { loadFullSplitWebsiteProject } from "../lib/website-builder/supabaseSiteStorage.js";
import { generateWebsitePageHtml } from "../lib/website-builder/projectStore.js";
import {
  SHARED_FREE_TRIAL_CTA_ID,
  getSharedBlockTemplateUsage,
  resolveSharedBlockInstance,
} from "../lib/website-builder/sharedBlockTemplates.js";

const PROJECT_ID = "2208a52a-8175-477e-823c-fc6de7fe4afe";
const EXPECTED_URL = "https://app.gr8result.digital/login";

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function slugify(value = "") {
  return String(value || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function findSiteOwner(siteId) {
  const result = await supabaseAdmin
    .from("website_builder_sites")
    .select("user_id, site_id, site_data")
    .eq("site_id", siteId)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data?.user_id) throw new Error(`Could not find site ${siteId}`);
  return result.data;
}

function pageForName(project, pageName) {
  const key = slugify(pageName);
  return (project.pages || []).find((page) => slugify(page.name) === key || slugify(page.slug) === key) || null;
}

function verifyProject(project, source) {
  const usage = getSharedBlockTemplateUsage(project, SHARED_FREE_TRIAL_CTA_ID);
  if (!usage.length) throw new Error(`${source}: no linked shared CTA usage found`);
  for (const entry of usage) {
    const rawBlock = project.pageBlocks?.[entry.pageName]?.[entry.index];
    const block = resolveSharedBlockInstance(rawBlock, project);
    assertEqual(block.props.link, EXPECTED_URL, `${source} ${entry.pageName} URL`);
    assertEqual(block.props.openInNewTab, true, `${source} ${entry.pageName} openInNewTab`);
    const page = pageForName(project, entry.pageName);
    const html = generateWebsitePageHtml(project, page || { name: entry.pageName, slug: slugify(entry.pageName) }, project.pageBlocks?.[entry.pageName] || []);
    if (!html.includes(`href="${EXPECTED_URL}"`)) throw new Error(`${source} ${entry.pageName}: missing rendered href`);
    if (!html.includes('target="_blank" rel="noopener noreferrer"')) throw new Error(`${source} ${entry.pageName}: missing target/rel`);
  }
  return usage;
}

async function main() {
  const site = await findSiteOwner(PROJECT_ID);
  const draft = await loadFullSplitWebsiteProject(site.user_id, PROJECT_ID);
  const draftUsage = verifyProject(draft, "draft/preview");

  const published = await getPublishedWebsiteBySlug(draft.slug || site.site_data?.slug || "gr8-result-digital-solutions");
  if (!published?.site_data) throw new Error("Published website row not found");
  const publishedUsage = verifyProject(published.site_data, "published/live");

  console.log(JSON.stringify({
    ok: true,
    projectId: PROJECT_ID,
    sharedTemplateId: SHARED_FREE_TRIAL_CTA_ID,
    expectedUrl: EXPECTED_URL,
    draftUsageCount: draftUsage.length,
    publishedUsageCount: publishedUsage.length,
    draftUsage,
    publishedUsage,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
