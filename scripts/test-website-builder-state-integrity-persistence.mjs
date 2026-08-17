import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

dotenv.config({ path: ".env.local", quiet: true });

const PROJECT_ID = "2208a52a-8175-477e-823c-fc6de7fe4afe";
const OWNER_EMAIL = "support@gr8result.com";
const PAGE_NAME = "Pricing";
const SWITCH_PAGE_NAME = "Home";
const BASE_URL = (process.env.WB_BROWSER_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const OUT_DIR = path.join(process.cwd(), "test-results", "website-builder-state-integrity-persistence");
const TEXT_MARKER = `WB-STATE-TEXT-${Date.now()}`;

fs.mkdirSync(OUT_DIR, { recursive: true });

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function builderUrl(pageName = PAGE_NAME) {
  return `${BASE_URL}/modules/website-builder/visual-builder?projectId=${encodeURIComponent(PROJECT_ID)}&page=${encodeURIComponent(pageName)}&name=Gr8%20Result%20Digital%20Solutions`;
}

function getSupabaseStorageKey() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const host = new URL(url).hostname;
  return `sb-${host.split(".")[0]}-auth-token`;
}

async function mintSession() {
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: OWNER_EMAIL });
  if (error) throw error;

  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error: verifyError } = await client.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (verifyError) throw verifyError;
  assert.ok(data?.session?.access_token, "Expected Supabase session");
  return data.session;
}

function findReviewsBlock(blocks = []) {
  return (Array.isArray(blocks) ? blocks : []).find((block) => (
    block?.type === "testimonial"
    && /talking|review|reference|testimonial|platform/i.test(String(block?.props?.title || block?.props?.heading || ""))
  )) || null;
}

function itemId(item, index = 0) {
  return String(item?.id || item?.author || item?.name || index);
}

function imageUrl(item = {}) {
  return String(item.avatarUrl || item.avatar || item.imageUrl || item.image || item.src || item.url || "").trim();
}

function readPageBlocks(project, pageName = PAGE_NAME) {
  return Array.isArray(project?.pageBlocks?.[pageName]) ? project.pageBlocks[pageName] : [];
}

function readChaiBlocks(project, pageName = PAGE_NAME) {
  return Array.isArray(project?.chaiData?.[pageName]?.blocks) ? project.chaiData[pageName].blocks : [];
}

function summarize(blocks) {
  const block = findReviewsBlock(blocks);
  const items = Array.isArray(block?.props?.items) ? block.props.items : [];
  return {
    blockId: block?.id || "",
    itemCount: items.length,
    items: items.map((item, index) => ({
      index,
      id: itemId(item, index),
      author: item.author || item.name || "",
      text: item.text || item.quote || "",
      image: imageUrl(item),
      avatarRemoved: item.avatarRemoved === true,
    })),
  };
}

function assertItemAbsent(project, removedId, label) {
  const pageItems = summarize(readPageBlocks(project)).items;
  const chaiItems = summarize(readChaiBlocks(project)).items;
  assert.equal(pageItems.some((item) => item.id === removedId), false, `${label}: deleted item resurrected in pageBlocks`);
  assert.equal(chaiItems.some((item) => item.id === removedId), false, `${label}: deleted item resurrected in chaiData.blocks`);
}

function assertFirstAvatarEmpty(project, label) {
  const first = summarize(readPageBlocks(project)).items[0];
  const firstChai = summarize(readChaiBlocks(project)).items[0];
  assert.ok(first, `${label}: expected first review item`);
  assert.equal(first.image, "", `${label}: explicit avatar removal must persist in pageBlocks`);
  assert.equal(firstChai.image, "", `${label}: explicit avatar removal must persist in chaiData.blocks`);
}

function mutateDeletedNestedItem(project, pageName, removedId) {
  const next = clone(project);
  const staleBlocks = clone(readPageBlocks(next, pageName));
  const blocks = readPageBlocks(next, pageName);
  const block = findReviewsBlock(blocks);
  assert.ok(block, "Expected reviews block for nested-item deletion");
  block.props.items = block.props.items.filter((item, index) => itemId(item, index) !== removedId);
  next.chaiData = {
    ...(next.chaiData || {}),
    [pageName]: {
      ...(next.chaiData?.[pageName] || {}),
      blocks: staleBlocks,
    },
  };
  return next;
}

function mutateExplicitAvatarRemoval(project, pageName) {
  const next = clone(project);
  const blocks = readPageBlocks(next, pageName);
  const block = findReviewsBlock(blocks);
  assert.ok(block, "Expected reviews block for avatar removal");
  assert.ok(Array.isArray(block.props.items) && block.props.items[0], "Expected first review item");
  block.props.items[0] = {
    ...block.props.items[0],
    avatarUrl: "",
    avatar: "",
    avatarAssetId: "",
    avatarRemoved: true,
    __removedMediaFields: ["avatarUrl", "avatar"],
  };
  next.chaiData = {
    ...(next.chaiData || {}),
    [pageName]: {
      ...(next.chaiData?.[pageName] || {}),
      blocks: clone(blocks),
    },
  };
  return next;
}

function mutateBlankAvatarTextEdit(project, pageName, marker) {
  const next = clone(project);
  const blocks = readPageBlocks(next, pageName);
  const block = findReviewsBlock(blocks);
  assert.ok(block, "Expected reviews block for text edit");
  block.props.items = block.props.items.map((item, index) => index === 0
    ? {
        ...item,
        text: `${String(item.text || item.quote || "").replace(/\s*WB-STATE-TEXT-\d+/g, "").trim()} ${marker}`,
        avatarUrl: "",
        avatar: "",
        imageUrl: "",
        image: "",
        src: "",
        url: "",
      }
    : item);
  next.chaiData = {
    ...(next.chaiData || {}),
    [pageName]: {
      ...(next.chaiData?.[pageName] || {}),
      blocks: clone(blocks),
    },
  };
  return next;
}

function withOriginalPageContent(latestProject, originalProject, pageName) {
  const originalBlocks = clone(readPageBlocks(originalProject, pageName));
  const originalChaiPage = originalProject?.chaiData?.[pageName] || {};
  return {
    ...clone(latestProject),
    pageBlocks: {
      ...(latestProject?.pageBlocks || {}),
      [pageName]: originalBlocks,
    },
    chaiData: {
      ...(latestProject?.chaiData || {}),
      [pageName]: {
        ...(originalChaiPage && typeof originalChaiPage === "object" && !Array.isArray(originalChaiPage) ? originalChaiPage : {}),
        blocks: clone(originalBlocks),
      },
    },
  };
}

async function restoreOriginalPage(page, originalProject, pageName = PAGE_NAME) {
  const latest = await fetchProject(page, pageName);
  if (latest.status !== 200) {
    throw new Error(`Could not fetch latest project before restore: HTTP ${latest.status}`);
  }
  const payload = withOriginalPageContent(latest.body.project, originalProject, pageName);
  const save = await postProject(page, payload, pageName, "manual-save");
  if (save.status !== 200) {
    throw new Error(`Restore failed: HTTP ${save.status} ${save.body?.error || ""}`);
  }
  return save;
}

async function waitForBuilder(page, pageName = PAGE_NAME) {
  await page.goto(builderUrl(pageName), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => !!window.__websiteBuilderRegressionApi?.getSnapshot?.(), { timeout: 60000 });
  await page.waitForFunction((projectId) => window.__websiteBuilderRegressionApi.getSnapshot().project?.id === projectId, { timeout: 60000 }, PROJECT_ID);
  await page.waitForFunction(() => window.__websiteBuilderRegressionApi.getSnapshot().hasSession === true, { timeout: 60000 });
  await page.evaluate((name) => window.__websiteBuilderRegressionApi.setActivePage(name), pageName);
  await page.waitForFunction((name) => window.__websiteBuilderRegressionApi.getSnapshot().resolvedPageName === name, { timeout: 30000 }, pageName);
}

async function fetchProject(page, pageName = PAGE_NAME) {
  return page.evaluate(async ({ projectId, pageName }) => {
    const storageKey = Object.keys(localStorage).find((key) => /^sb-.+-auth-token$/.test(key));
    const session = storageKey ? JSON.parse(localStorage.getItem(storageKey) || "null") : null;
    const response = await fetch(`/api/website-builder/projects?projectId=${encodeURIComponent(projectId)}&page=${encodeURIComponent(pageName)}`, {
      cache: "no-store",
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    });
    return { status: response.status, body: await response.json() };
  }, { projectId: PROJECT_ID, pageName });
}

async function postProject(page, project, pageName = PAGE_NAME, saveSource = "manual-save") {
  return page.evaluate(async ({ project, pageName, saveSource }) => {
    const storageKey = Object.keys(localStorage).find((key) => /^sb-.+-auth-token$/.test(key));
    const session = storageKey ? JSON.parse(localStorage.getItem(storageKey) || "null") : null;
    const response = await fetch("/api/website-builder/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ project, projectId: project.id, pageName, saveSource }),
    });
    return { status: response.status, body: await response.json() };
  }, { project, pageName, saveSource });
}

async function readSplitPage(admin) {
  const { data, error } = await admin
    .from("website_builder_pages")
    .select("blocks, chai_data, updated_at")
    .eq("site_id", PROJECT_ID)
    .or(`page_id.eq.${PAGE_NAME},slug.eq.pricing,name.eq.${PAGE_NAME}`)
    .single();
  if (error) throw error;
  return data;
}

async function switchAwayAndBack(page) {
  await page.evaluate((name) => window.__websiteBuilderRegressionApi.setActivePage(name), SWITCH_PAGE_NAME);
  await page.waitForFunction((name) => window.__websiteBuilderRegressionApi.getSnapshot().resolvedPageName === name, { timeout: 30000 }, SWITCH_PAGE_NAME);
  await page.evaluate((name) => window.__websiteBuilderRegressionApi.setActivePage(name), PAGE_NAME);
  await page.waitForFunction((name) => window.__websiteBuilderRegressionApi.getSnapshot().resolvedPageName === name, { timeout: 30000 }, PAGE_NAME);
}

async function main() {
  const session = await mintSession();
  const storageKey = getSupabaseStorageKey();
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const summary = { projectId: PROJECT_ID, pageName: PAGE_NAME, stages: {}, saves: {}, checks: {} };
  let originalProject = null;

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    }, { key: storageKey, value: session });
    page.on("console", (message) => {
      if (message.type() === "error") console.log(`[browser:error] ${message.text()}`);
    });

    await waitForBuilder(page);
    const initial = await fetchProject(page);
    assert.equal(initial.status, 200, "initial project GET must be 200");
    originalProject = clone(initial.body.project);
    summary.stages.initialPageBlocks = summarize(readPageBlocks(originalProject));
    summary.stages.initialChaiBlocks = summarize(readChaiBlocks(originalProject));
    assert.ok(summary.stages.initialPageBlocks.itemCount >= 2, "Expected at least two nested review items");

    const removedId = summary.stages.initialPageBlocks.items.at(-1).id;
    const deletePayload = mutateDeletedNestedItem(originalProject, PAGE_NAME, removedId);
    const deleteSave = await postProject(page, deletePayload, PAGE_NAME, "manual-save");
    summary.saves.nestedItemDelete = { status: deleteSave.status, ok: deleteSave.body?.ok, error: deleteSave.body?.error || "" };
    assert.equal(deleteSave.status, 200, `nested item delete save failed: ${deleteSave.body?.error || ""}`);

    let readback = await fetchProject(page);
    assert.equal(readback.status, 200, "delete readback GET must be 200");
    assertItemAbsent(readback.body.project, removedId, "API readback after nested delete");
    const dbAfterDelete = await readSplitPage(admin);
    assert.equal(summarize(dbAfterDelete.blocks).items.some((item) => item.id === removedId), false, "DB blocks resurrected deleted item");
    assert.equal(summarize(dbAfterDelete.chai_data?.blocks).items.some((item) => item.id === removedId), false, "DB chai_data.blocks resurrected deleted item");

    await switchAwayAndBack(page);
    readback = await fetchProject(page);
    assertItemAbsent(readback.body.project, removedId, "page switch after nested delete");
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
    await waitForBuilder(page);
    readback = await fetchProject(page);
    assertItemAbsent(readback.body.project, removedId, "hard refresh after nested delete");
    summary.checks.nestedItemDelete = { removedId, survivesSwitch: true, survivesHardRefresh: true };

    await restoreOriginalPage(page, originalProject, PAGE_NAME);

    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
    await waitForBuilder(page);
    const beforeAvatarRemove = await fetchProject(page);
    const avatarBefore = imageUrl(findReviewsBlock(readPageBlocks(beforeAvatarRemove.body.project))?.props?.items?.[0] || {});
    assert.ok(avatarBefore, "Expected existing avatar before explicit removal");
    const avatarRemovalPayload = mutateExplicitAvatarRemoval(beforeAvatarRemove.body.project, PAGE_NAME);
    const avatarRemoveSave = await postProject(page, avatarRemovalPayload, PAGE_NAME, "manual-save");
    summary.saves.explicitAvatarRemove = { status: avatarRemoveSave.status, ok: avatarRemoveSave.body?.ok, error: avatarRemoveSave.body?.error || "" };
    assert.equal(avatarRemoveSave.status, 200, `explicit avatar remove failed: ${avatarRemoveSave.body?.error || ""}`);
    await switchAwayAndBack(page);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
    await waitForBuilder(page);
    readback = await fetchProject(page);
    assertFirstAvatarEmpty(readback.body.project, "after explicit avatar remove switch/hard refresh");
    summary.checks.explicitAvatarRemove = { avatarBefore, survivesSwitch: true, survivesHardRefresh: true };

    await restoreOriginalPage(page, originalProject, PAGE_NAME);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
    await waitForBuilder(page);

    const beforeTextEdit = await fetchProject(page);
    const expectedAvatar = imageUrl(findReviewsBlock(readPageBlocks(beforeTextEdit.body.project))?.props?.items?.[0] || {});
    const textPayload = mutateBlankAvatarTextEdit(beforeTextEdit.body.project, PAGE_NAME, TEXT_MARKER);
    const textSave = await postProject(page, textPayload, PAGE_NAME, "manual-save");
    summary.saves.blankAvatarTextEdit = { status: textSave.status, ok: textSave.body?.ok, error: textSave.body?.error || "" };
    assert.equal(textSave.status, 200, `blank-avatar text edit failed: ${textSave.body?.error || ""}`);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
    await waitForBuilder(page);
    readback = await fetchProject(page);
    const firstAfterTextEdit = findReviewsBlock(readPageBlocks(readback.body.project))?.props?.items?.[0] || {};
    assert.ok(String(firstAfterTextEdit.text || firstAfterTextEdit.quote || "").includes(TEXT_MARKER), "Text edit marker should persist");
    assert.equal(imageUrl(firstAfterTextEdit), expectedAvatar, "Blank incoming avatar fields during text edit must preserve existing avatar");
    summary.checks.blankAvatarTextEdit = { expectedAvatar, preservedAvatar: imageUrl(firstAfterTextEdit), markerPersisted: true };

    await restoreOriginalPage(page, originalProject, PAGE_NAME);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
    await waitForBuilder(page);
    const finalReadback = await fetchProject(page);
    summary.stages.finalPageBlocks = summarize(readPageBlocks(finalReadback.body.project));
    summary.stages.finalChaiBlocks = summarize(readChaiBlocks(finalReadback.body.project));
    assert.deepEqual(summary.stages.finalPageBlocks.items.map((item) => item.id), summary.stages.initialPageBlocks.items.map((item) => item.id), "Final restore should return original item ids");

    await fs.promises.writeFile(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
    await page.close();
  } finally {
    if (originalProject) {
      try {
        const page = await browser.newPage();
        await page.evaluateOnNewDocument(({ key, value }) => {
          localStorage.setItem(key, JSON.stringify(value));
        }, { key: storageKey, value: session });
        await waitForBuilder(page);
        await restoreOriginalPage(page, originalProject, PAGE_NAME);
        await page.close();
      } catch (error) {
        console.error("Could not restore original Website Builder project after test:", error);
      }
    }
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
