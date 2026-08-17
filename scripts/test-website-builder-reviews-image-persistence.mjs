import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

dotenv.config({ path: ".env.local", quiet: true });

const PROJECT_ID = "2208a52a-8175-477e-823c-fc6de7fe4afe";
const OWNER_EMAIL = "support@gr8result.com";
const BASE_URL = (process.env.WB_BROWSER_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const OUT_DIR = path.join(process.cwd(), "test-results", "website-builder-reviews-image-persistence");
const PAGE_NAME = "Pricing";
const SWITCH_PAGE_NAME = "Home";
const TEST_MARKER = `WB-REVIEW-TEXT-${Date.now()}`;

fs.mkdirSync(OUT_DIR, { recursive: true });

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function imageUrl(item = {}) {
  return String(item.avatarUrl || item.avatar || item.imageUrl || item.image || item.src || item.url || "").trim();
}

function isRenderableUrl(value) {
  return /^(https?:|\/|data:image\/)/i.test(String(value || "").trim());
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

function builderUrl(pageName = PAGE_NAME) {
  return `${BASE_URL}/modules/website-builder/visual-builder?projectId=${encodeURIComponent(PROJECT_ID)}&page=${encodeURIComponent(pageName)}&name=Gr8%20Result%20Digital%20Solutions`;
}

function findReviewsBlock(blocks = []) {
  return (Array.isArray(blocks) ? blocks : []).find((block) => (
    block?.type === "testimonial"
    && /talking|review|reference|testimonial|platform/i.test(String(block?.props?.title || block?.props?.heading || ""))
  )) || null;
}

function summarizeReviewsBlock(block, source = "") {
  const items = Array.isArray(block?.props?.items) ? block.props.items : [];
  return {
    source,
    blockId: block?.id || "",
    type: block?.type || "",
    title: block?.props?.title || block?.props?.heading || "",
    items: items.map((item, index) => ({
      index,
      id: item?.id || "",
      author: item?.author || item?.name || "",
      text: item?.text || item?.quote || "",
      avatarUrl: item?.avatarUrl || "",
      avatar: item?.avatar || "",
      imageUrl: item?.imageUrl || "",
      image: item?.image || "",
      src: item?.src || "",
      url: item?.url || "",
      avatarAssetId: item?.avatarAssetId || "",
      resolvedUrl: imageUrl(item),
      renderable: isRenderableUrl(imageUrl(item)),
    })),
  };
}

function assertAllImages(summary, label) {
  assert.ok(summary?.blockId, `${label}: expected reviews/testimonials block`);
  assert.equal(summary.items.length, 4, `${label}: expected four review cards`);
  const missing = summary.items.filter((item) => !item.renderable);
  assert.deepEqual(missing, [], `${label}: every review card must have a renderable image URL`);
}

async function waitForBuilder(page) {
  await page.goto(builderUrl(PAGE_NAME), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => !!window.__websiteBuilderRegressionApi?.getSnapshot?.(), { timeout: 60000 });
  await page.waitForFunction((projectId) => window.__websiteBuilderRegressionApi.getSnapshot().project?.id === projectId, { timeout: 60000 }, PROJECT_ID);
  await page.waitForFunction(() => window.__websiteBuilderRegressionApi.getSnapshot().hasSession === true, { timeout: 60000 });
  await page.evaluate((pageName) => window.__websiteBuilderRegressionApi.setActivePage(pageName), PAGE_NAME);
  await page.waitForFunction((pageName) => window.__websiteBuilderRegressionApi.getSnapshot().resolvedPageName === pageName, { timeout: 30000 }, PAGE_NAME);
}

async function snapshotReviews(page, source) {
  return page.evaluate((source) => {
    const blocks = window.__websiteBuilderRegressionApi.getSnapshot().blocks || [];
    const block = blocks.find((entry) => entry?.type === "testimonial");
    const urlOf = (item = {}) => String(item.avatarUrl || item.avatar || item.imageUrl || item.image || item.src || item.url || "").trim();
    return {
      source,
      blockId: block?.id || "",
      type: block?.type || "",
      title: block?.props?.title || block?.props?.heading || "",
      items: (Array.isArray(block?.props?.items) ? block.props.items : []).map((item, index) => ({
        index,
        id: item?.id || "",
        author: item?.author || item?.name || "",
        text: item?.text || item?.quote || "",
        avatarUrl: item?.avatarUrl || "",
        avatar: item?.avatar || "",
        imageUrl: item?.imageUrl || "",
        image: item?.image || "",
        src: item?.src || "",
        url: item?.url || "",
        avatarAssetId: item?.avatarAssetId || "",
        resolvedUrl: urlOf(item),
        renderable: /^(https?:|\/|data:image\/)/i.test(urlOf(item)),
      })),
    };
  }, source);
}

async function assertDomImages(page, expectedUrls, label) {
  await page.waitForFunction((expectedUrls) => (
    expectedUrls.every((expected) => Array.from(document.images).some((img) => (
      (img.currentSrc || img.src || "") === expected || (img.currentSrc || img.src || "").includes(expected)
    )))
  ), { timeout: 30000 }, expectedUrls);
  await page.evaluate((needle) => {
    const canvas = document.querySelector("[data-builder-canvas='true']");
    const nodes = Array.from(document.querySelectorAll("body *"));
    const target = nodes.find((node) => String(node.textContent || "").includes(needle));
    if (target && canvas) {
      canvas.scrollTop = Math.max(0, target.getBoundingClientRect().top + canvas.scrollTop - canvas.clientHeight / 2);
      return;
    }
    target?.scrollIntoView?.({ block: "center", inline: "nearest" });
  }, "The platform agencies");
  await new Promise((resolve) => setTimeout(resolve, 500));
  const result = await page.evaluate((expectedUrls) => {
    const images = Array.from(document.querySelectorAll("img")).map((img) => ({
      src: img.currentSrc || img.src || "",
      width: img.naturalWidth || img.getBoundingClientRect().width,
      height: img.naturalHeight || img.getBoundingClientRect().height,
      visible: !!(img.offsetWidth || img.offsetHeight || img.getClientRects().length),
    }));
    return expectedUrls.map((expected) => ({
      expected,
      match: images.find((img) => img.src === expected || img.src.includes(expected)) || null,
    }));
  }, expectedUrls);
  const missing = result.filter((entry) => !entry.match?.visible);
  assert.deepEqual(missing, [], `${label}: expected all review images to be visible in DOM`);
  return result;
}

async function assertReviewTextVisible(page, label) {
  await page.waitForFunction(() => {
    const canvas = document.querySelector("[data-builder-canvas]");
    if (canvas) canvas.scrollTop = canvas.scrollHeight;
    return document.body.innerText.includes("David Waite") && document.body.innerText.includes("Josh Rohde");
  }, { timeout: 30000 });
  const result = await page.evaluate(() => {
    const canvas = document.querySelector("[data-builder-canvas]");
    if (canvas) canvas.scrollTop = canvas.scrollHeight;
    return ["David Waite", "Josh Rohde", "Ethan Cooper", "Sarah Reid"].map((text) => ({
      text,
      visible: document.body.innerText.includes(text),
    }));
  });
  const missing = result.filter((entry) => !entry.visible);
  assert.deepEqual(missing, [], `${label}: expected review cards to be visible in builder`);
  return result;
}

async function fetchProject(page, pageName = PAGE_NAME) {
  return page.evaluate(async ({ projectId, pageName }) => {
    const storageKey = Object.keys(localStorage).find((key) => /^sb-.+-auth-token$/.test(key));
    const session = storageKey ? JSON.parse(localStorage.getItem(storageKey) || "null") : null;
    const token = session?.access_token || "";
    const response = await fetch(`/api/website-builder/projects?projectId=${encodeURIComponent(projectId)}&page=${encodeURIComponent(pageName)}`, {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return { status: response.status, body: await response.json() };
  }, { projectId: PROJECT_ID, pageName });
}

async function postProject(page, project, pageName = PAGE_NAME, saveSource = "manual-save") {
  return page.evaluate(async ({ project, pageName, saveSource }) => {
    const storageKey = Object.keys(localStorage).find((key) => /^sb-.+-auth-token$/.test(key));
    const session = storageKey ? JSON.parse(localStorage.getItem(storageKey) || "null") : null;
    const token = session?.access_token || "";
    const response = await fetch("/api/website-builder/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ project, projectId: project.id, pageName, saveSource }),
    });
    return { status: response.status, body: await response.json() };
  }, { project, pageName, saveSource });
}

function blankReviewImagesAndEditText(project, pageName, marker) {
  const next = clone(project);
  const blocks = next.pageBlocks?.[pageName] || [];
  const block = findReviewsBlock(blocks);
  assert.ok(block, "Expected reviews block before stale save");
  const originalTexts = {};
  block.props.items = block.props.items.map((item, index) => {
    originalTexts[item.id || String(index)] = item.text || item.quote || "";
    return {
      ...item,
      text: index === 0 ? `${String(item.text || item.quote || "").replace(/\s*WB-REVIEW-TEXT-\d+/g, "").trim()} ${marker}` : item.text,
      avatarUrl: "",
      avatar: "",
      imageUrl: "",
      image: "",
      src: "",
      url: "",
    };
  });
  next.chaiData = {
    ...(next.chaiData || {}),
    [pageName]: {
      ...(next.chaiData?.[pageName] || {}),
      blocks: clone(blocks),
    },
  };
  return { project: next, originalTexts };
}

function restoreReviewTexts(project, pageName, originalTexts) {
  const next = clone(project);
  const blocks = next.pageBlocks?.[pageName] || [];
  const block = findReviewsBlock(blocks);
  if (block?.props?.items) {
    block.props.items = block.props.items.map((item, index) => ({
      ...item,
      text: originalTexts[item.id || String(index)] ?? item.text,
    }));
  }
  next.chaiData = {
    ...(next.chaiData || {}),
    [pageName]: {
      ...(next.chaiData?.[pageName] || {}),
      blocks: clone(blocks),
    },
  };
  return next;
}

async function main() {
  const session = await mintSession();
  const storageKey = getSupabaseStorageKey();
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const summary = { projectId: PROJECT_ID, pageName: PAGE_NAME, stages: {}, dom: {}, api: {} };

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(({ storageKey, session }) => {
      localStorage.setItem(storageKey, JSON.stringify(session));
    }, { storageKey, session });
    page.on("pageerror", (error) => { throw error; });
    page.on("console", (message) => {
      if (["error"].includes(message.type())) console.log(`[browser:${message.type()}] ${message.text()}`);
    });

    await waitForBuilder(page);
    summary.stages.editorInitial = await snapshotReviews(page, "editor initial");
    assertAllImages(summary.stages.editorInitial, "editor initial");
    const expectedUrls = summary.stages.editorInitial.items.map((item) => item.resolvedUrl);
    summary.dom.editorInitial = await assertReviewTextVisible(page, "editor initial");

    const normalSave = await page.evaluate(({ pageName }) => {
      const snapshot = window.__websiteBuilderRegressionApi.getSnapshot();
      return window.__websiteBuilderRegressionApi.forceSavePageBlocks(pageName, snapshot.blocks);
    }, { pageName: PAGE_NAME });
    assert.ok(normalSave && !normalSave._saveError, "manual save should succeed");

    await page.evaluate((pageName) => window.__websiteBuilderRegressionApi.setActivePage(pageName), SWITCH_PAGE_NAME);
    await page.waitForFunction((pageName) => window.__websiteBuilderRegressionApi.getSnapshot().resolvedPageName === pageName, {}, SWITCH_PAGE_NAME);
    await page.evaluate((pageName) => window.__websiteBuilderRegressionApi.setActivePage(pageName), PAGE_NAME);
    await page.waitForFunction((pageName) => window.__websiteBuilderRegressionApi.getSnapshot().resolvedPageName === pageName, {}, PAGE_NAME);
    summary.stages.afterPageSwitch = await snapshotReviews(page, "after page switch");
    assertAllImages(summary.stages.afterPageSwitch, "after page switch");
    summary.dom.afterPageSwitch = await assertReviewTextVisible(page, "after page switch");

    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => !!window.__websiteBuilderRegressionApi?.getSnapshot?.(), { timeout: 60000 });
    await page.waitForFunction((projectId) => window.__websiteBuilderRegressionApi.getSnapshot().project?.id === projectId, { timeout: 60000 }, PROJECT_ID);
    await page.waitForFunction(() => window.__websiteBuilderRegressionApi.getSnapshot().hasSession === true, { timeout: 60000 });
    await page.evaluate((pageName) => window.__websiteBuilderRegressionApi.setActivePage(pageName), PAGE_NAME);
    await page.waitForFunction((pageName) => window.__websiteBuilderRegressionApi.getSnapshot().resolvedPageName === pageName, { timeout: 30000 }, PAGE_NAME);
    summary.stages.afterHardRefresh = await snapshotReviews(page, "after hard refresh");
    assertAllImages(summary.stages.afterHardRefresh, "after hard refresh");
    summary.dom.afterHardRefresh = await assertReviewTextVisible(page, "after hard refresh");

    await page.close();
    const reopened = await browser.newPage();
    await reopened.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await reopened.evaluateOnNewDocument(({ storageKey, session }) => {
      localStorage.setItem(storageKey, JSON.stringify(session));
    }, { storageKey, session });
    await reopened.goto(builderUrl(PAGE_NAME), { waitUntil: "domcontentloaded", timeout: 60000 });
    await reopened.waitForFunction(() => !!window.__websiteBuilderRegressionApi?.getSnapshot?.(), { timeout: 60000 });
    await reopened.waitForFunction((projectId) => window.__websiteBuilderRegressionApi.getSnapshot().project?.id === projectId, { timeout: 60000 }, PROJECT_ID);
    await reopened.waitForFunction(() => window.__websiteBuilderRegressionApi.getSnapshot().hasSession === true, { timeout: 60000 });
    await reopened.evaluate((pageName) => window.__websiteBuilderRegressionApi.setActivePage(pageName), PAGE_NAME);
    await reopened.waitForFunction((pageName) => window.__websiteBuilderRegressionApi.getSnapshot().resolvedPageName === pageName, { timeout: 30000 }, PAGE_NAME);
    summary.stages.afterCloseReopen = await snapshotReviews(reopened, "after close/reopen");
    assertAllImages(summary.stages.afterCloseReopen, "after close/reopen");
    summary.dom.afterCloseReopen = await assertReviewTextVisible(reopened, "after close/reopen");

    const latest = await fetchProject(reopened);
    assert.equal(latest.status, 200, "project GET should return 200");
    const { project: staleEditProject, originalTexts } = blankReviewImagesAndEditText(latest.body.project, PAGE_NAME, TEST_MARKER);
    const staleSave = await postProject(reopened, staleEditProject, PAGE_NAME, "manual-save");
    summary.api.staleTextEditSave = { status: staleSave.status, ok: staleSave.body?.ok, error: staleSave.body?.error || "" };
    assert.equal(staleSave.status, 200, `stale text edit save should succeed: ${staleSave.body?.error || ""}`);

    await reopened.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
    await reopened.waitForFunction(() => !!window.__websiteBuilderRegressionApi?.getSnapshot?.(), { timeout: 60000 });
    await reopened.waitForFunction((projectId) => window.__websiteBuilderRegressionApi.getSnapshot().project?.id === projectId, { timeout: 60000 }, PROJECT_ID);
    await reopened.waitForFunction(() => window.__websiteBuilderRegressionApi.getSnapshot().hasSession === true, { timeout: 60000 });
    await reopened.evaluate((pageName) => window.__websiteBuilderRegressionApi.setActivePage(pageName), PAGE_NAME);
    await reopened.waitForFunction((pageName) => window.__websiteBuilderRegressionApi.getSnapshot().resolvedPageName === pageName, { timeout: 30000 }, PAGE_NAME);
    summary.stages.afterTextEditWithBlankIncomingImages = await snapshotReviews(reopened, "after text edit with blank incoming images");
    assertAllImages(summary.stages.afterTextEditWithBlankIncomingImages, "after text edit with blank incoming images");
    const afterTextEditReadback = await fetchProject(reopened);
    const afterTextEditBlock = findReviewsBlock(afterTextEditReadback.body.project?.pageBlocks?.[PAGE_NAME] || []);
    summary.stages.afterTextEditApiReadback = summarizeReviewsBlock(afterTextEditBlock, "after text edit API readback");
    assertAllImages(summary.stages.afterTextEditApiReadback, "after text edit API readback");
    assert.ok(
      summary.stages.afterTextEditApiReadback.items.some((item) => String(item.text || "").includes(TEST_MARKER)),
      "text edit marker should persist in API readback while images remain"
    );
    summary.dom.afterTextEdit = await assertReviewTextVisible(reopened, "after text edit with blank incoming images");

    const restoreProject = restoreReviewTexts(afterTextEditReadback.body.project, PAGE_NAME, originalTexts);
    const restoreSave = await postProject(reopened, restoreProject, PAGE_NAME, "manual-save");
    summary.api.restoreTextSave = { status: restoreSave.status, ok: restoreSave.body?.ok, error: restoreSave.body?.error || "" };
    assert.equal(restoreSave.status, 200, `restore text save should succeed: ${restoreSave.body?.error || ""}`);

    const preview = await browser.newPage();
    await preview.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await preview.evaluateOnNewDocument(({ storageKey, session }) => {
      localStorage.setItem(storageKey, JSON.stringify(session));
    }, { storageKey, session });
    await preview.goto(`${BASE_URL}/modules/website-builder/project/${PROJECT_ID}/preview?page=pricing`, { waitUntil: "domcontentloaded", timeout: 60000 });
    summary.dom.preview = await assertDomImages(preview, expectedUrls, "preview page");
    await preview.close();

    const live = await browser.newPage();
    await live.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await live.goto(`${BASE_URL}/sites/gr8-result-digital-solutions/pricing`, { waitUntil: "domcontentloaded", timeout: 60000 });
    summary.dom.liveEquivalent = await assertDomImages(live, expectedUrls, "live-equivalent pricing page");
    await live.close();

    const finalReadback = await fetchProject(reopened);
    const finalBlock = findReviewsBlock(finalReadback.body.project?.pageBlocks?.[PAGE_NAME] || []);
    summary.stages.finalReadback = summarizeReviewsBlock(finalBlock, "final API readback");
    assertAllImages(summary.stages.finalReadback, "final API readback");

    await fs.promises.writeFile(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
    await reopened.close();
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
