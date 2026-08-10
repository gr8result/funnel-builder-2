import assert from "node:assert/strict";
import dotenv from "dotenv";

import publishApi from "../pages/api/websites/publish.js";
import { createSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { loadFullSplitWebsiteProject, saveSplitWebsiteProject } from "../lib/website-builder/supabaseSiteStorage.js";
import { getPublishedWebsiteBySlug } from "../lib/website-builder/publicationStore.js";

dotenv.config({ path: ".env.local" });

const PROJECT_ID = "2208a52a-8175-477e-823c-fc6de7fe4afe";
const USER_ID = "35ab846e-0764-498b-b1f8-7d2cf27d85a5";
const TOKEN = "diagnostic-local-token";
const MARKER_ONE = "LIVE-PUBLISH-TEST-20260810";
const MARKER_TWO = "LIVE-PUBLISH-TEST-SECOND-20260810";
const MARKER_PATTERN = /\s*LIVE-PUBLISH-TEST(?:-SECOND)?-20260810\s*/g;

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function containsMarker(project, marker) {
  return JSON.stringify(project || {}).includes(marker);
}

function getTargetBlockText(project, target) {
  const blocks = Array.isArray(project?.pageBlocks?.[target.pageName])
    ? project.pageBlocks[target.pageName]
    : [];
  const byId = target.blockId
    ? blocks.find((entry) => String(entry?.id || "") === target.blockId)
    : null;
  const fallback = Number.isInteger(target.index) ? blocks[target.index] : null;
  const block = byId || fallback;
  return String(block?.props?.text || "");
}

function pageIdFromProject(project, pageName) {
  const pages = Array.isArray(project?.pages) ? project.pages : [];
  const page = pages.find((entry) => entry?.name === pageName);
  return page?.id || page?.slug || "";
}

function findEditableTextBlock(project) {
  const pageBlocks = project?.pageBlocks && typeof project.pageBlocks === "object"
    ? project.pageBlocks
    : {};
  for (const [pageName, blocks] of Object.entries(pageBlocks)) {
    const safeBlocks = Array.isArray(blocks) ? blocks : [];
    for (let index = 0; index < safeBlocks.length; index += 1) {
      const block = safeBlocks[index];
      if (String(block?.type || "") !== "text") continue;
      const text = String(block?.props?.text || "");
      if (!text.trim()) continue;
      return {
        pageName,
        index,
        blockId: String(block?.id || ""),
        originalText: text,
      };
    }
  }
  throw new Error("Could not find a non-empty text block to run publish pipeline marker tests.");
}

function updateTextBlock(project, target, nextText) {
  const nextProject = clone(project);
  const blocks = Array.isArray(nextProject?.pageBlocks?.[target.pageName])
    ? nextProject.pageBlocks[target.pageName]
    : null;
  if (!blocks) throw new Error(`Page ${target.pageName} has no block collection.`);

  let block = null;
  if (target.blockId) {
    block = blocks.find((entry) => String(entry?.id || "") === target.blockId) || null;
  }
  if (!block && Number.isInteger(target.index)) {
    block = blocks[target.index] || null;
  }
  if (!block) throw new Error(`Target text block not found on page ${target.pageName}.`);
  if (String(block?.type || "") !== "text") {
    throw new Error(`Target block on page ${target.pageName} is no longer a text block.`);
  }

  block.props = {
    ...(block.props || {}),
    text: nextText,
  };

  return nextProject;
}

async function invokeApi(handler, { method, query = {}, body = {}, headers = {} }) {
  const req = {
    method,
    query,
    body,
    headers,
  };

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
    end(payload) {
      this.body = payload;
      return this;
    },
  };

  await handler(req, response);
  return response;
}

function logStage({ source, projectId, pageName, pageId, updatedAt, version, marker, markerPresent }) {
  console.log(JSON.stringify({
    source,
    projectId,
    pageName,
    pageId,
    updatedAt: updatedAt || "",
    version: version || "",
    marker,
    markerPresent: markerPresent ? "YES" : "NO",
  }));
}

async function saveProject(nextProject, pageName) {
  const savedProject = await saveSplitWebsiteProject(USER_ID, nextProject, {
    pageName,
    backupSource: "manual-save",
  });
  return savedProject;
}

async function publishProject(project, slug) {
  const response = await invokeApi(publishApi, {
    method: "POST",
    headers: {
      authorization: `Bearer ${TOKEN}`,
    },
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
}

async function getLatestPublishedRow(admin, projectId) {
  const result = await admin
    .from("published_websites")
    .select("id, project_id, slug, site_data, updated_at, published_at")
    .eq("project_id", projectId)
    .eq("published", true)
    .order("published_at", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) throw new Error(`Could not read published_websites row: ${result.error.message || result.error}`);
  return result.data || null;
}

async function runRound({ marker, nextText, target, slug, admin }) {
  const currentDraft = await loadFullSplitWebsiteProject(USER_ID, PROJECT_ID);
  assert.ok(currentDraft, "Expected a canonical draft project row in split storage before save.");

  const projectForSave = updateTextBlock(currentDraft, target, nextText);
  const savedProject = await saveProject(projectForSave, target.pageName);

  const savedReadback = await loadFullSplitWebsiteProject(USER_ID, PROJECT_ID);
  assert.ok(savedReadback, "Expected canonical split-storage readback after save.");
  assert.equal(getTargetBlockText(savedReadback, target).includes(marker), true, `Saved canonical draft is missing marker ${marker}`);

  const savePageId = pageIdFromProject(savedReadback, target.pageName);
  logStage({
    source: "SAVE readback: website_builder_sites + website_builder_pages",
    projectId: PROJECT_ID,
    pageName: target.pageName,
    pageId: savePageId,
    updatedAt: savedReadback?.updatedAt || savedProject?.updatedAt || "",
    version: savedReadback?.projectVersion || savedProject?.projectVersion || "",
    marker,
    markerPresent: getTargetBlockText(savedReadback, target).includes(marker),
  });

  const publishPayload = await publishProject(savedReadback, slug);
  const publishedRow = await getLatestPublishedRow(admin, PROJECT_ID);
  assert.ok(publishedRow, "Expected published_websites row after publish.");
  assert.equal(getTargetBlockText(publishedRow.site_data, target).includes(marker), true, `Published snapshot is missing marker ${marker}`);

  logStage({
    source: "PUBLISH readback: published_websites.site_data",
    projectId: PROJECT_ID,
    pageName: target.pageName,
    pageId: savePageId,
    updatedAt: publishedRow?.updated_at || "",
    version: publishedRow?.site_data?.publishedVersion || publishPayload?.publication?.publishedVersion || "",
    marker,
    markerPresent: getTargetBlockText(publishedRow.site_data, target).includes(marker),
  });

  const livePublication = await getPublishedWebsiteBySlug(slug);
  assert.ok(livePublication, `Expected live publication resolver to return a row for slug ${slug}.`);
  assert.equal(getTargetBlockText(livePublication.site_data, target).includes(marker), true, `Live resolver payload is missing marker ${marker}`);

  logStage({
    source: "LIVE read: /sites/[...slug] resolver (getPublishedWebsiteBySlug)",
    projectId: PROJECT_ID,
    pageName: target.pageName,
    pageId: savePageId,
    updatedAt: livePublication?.updated_at || "",
    version: livePublication?.site_data?.publishedVersion || "",
    marker,
    markerPresent: getTargetBlockText(livePublication.site_data, target).includes(marker),
  });

  return {
    savedReadback,
    publishedRow,
    livePublication,
  };
}

async function main() {
  const admin = createSupabaseAdmin();
  const originalGetUser = admin.auth.getUser.bind(admin.auth);
  admin.auth.getUser = async () => ({ data: { user: { id: USER_ID } }, error: null });

  try {
    const baselineProject = await loadFullSplitWebsiteProject(USER_ID, PROJECT_ID);
    assert.ok(baselineProject, "Expected canonical split draft project to exist.");

    const target = findEditableTextBlock(baselineProject);
    const slug = slugify(
      baselineProject?.slug
      || baselineProject?.publication?.slug
      || baselineProject?.name
      || PROJECT_ID
    );
    assert.ok(slug, "Expected a publishable slug.");

    const baselineLive = await getPublishedWebsiteBySlug(slug);
    const baselineLiveHasMarkerOne = containsMarker(baselineLive?.site_data, MARKER_ONE);
    const baselineLiveHasMarkerTwo = containsMarker(baselineLive?.site_data, MARKER_TWO);

    console.log(JSON.stringify({
      source: "BASELINE",
      projectId: PROJECT_ID,
      pageName: target.pageName,
      pageId: pageIdFromProject(baselineProject, target.pageName),
      slug,
      baselineMarkerOne: baselineLiveHasMarkerOne ? "YES" : "NO",
      baselineMarkerTwo: baselineLiveHasMarkerTwo ? "YES" : "NO",
    }));

    const cleanOriginalText = String(target.originalText || "").replace(MARKER_PATTERN, " ").replace(/\s{3,}/g, " ").trim();
    const firstText = `${cleanOriginalText}\n\n${MARKER_ONE}`;
    const secondText = `${cleanOriginalText}\n\n${MARKER_TWO}`;

    const roundOne = await runRound({
      marker: MARKER_ONE,
      nextText: firstText,
      target,
      slug,
      admin,
    });

    assert.equal(getTargetBlockText(roundOne.livePublication?.site_data, target).includes(MARKER_ONE), true, "Live payload must contain first marker after first save/publish.");

    const roundTwo = await runRound({
      marker: MARKER_TWO,
      nextText: secondText,
      target,
      slug,
      admin,
    });

    assert.equal(getTargetBlockText(roundTwo.livePublication?.site_data, target).includes(MARKER_TWO), true, "Live payload must contain second marker after second save/publish.");
    assert.equal(getTargetBlockText(roundTwo.livePublication?.site_data, target).includes(MARKER_ONE), false, "Live payload must not contain first marker after second marker publish.");

    const restoreRound = await runRound({
      marker: cleanOriginalText,
      nextText: cleanOriginalText,
      target,
      slug,
      admin,
    });

    assert.equal(getTargetBlockText(restoreRound.livePublication?.site_data, target).includes(MARKER_ONE), false, "Live payload must not contain first marker after restore.");
    assert.equal(getTargetBlockText(restoreRound.livePublication?.site_data, target).includes(MARKER_TWO), false, "Live payload must not contain second marker after restore.");

    console.log("Website save -> publish -> live pipeline runtime marker test passed.");
  } finally {
    admin.auth.getUser = originalGetUser;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
