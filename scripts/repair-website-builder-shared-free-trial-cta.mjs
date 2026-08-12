import "dotenv/config";
import assert from "node:assert/strict";

import publishApi from "../pages/api/websites/publish.js";
import { createSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { getPublishedWebsiteBySlug } from "../lib/website-builder/publicationStore.js";
import { loadFullSplitWebsiteProject, saveSplitWebsiteProject } from "../lib/website-builder/supabaseSiteStorage.js";
import { slugifyWebsiteValue } from "../lib/website-builder/publishConfig.js";
import {
  SHARED_FREE_TRIAL_CTA_ID,
  SHARED_FREE_TRIAL_CTA_NAME,
  buildSharedBlockTemplate,
  getSharedBlockTemplateUsage,
  normalizeSharedBlockTemplateProject,
  resolveCtaOpenInNewTab,
  resolveSharedBlockInstance,
} from "../lib/website-builder/sharedBlockTemplates.js";

const PROJECT_ID = "2208a52a-8175-477e-823c-fc6de7fe4afe";
const USER_ID = "35ab846e-0764-498b-b1f8-7d2cf27d85a5";
const EXPECTED_TEXT = "Click Here To Start Your 14 Day Free Trial";
const EXPECTED_URL = "https://app.gr8result.digital/login";
const CURRENT_SITE_OPEN_IN_NEW_TAB = true;

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

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
    props.ctaText,
    props.ctaLabel,
    props.link,
    props.href,
    props.ctaLink,
    props.ctaHref,
    props.buttonLink,
  ].map(htmlToText).join(" ").toLowerCase();
}

function isFreeTrialCta(block = {}) {
  if (String(block?.type || "") !== "cta-button") return false;
  const sharedTemplateId = String(block.sharedTemplateId || block.props?.sharedTemplateId || "").trim();
  if (sharedTemplateId === SHARED_FREE_TRIAL_CTA_ID) return true;
  const text = blockIntentText(block);
  if (!text) return false;
  const hasExpectedHeading = text.includes("ready to see what your business could become");
  const hasExpectedLabel = text.includes("click here to start your 14 day free trial")
    || text.includes("click here to start your 14-day free trial");
  const hasExpectedUrl = text.includes(EXPECTED_URL.toLowerCase());
  const hasTrialIntent = text.includes("14 day free trial") || text.includes("14-day free trial");
  const excludesOtherIntent = !text.includes("book a demo") && !text.includes("contact us") && !text.includes("talk to us");
  return excludesOtherIntent && (hasExpectedHeading || hasExpectedLabel || hasExpectedUrl || hasTrialIntent);
}

function linkedInstanceFrom(block = {}) {
  return {
    id: block?.id || "shared-free-trial-cta",
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
    text: htmlToText(props.text || props.buttonLabel || props.buttonText || props.ctaText || props.ctaLabel || ""),
    link: props.link || props.href || props.ctaLink || props.ctaHref || props.buttonLink || "",
    sharedTemplateId: String(block?.sharedTemplateId || props.sharedTemplateId || "").trim(),
    openInNewTab: resolveCtaOpenInNewTab(props),
  };
}

function collectMatchingCtas(project = {}) {
  const matches = [];
  for (const [pageName, blocks] of Object.entries(project.pageBlocks || {})) {
    (Array.isArray(blocks) ? blocks : []).forEach((block, index) => {
      if (isFreeTrialCta(block)) matches.push({ pageName, index, block: clone(block), summary: summarizeBlock(pageName, block, index) });
    });
  }
  return matches;
}

function resolveCurrentOpenInNewTab(sourceTemplate = null, matches = []) {
  const templateProps = sourceTemplate?.blockData?.props || {};
  if (Object.prototype.hasOwnProperty.call(templateProps, "openInNewTab")) return resolveCtaOpenInNewTab(templateProps);
  if (Object.prototype.hasOwnProperty.call(templateProps, "newTab")) return resolveCtaOpenInNewTab(templateProps);
  if (Object.prototype.hasOwnProperty.call(templateProps, "targetBlank")) return resolveCtaOpenInNewTab(templateProps);
  const firstWithExplicitValue = matches.find((entry) => {
    const props = entry.block?.props || {};
    return ["openInNewTab", "newTab", "targetBlank"].some((key) => Object.prototype.hasOwnProperty.call(props, key));
  });
  return firstWithExplicitValue ? resolveCtaOpenInNewTab(firstWithExplicitValue.block.props) : CURRENT_SITE_OPEN_IN_NEW_TAB;
}

async function invokeApi(handler, { method, body = {}, headers = {} }) {
  const req = { method, body, headers, query: {} };
  const response = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  await handler(req, response);
  return response;
}

function resolveSlug(project = {}) {
  return slugifyWebsiteValue(project.slug || project.publication?.slug || project.name || PROJECT_ID);
}

function normalizeFreeTrialTemplate(sourceTemplate = null, matches = []) {
  const openInNewTab = resolveCurrentOpenInNewTab(sourceTemplate, matches);
  const sourceBlockData = sourceTemplate?.blockData && typeof sourceTemplate.blockData === "object"
    ? clone(sourceTemplate.blockData)
    : { id: "canonical-free-trial-cta", type: "cta-button", props: {} };

  sourceBlockData.id = sourceBlockData.id || "canonical-free-trial-cta";
  sourceBlockData.type = "cta-button";
  sourceBlockData.props = {
    ...(sourceBlockData.props || {}),
    text: EXPECTED_TEXT,
    buttonLabel: EXPECTED_TEXT,
    link: EXPECTED_URL,
    href: EXPECTED_URL,
    linkType: "external",
    openInNewTab,
    newTab: openInNewTab,
    targetBlank: openInNewTab,
  };

  return buildSharedBlockTemplate({
    id: SHARED_FREE_TRIAL_CTA_ID,
    name: SHARED_FREE_TRIAL_CTA_NAME,
    blockType: "cta-button",
    blockData: sourceBlockData,
    updatedAt: new Date().toISOString(),
  });
}

function hydrateLinkedCtaFallback(block, template) {
  if (!block || typeof block !== "object") return block;
  if (!isFreeTrialCta(block)) return block;

  return linkedInstanceFrom(block);
}

function hydrateLinkedCtaFallbacks(project, template) {
  const pageBlocks = Object.fromEntries(
    Object.entries(project.pageBlocks || {}).map(([pageName, blocks]) => [
      pageName,
      Array.isArray(blocks) ? blocks.map((block) => hydrateLinkedCtaFallback(block, template)) : blocks,
    ])
  );
  const chaiData = Object.fromEntries(
    Object.entries(project.chaiData || {}).map(([pageName, data]) => [
      pageName,
      data && typeof data === "object" && Array.isArray(data.blocks)
        ? { ...data, blocks: data.blocks.map((block) => hydrateLinkedCtaFallback(block, template)) }
        : data,
    ])
  );
  return { ...project, pageBlocks, chaiData };
}

function assertSharedCta(project, source, expectedCount = null) {
  const usage = getSharedBlockTemplateUsage(project, SHARED_FREE_TRIAL_CTA_ID);
  assert.ok(usage.length > 0, `${source}: expected linked shared CTA usage`);
  if (expectedCount !== null) assert.equal(usage.length, expectedCount, `${source}: linked shared CTA count`);

  for (const entry of usage) {
    const rawBlock = project.pageBlocks?.[entry.pageName]?.[entry.index];
    const resolved = resolveSharedBlockInstance(rawBlock, project);
    assert.equal(resolved?.props?.text, EXPECTED_TEXT, `${source} ${entry.pageName}: CTA text`);
    assert.equal(resolved?.props?.link, EXPECTED_URL, `${source} ${entry.pageName}: CTA URL`);
    assert.equal(resolved?.props?.openInNewTab, CURRENT_SITE_OPEN_IN_NEW_TAB, `${source} ${entry.pageName}: openInNewTab`);
  }

  return usage;
}

async function publishProject(admin, project, slug) {
  const originalGetUser = admin.auth.getUser.bind(admin.auth);
  admin.auth.getUser = async () => ({ data: { user: { id: USER_ID } }, error: null });
  try {
    const response = await invokeApi(publishApi, {
      method: "POST",
      headers: { authorization: "Bearer diagnostic-local-token" },
      body: {
        slug,
        project: {
          id: project.id,
          name: project.name,
          slug,
          customDomain: project.customDomain || project.custom_domain || project.publication?.customDomain || "",
          primaryDomain: project.primaryDomain || project.primary_domain || project.publication?.primaryDomain || "",
        },
      },
    });
    if (response.statusCode !== 200 || !response.body?.ok) {
      throw new Error(`Publish failed: HTTP ${response.statusCode} ${response.body?.error || "Unknown error"}`);
    }
    return response.body;
  } finally {
    admin.auth.getUser = originalGetUser;
  }
}

async function main() {
  const admin = createSupabaseAdmin();
  const draft = await loadFullSplitWebsiteProject(USER_ID, PROJECT_ID);
  assert.ok(draft, `Expected draft project ${PROJECT_ID}`);

  const slug = resolveSlug(draft);
  const published = await getPublishedWebsiteBySlug(slug);
  const publishedTemplate = published?.site_data?.sharedBlockTemplates?.[SHARED_FREE_TRIAL_CTA_ID] || null;
  const matches = collectMatchingCtas(draft);
  const canonicalTemplate = normalizeFreeTrialTemplate(
    draft.sharedBlockTemplates?.[SHARED_FREE_TRIAL_CTA_ID] || publishedTemplate,
    matches
  );
  const repaired = normalizeSharedBlockTemplateProject({
    ...hydrateLinkedCtaFallbacks(draft, canonicalTemplate),
    sharedBlockTemplates: {
      ...(draft.sharedBlockTemplates || {}),
      [SHARED_FREE_TRIAL_CTA_ID]: canonicalTemplate,
    },
  });

  const draftUsage = assertSharedCta(repaired, "repaired draft payload", matches.length || null);
  const saved = await saveSplitWebsiteProject(USER_ID, repaired, {
    backupSource: "shared-cta-regression-repair",
    backupReason: "Restore missing canonical shared free trial CTA template",
  });
  const savedUsage = assertSharedCta(saved, "saved draft readback", matches.length || null);
  const publishPayload = await publishProject(admin, saved, slug);
  const live = await getPublishedWebsiteBySlug(slug);
  const liveUsage = assertSharedCta(live?.site_data || {}, "published/live readback", matches.length || null);

  console.log(JSON.stringify({
    ok: true,
    projectId: PROJECT_ID,
    slug,
    sharedTemplateId: SHARED_FREE_TRIAL_CTA_ID,
    expectedText: EXPECTED_TEXT,
    expectedUrl: EXPECTED_URL,
    expectedOpenInNewTab: CURRENT_SITE_OPEN_IN_NEW_TAB,
    matchedCount: matches.length,
    matches: matches.map((entry) => entry.summary),
    draftUsageCount: draftUsage.length,
    savedUsageCount: savedUsage.length,
    liveUsageCount: liveUsage.length,
    publicationVersion: publishPayload?.publication?.publishedVersion || "",
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
