import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { loadFullSplitWebsiteProject, saveSplitWebsiteProject } from "../lib/website-builder/supabaseSiteStorage.js";
import {
  SHARED_FREE_TRIAL_CTA_ID,
  SHARED_FREE_TRIAL_CTA_NAME,
  buildSharedBlockTemplate,
  getSharedBlockTemplateUsage,
  resolveSharedBlockInstance,
  updateSharedBlockTemplateFromBlock,
} from "../lib/website-builder/sharedBlockTemplates.js";

const PROJECT_ID = "2208a52a-8175-477e-823c-fc6de7fe4afe";
const FREE_TRIAL_URL = "https://app.gr8result.digital/login";
const OUT_DIR = path.join(process.cwd(), "tmp", "website-builder-shared-cta-migration");

function htmlToText(value = "") {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function blockIntentText(block = {}) {
  const props = block?.props || {};
  return [
    props.eyebrow,
    props.title,
    props.headline,
    props.description,
    props.subheading,
    props.subheadline,
    props.text,
    props.buttonLabel,
    props.buttonText,
    props.note,
    props.link,
    props.href,
  ].map(htmlToText).join(" ").toLowerCase();
}

function isFreeTrialCta(block = {}) {
  if (String(block?.type || "") !== "cta-button") return false;
  const text = blockIntentText(block);
  if (!text) return false;
  const hasTrial = text.includes("14 day") || text.includes("14-day") || text.includes("free trial");
  const hasGr8Intent = text.includes("ready to see what your business could become")
    || text.includes("start your 14 day free trial")
    || text.includes("start your 14-day free trial")
    || text.includes("start free trial")
    || text.includes("free trial");
  const excludesOtherIntent = !text.includes("book a demo") && !text.includes("contact us") && !text.includes("talk to us");
  return hasTrial && hasGr8Intent && excludesOtherIntent;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function canonicalizeFreeTrialBlock(block = {}) {
  const props = {
    ...(block?.props || {}),
    link: FREE_TRIAL_URL,
    href: FREE_TRIAL_URL,
    linkType: "external",
    openInNewTab: true,
    newTab: true,
  };
  return {
    ...block,
    id: "canonical-free-trial-cta",
    type: "cta-button",
    props,
  };
}

function linkedInstanceFrom(block = {}) {
  return {
    id: block?.id || `shared-free-trial-cta-${Date.now()}`,
    type: "cta-button",
    sharedTemplateId: SHARED_FREE_TRIAL_CTA_ID,
    props: {
      sharedTemplateId: SHARED_FREE_TRIAL_CTA_ID,
      sharedTemplateName: SHARED_FREE_TRIAL_CTA_NAME,
      sharedTemplateType: "shared",
    },
  };
}

function summarizeBlock(pageName, block, index) {
  const props = block?.props || {};
  return {
    pageName,
    index,
    id: block?.id || "",
    type: block?.type || "",
    title: htmlToText(props.title || props.headline || ""),
    description: htmlToText(props.description || props.subheading || props.subheadline || ""),
    text: htmlToText(props.text || props.buttonLabel || props.buttonText || ""),
    link: props.link || props.href || "",
    openInNewTab: !!props.openInNewTab || !!props.newTab || !!props.targetBlank,
  };
}

async function findSiteOwner(siteId) {
  const result = await supabaseAdmin
    .from("website_builder_sites")
    .select("user_id, site_id, name")
    .eq("site_id", siteId)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data?.user_id) throw new Error(`Could not find owner for website_builder_sites.site_id=${siteId}`);
  return result.data;
}

function migrateProject(project) {
  const matches = [];
  const pageBlocks = {};
  for (const [pageName, blocks] of Object.entries(project.pageBlocks || {})) {
    pageBlocks[pageName] = (Array.isArray(blocks) ? blocks : []).map((block, index) => {
      if (!isFreeTrialCta(block)) return block;
      matches.push({ pageName, index, block: clone(block), summary: summarizeBlock(pageName, block, index) });
      return linkedInstanceFrom(block);
    });
  }

  if (!matches.length) {
    return { project, matches, canonicalBlock: null };
  }

  const canonicalBlock = canonicalizeFreeTrialBlock(matches[0].block);
  const sharedTemplate = buildSharedBlockTemplate({
    id: SHARED_FREE_TRIAL_CTA_ID,
    name: SHARED_FREE_TRIAL_CTA_NAME,
    blockType: "cta-button",
    blockData: canonicalBlock,
  });

  const chaiData = { ...(project.chaiData || {}) };
  for (const [pageName, pageData] of Object.entries(chaiData)) {
    if (!pageData || typeof pageData !== "object" || !Array.isArray(pageData.blocks)) continue;
    chaiData[pageName] = {
      ...pageData,
      blocks: pageData.blocks.map((block) => isFreeTrialCta(block) ? linkedInstanceFrom(block) : block),
    };
  }

  return {
    project: {
      ...project,
      pageBlocks,
      chaiData,
      sharedBlockTemplates: {
        ...(project.sharedBlockTemplates || project.sharedTemplates || {}),
        [SHARED_FREE_TRIAL_CTA_ID]: sharedTemplate,
      },
      updatedAt: new Date().toISOString(),
    },
    matches,
    canonicalBlock,
  };
}

function assertMigration(project, expectedCount) {
  const usage = getSharedBlockTemplateUsage(project, SHARED_FREE_TRIAL_CTA_ID);
  assertEqual(usage.length, expectedCount, "linked usage count");
  const resolved = usage.map((entry) => {
    const block = project.pageBlocks?.[entry.pageName]?.[entry.index];
    return { ...entry, block: resolveSharedBlockInstance(block, project) };
  });
  for (const entry of resolved) {
    assertEqual(entry.block.props.link, FREE_TRIAL_URL, `canonical URL on ${entry.pageName}`);
    assertEqual(entry.block.props.openInNewTab, true, `openInNewTab on ${entry.pageName}`);
  }

  const first = resolved[0]?.block;
  const temp = updateSharedBlockTemplateFromBlock(project, SHARED_FREE_TRIAL_CTA_ID, {
    ...first,
    props: { ...first.props, text: "TEMP SHARED CTA LABEL", openInNewTab: false },
  });
  for (const entry of usage) {
    const block = resolveSharedBlockInstance(temp.pageBlocks[entry.pageName][entry.index], temp);
    assertEqual(block.props.text, "TEMP SHARED CTA LABEL", `temporary label on ${entry.pageName}`);
    assertEqual(block.props.openInNewTab, false, `temporary openInNewTab off on ${entry.pageName}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const site = await findSiteOwner(PROJECT_ID);
  const project = await loadFullSplitWebsiteProject(site.user_id, PROJECT_ID);
  if (!project) throw new Error(`Could not load project ${PROJECT_ID}`);

  const { project: migrated, matches, canonicalBlock } = migrateProject(project);
  await fs.mkdir(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const snapshotPath = path.join(OUT_DIR, `${PROJECT_ID}-${stamp}.json`);
  await fs.writeFile(snapshotPath, `${JSON.stringify({
    projectId: PROJECT_ID,
    accountId: site.user_id,
    dryRun,
    matchedCount: matches.length,
    matches: matches.map((entry) => entry.summary),
    canonicalTemplate: canonicalBlock ? {
      sharedTemplateId: SHARED_FREE_TRIAL_CTA_ID,
      templateName: SHARED_FREE_TRIAL_CTA_NAME,
      blockType: "cta-button",
      blockData: canonicalBlock,
    } : null,
    beforeProject: project,
  }, null, 2)}\n`, "utf8");

  if (!matches.length) {
    const usage = getSharedBlockTemplateUsage(project, SHARED_FREE_TRIAL_CTA_ID);
    if (usage.length) assertMigration(project, usage.length);
    console.log(JSON.stringify({
      ok: true,
      dryRun,
      snapshotPath,
      matchedCount: 0,
      sharedTemplateId: SHARED_FREE_TRIAL_CTA_ID,
      templateName: SHARED_FREE_TRIAL_CTA_NAME,
      usage,
      message: usage.length ? "Shared CTA template already migrated and verified" : "No matching CTA blocks found",
    }, null, 2));
    return;
  }

  assertMigration(migrated, matches.length);

  if (!dryRun) {
    await saveSplitWebsiteProject(site.user_id, migrated, {
      backupSource: "shared-free-trial-cta-migration",
      backupReason: "Before converting free trial CTA blocks to shared template",
      loadPageName: "Home",
    });
  }

  const usage = getSharedBlockTemplateUsage(migrated, SHARED_FREE_TRIAL_CTA_ID);
  console.log(JSON.stringify({
    ok: true,
    dryRun,
    projectId: PROJECT_ID,
    accountId: site.user_id,
    snapshotPath,
    sharedTemplateId: SHARED_FREE_TRIAL_CTA_ID,
    templateName: SHARED_FREE_TRIAL_CTA_NAME,
    matchedCount: matches.length,
    matches: matches.map((entry) => entry.summary),
    usage,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
