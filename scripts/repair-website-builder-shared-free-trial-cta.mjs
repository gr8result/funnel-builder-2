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
  resolveSharedBlockInstance,
} from "../lib/website-builder/sharedBlockTemplates.js";

const PROJECT_ID = "2208a52a-8175-477e-823c-fc6de7fe4afe";
const USER_ID = "35ab846e-0764-498b-b1f8-7d2cf27d85a5";
const EXPECTED_TEXT = "Click Here To Start Your 14 Day Free Trial";
const EXPECTED_URL = "https://app.gr8result.digital/login";

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
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

function normalizeFreeTrialTemplate(sourceTemplate = null) {
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
    openInNewTab: true,
    newTab: true,
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
  const sharedTemplateId = String(block.sharedTemplateId || block.props?.sharedTemplateId || "").trim();
  if (sharedTemplateId !== SHARED_FREE_TRIAL_CTA_ID) return block;
  if (String(block.type || "") !== "cta-button") return block;

  return {
    ...block,
    sharedTemplateId: SHARED_FREE_TRIAL_CTA_ID,
    props: {
      ...(template.blockData?.props || {}),
      ...(block.props || {}),
      text: EXPECTED_TEXT,
      buttonLabel: EXPECTED_TEXT,
      link: EXPECTED_URL,
      href: EXPECTED_URL,
      linkType: "external",
      openInNewTab: true,
      newTab: true,
      sharedTemplateId: SHARED_FREE_TRIAL_CTA_ID,
      sharedTemplateName: SHARED_FREE_TRIAL_CTA_NAME,
      sharedTemplateType: "shared",
    },
  };
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

function assertSharedCta(project, source) {
  const usage = getSharedBlockTemplateUsage(project, SHARED_FREE_TRIAL_CTA_ID);
  assert.ok(usage.length > 0, `${source}: expected linked shared CTA usage`);

  for (const entry of usage) {
    const rawBlock = project.pageBlocks?.[entry.pageName]?.[entry.index];
    const resolved = resolveSharedBlockInstance(rawBlock, project);
    assert.equal(resolved?.props?.text, EXPECTED_TEXT, `${source} ${entry.pageName}: CTA text`);
    assert.equal(resolved?.props?.link, EXPECTED_URL, `${source} ${entry.pageName}: CTA URL`);
    assert.equal(resolved?.props?.openInNewTab, true, `${source} ${entry.pageName}: openInNewTab`);
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
  const canonicalTemplate = normalizeFreeTrialTemplate(
    draft.sharedBlockTemplates?.[SHARED_FREE_TRIAL_CTA_ID] || publishedTemplate
  );
  const repaired = normalizeSharedBlockTemplateProject({
    ...hydrateLinkedCtaFallbacks(draft, canonicalTemplate),
    sharedBlockTemplates: {
      ...(draft.sharedBlockTemplates || {}),
      [SHARED_FREE_TRIAL_CTA_ID]: canonicalTemplate,
    },
  });

  const draftUsage = assertSharedCta(repaired, "repaired draft payload");
  const saved = await saveSplitWebsiteProject(USER_ID, repaired, {
    backupSource: "shared-cta-regression-repair",
    backupReason: "Restore missing canonical shared free trial CTA template",
  });
  const savedUsage = assertSharedCta(saved, "saved draft readback");
  const publishPayload = await publishProject(admin, saved, slug);
  const live = await getPublishedWebsiteBySlug(slug);
  const liveUsage = assertSharedCta(live?.site_data || {}, "published/live readback");

  console.log(JSON.stringify({
    ok: true,
    projectId: PROJECT_ID,
    slug,
    sharedTemplateId: SHARED_FREE_TRIAL_CTA_ID,
    expectedText: EXPECTED_TEXT,
    expectedUrl: EXPECTED_URL,
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
