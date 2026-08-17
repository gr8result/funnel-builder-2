import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

import { loadFullSplitWebsiteProject } from "../lib/website-builder/supabaseSiteStorage.js";
import { resolveVideoHeroUrl } from "../lib/website-builder/videoHero.js";

dotenv.config({ path: ".env.local", quiet: true });

const PROJECT_ID = "2208a52a-8175-477e-823c-fc6de7fe4afe";
const USER_ID = "35ab846e-0764-498b-b1f8-7d2cf27d85a5";
const OWNER_EMAIL = "support@gr8result.com";
const BASE_URL = (process.env.WB_BROWSER_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const OUT_DIR = path.join(process.cwd(), "test-results", "website-builder-video-nav-browser");
const HOME_VIDEO_URL = "https://bvtxfphktypdqmlnveqf.supabase.co/storage/v1/object/public/assets/35ab846e-0764-498b-b1f8-7d2cf27d85a5/web-1781469496342-opening-block-video1.mp4";
const MODULES_VIDEO_URL = "https://bvtxfphktypdqmlnveqf.supabase.co/storage/v1/object/public/assets/35ab846e-0764-498b-b1f8-7d2cf27d85a5/web-1781469561736-gr8-result-digital-solutions-modules1.mp4";
const MARKER = `WB-VIDEO-KEEP-${Date.now()}`;

fs.mkdirSync(OUT_DIR, { recursive: true });

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getSupabaseStorageKey() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const host = new URL(url).hostname;
  const ref = host.split(".")[0];
  return `sb-${ref}-auth-token`;
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
  assert.ok(data?.session?.access_token, "Expected minted Supabase session");
  return data.session;
}

function pageUrl(pageName) {
  return `${BASE_URL}/modules/website-builder/visual-builder?projectId=${encodeURIComponent(PROJECT_ID)}&page=${encodeURIComponent(pageName)}&name=Gr8%20Result%20Digital%20Solutions`;
}

function findVideoBlock(project, pageName) {
  const blocks = Array.isArray(project?.pageBlocks?.[pageName]) ? project.pageBlocks[pageName] : [];
  const index = blocks.findIndex((block) => String(block?.type || "") === "video-hero");
  assert.ok(index >= 0, `${pageName}: expected a video-hero block`);
  return { blocks, index, block: blocks[index] };
}

function withSavedVideo(project, pageName, videoUrl) {
  const next = clone(project);
  const { blocks, index } = findVideoBlock(next, pageName);
  blocks[index] = {
    ...blocks[index],
    props: {
      ...(blocks[index].props || {}),
      headline: blocks[index].props?.headline || pageName,
      videoUrl,
      videoStoragePath: `35ab846e-0764-498b-b1f8-7d2cf27d85a5/${path.basename(new URL(videoUrl).pathname)}`,
      videoFileName: path.basename(new URL(videoUrl).pathname),
      videoMimeType: "video/mp4",
    },
  };
  return blocks;
}

function editUnrelatedText(blocks) {
  const next = clone(blocks);
  for (const block of next) {
    if (String(block?.type || "") === "video-hero") {
      block.props = {
        ...(block.props || {}),
        subheadline: `${String(block.props?.subheadline || block.props?.body || "Keep video while editing text").replace(new RegExp(`\\s*${MARKER}\\s*`, "g"), " ").trim()} ${MARKER}`,
      };
      return next;
    }
    const props = block?.props || {};
    for (const key of ["text", "headline", "title", "body", "content"]) {
      if (typeof props[key] === "string" && props[key].trim()) {
        block.props = { ...props, [key]: `${props[key].replace(new RegExp(`\\s*${MARKER}\\s*`, "g"), " ").trim()} ${MARKER}` };
        return next;
      }
    }
  }
  throw new Error("Could not find an unrelated text field to edit");
}

function videoSummary(project, pageName) {
  const { block } = findVideoBlock(project, pageName);
  return {
    pageName,
    blockId: block.id || "",
    propsVideoUrl: block.props?.videoUrl || "",
    resolvedVideoUrl: resolveVideoHeroUrl(block.props || {}),
    props: block.props || {},
  };
}

async function waitForBuilder(page) {
  await page.goto(pageUrl("Home"), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => !!window.__websiteBuilderRegressionApi?.getSnapshot?.(), { timeout: 60000 });
  await page.waitForFunction(() => window.__websiteBuilderRegressionApi.getSnapshot().hasSession === true, { timeout: 60000 });
  await page.waitForFunction((projectId) => window.__websiteBuilderRegressionApi.getSnapshot().project?.id === projectId, { timeout: 60000 }, PROJECT_ID);
}

async function projectApiReadback(page, pageName) {
  return page.evaluate(async ({ projectId, pageName }) => {
    const storageKey = Object.keys(localStorage).find((key) => /^sb-.+-auth-token$/.test(key));
    const session = storageKey ? JSON.parse(localStorage.getItem(storageKey) || "null") : null;
    const token = session?.access_token || "";
    const response = await fetch(`/api/website-builder/projects?projectId=${encodeURIComponent(projectId)}&page=${encodeURIComponent(pageName)}`, {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return response.json();
  }, { projectId: PROJECT_ID, pageName });
}

function findFirstLoss(stages, expectedUrl) {
  for (const stage of stages) {
    const actual = stage?.video?.propsVideoUrl || stage?.video?.videoUrl || stage?.video?.resolvedVideoUrl || "";
    if (actual !== expectedUrl) return { stage: stage.stage, actual };
  }
  return null;
}

async function saveAndTrace(page, pageName, switchPageName, videoUrl) {
  const baseProject = await loadFullSplitWebsiteProject(USER_ID, PROJECT_ID);
  const blocksToSave = withSavedVideo(baseProject, pageName, videoUrl);
  const stages = [];
  let postPayload = null;
  let postResponse = null;

  const responseHandler = async (response) => {
    if (!response.url().includes("/api/website-builder/projects") || response.request().method() !== "POST") return;
    try {
      postResponse = await response.json();
    } catch {}
  };
  page.on("response", responseHandler);
  page.on("request", (request) => {
    if (!request.url().includes("/api/website-builder/projects") || request.method() !== "POST") return;
    try {
      postPayload = JSON.parse(request.postData() || "{}");
      page.evaluate(() => { window.__lastWebsiteBuilderProjectPostSeen = true; }).catch(() => {});
    } catch {}
  });

  await page.evaluate((name) => window.__websiteBuilderRegressionApi.setActivePage(name), pageName);
  await page.waitForFunction((name) => window.__websiteBuilderRegressionApi.getSnapshot().resolvedPageName === name, {}, pageName);
  await page.evaluate(({ pageName, blocks }) => window.__websiteBuilderRegressionApi.stagePageBlocks(pageName, blocks), { pageName, blocks: blocksToSave });
  const beforeSave = await page.evaluate(() => window.__websiteBuilderRegressionApi.getSnapshot());
  stages.push({ stage: "editor state before save", video: beforeSave.videoHeroes[0] });

  const savedProject = await page.evaluate(({ pageName, blocks }) => window.__websiteBuilderRegressionApi.forceSavePageBlocks(pageName, blocks), { pageName, blocks: blocksToSave });
  assert.ok(savedProject && !savedProject._saveError, `${pageName}: Save should succeed`);
  await page.waitForFunction(() => window.__lastWebsiteBuilderProjectPostSeen === true, { timeout: 20000 }).catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 800));

  stages.push({
    stage: "outgoing POST /api/website-builder/projects payload",
    video: videoSummary(postPayload?.project || {}, pageName),
  });
  stages.push({
    stage: "POST response project",
    video: videoSummary(postResponse?.project || savedProject || {}, pageName),
  });

  const dbReadback = await loadFullSplitWebsiteProject(USER_ID, PROJECT_ID);
  stages.push({ stage: "database readback", video: videoSummary(dbReadback, pageName) });

  await page.evaluate((name) => window.__websiteBuilderRegressionApi.setActivePage(name), switchPageName);
  await page.waitForFunction((name) => window.__websiteBuilderRegressionApi.getSnapshot().resolvedPageName === name, {}, switchPageName);
  await page.evaluate((name) => window.__websiteBuilderRegressionApi.setActivePage(name), pageName);
  await page.waitForFunction((name) => window.__websiteBuilderRegressionApi.getSnapshot().resolvedPageName === name, {}, pageName);
  try {
    await page.waitForFunction(
      (expectedUrl) => window.__websiteBuilderRegressionApi.getSnapshot().videoHeroes?.[0]?.videoUrl === expectedUrl,
      { timeout: 20000 },
      videoUrl,
    );
  } catch (error) {
    const snapshot = await page.evaluate(() => window.__websiteBuilderRegressionApi.getSnapshot());
    fs.writeFileSync(path.join(OUT_DIR, `${slugify(pageName)}-switch-timeout-snapshot.json`), JSON.stringify(snapshot, null, 2));
    throw error;
  }

  const projectApi = await projectApiReadback(page, pageName);
  stages.push({ stage: "project API response after page switch", video: videoSummary(projectApi.project || {}, pageName) });

  const afterSwitch = await page.evaluate(() => window.__websiteBuilderRegressionApi.getSnapshot());
  stages.push({ stage: "activeProject state after page switch", video: afterSwitch.videoHeroes[0] });
  stages.push({ stage: "final hero block passed to editor/renderer", video: afterSwitch.videoHeroes[0] });

  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => !!window.__websiteBuilderRegressionApi?.getSnapshot?.(), { timeout: 60000 });
  await page.waitForFunction((projectId) => window.__websiteBuilderRegressionApi.getSnapshot().project?.id === projectId, { timeout: 60000 }, PROJECT_ID);
  await page.evaluate((name) => window.__websiteBuilderRegressionApi.setActivePage(name), pageName);
  await page.waitForFunction((name) => window.__websiteBuilderRegressionApi.getSnapshot().resolvedPageName === name, {}, pageName);
  const afterRefresh = await page.evaluate(() => window.__websiteBuilderRegressionApi.getSnapshot());
  stages.push({ stage: "hard refresh activeProject state", video: afterRefresh.videoHeroes[0] });

  page.off("response", responseHandler);
  const firstLoss = findFirstLoss(stages, videoUrl);
  assert.equal(firstLoss, null, `${pageName}: videoUrl was lost: ${JSON.stringify(firstLoss)}`);
  return { stages, postPayload, postResponse, dbReadback, afterSwitch, afterRefresh };
}

async function saveUnrelatedTextAndAssert(page, pageName, switchPageName, videoUrl) {
  const snapshot = await page.evaluate(() => window.__websiteBuilderRegressionApi.getSnapshot());
  const editedBlocks = editUnrelatedText(snapshot.blocks);
  const saved = await page.evaluate(({ pageName, blocks }) => window.__websiteBuilderRegressionApi.forceSavePageBlocks(pageName, blocks), { pageName, blocks: editedBlocks });
  assert.ok(saved && !saved._saveError, `${pageName}: unrelated text Save should succeed`);
  await page.evaluate((name) => window.__websiteBuilderRegressionApi.setActivePage(name), switchPageName);
  await page.waitForFunction((name) => window.__websiteBuilderRegressionApi.getSnapshot().resolvedPageName === name, {}, switchPageName);
  await page.evaluate((name) => window.__websiteBuilderRegressionApi.setActivePage(name), pageName);
  await page.waitForFunction((name) => window.__websiteBuilderRegressionApi.getSnapshot().resolvedPageName === name, {}, pageName);
  await page.waitForFunction(
    (expectedUrl) => window.__websiteBuilderRegressionApi.getSnapshot().videoHeroes?.[0]?.videoUrl === expectedUrl,
    { timeout: 20000 },
    videoUrl,
  );
  const after = await page.evaluate(() => window.__websiteBuilderRegressionApi.getSnapshot());
  assert.equal(after.videoHeroes[0]?.videoUrl, videoUrl, `${pageName}: unrelated text edit must not clear video`);
  return after;
}

async function measureNav(page, label, selector) {
  const scrolls = [0, 400, 1000];
  const maxScroll = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - window.innerHeight - 20));
  scrolls.push(maxScroll);
  const measures = [];
  for (const scrollY of scrolls) {
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await new Promise((resolve) => setTimeout(resolve, 350));
    const result = await page.evaluate((selector) => {
      const block = document.querySelector(selector);
      const nav = block?.querySelector('[data-website-nav-shell="true"], [data-global-site-header="true"], section, nav, header') || block;
      if (!nav) return null;
      const rect = nav.getBoundingClientRect();
      const ancestors = [];
      let node = nav.parentElement;
      while (node && node !== document.documentElement) {
        const style = getComputedStyle(node);
        ancestors.push({
          selector: node.getAttribute("data-website-preview-block-type")
            || node.getAttribute("data-published-block-type")
            || node.getAttribute("data-global-role")
            || node.tagName.toLowerCase(),
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          transform: style.transform,
          contain: style.contain,
        });
        node = node.parentElement;
      }
      const style = getComputedStyle(nav);
      return {
        scrollY: window.scrollY,
        navSelector: selector,
        position: style.position,
        topStyle: style.top,
        zIndex: style.zIndex,
        rectTop: rect.top,
        rectBottom: rect.bottom,
        visible: rect.bottom > 0 && rect.top <= 2,
        ancestors,
      };
    }, selector);
    assert.ok(result, `${label}: nav not found`);
    assert.ok(Math.abs(result.rectTop) <= 2, `${label}: nav top should remain 0 at scroll ${scrollY}: ${JSON.stringify(result)}`);
    measures.push(result);
  }
  return measures;
}

async function measureStickyOffControl(page, selector) {
  return page.evaluate(async (selector) => {
    const block = document.querySelector(selector);
    const wrapper = block?.querySelector('[data-global-site-header-wrapper="true"]') || block;
    const nav = block?.querySelector('[data-website-nav-shell="true"], [data-global-site-header="true"], section, nav, header') || block;
    if (!nav) return null;
    [block, wrapper, nav].forEach((element) => {
      if (!element) return;
      element.style.position = "static";
      element.style.top = "auto";
      element.style.left = "auto";
      element.style.right = "auto";
      element.style.minHeight = "0px";
      element.style.paddingTop = "0px";
    });
    window.scrollTo(0, 500);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const rect = nav.getBoundingClientRect();
    return { scrollY: window.scrollY, rectTop: rect.top, rectBottom: rect.bottom, position: getComputedStyle(nav).position };
  }, selector);
}

async function main() {
  const session = await mintSession();
  const storageKey = getSupabaseStorageKey();
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const summary = { projectId: PROJECT_ID, traces: {}, sticky: {}, hardRefresh: {}, saveRegression: {} };

  try {
    const page = await browser.newPage();
    page.on("console", (message) => {
      const text = message.text();
      if (text.startsWith("Warning:")) return;
      if (/forceSaveBlockPage|website-builder save|Save encountered|Could not save|Save failed|TypeError|Error/i.test(text)) {
        console.log(`[browser:${message.type()}] ${text}`);
      }
    });
    page.on("pageerror", (error) => {
      console.log(`[browser:pageerror] ${error?.stack || error?.message || error}`);
    });
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(({ storageKey, session }) => {
      localStorage.setItem(storageKey, JSON.stringify(session));
    }, { storageKey, session });

    await waitForBuilder(page);

    const home = await saveAndTrace(page, "Home", "About Us", HOME_VIDEO_URL);
    summary.traces.Home = home.stages;
    summary.hardRefresh.Home = home.afterRefresh.videoHeroes[0];
    summary.saveRegression.Home = { savedNotice: true };
    summary.saveRegression.HomeUnrelatedText = await saveUnrelatedTextAndAssert(page, "Home", "About Us", HOME_VIDEO_URL);

    const modules = await saveAndTrace(page, "Modules", "Pricing", MODULES_VIDEO_URL);
    summary.traces.Modules = modules.stages;
    summary.hardRefresh.Modules = modules.afterRefresh.videoHeroes[0];
    summary.saveRegression.Modules = { savedNotice: true };
    summary.saveRegression.ModulesUnrelatedText = await saveUnrelatedTextAndAssert(page, "Modules", "Pricing", MODULES_VIDEO_URL);

    await page.evaluate((name) => window.__websiteBuilderRegressionApi.setActivePage(name), "Home");
    await page.waitForSelector('[data-global-block-preview="true"][data-global-role="nav"]', { timeout: 30000 });
    summary.sticky.builderPreviewHome = await measureNav(page, "Builder preview Home", '[data-global-block-preview="true"][data-global-role="nav"]');

    const previewPage = await browser.newPage();
    await previewPage.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await previewPage.evaluateOnNewDocument(({ storageKey, session }) => {
      localStorage.setItem(storageKey, JSON.stringify(session));
    }, { storageKey, session });
    await previewPage.goto(`${BASE_URL}/modules/website-builder/project/${PROJECT_ID}/preview?page=home`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await previewPage.waitForSelector('[data-website-preview-block-type="nav-bar"], [data-website-preview-block-type="navigation-bar"]', { timeout: 30000 });
    summary.sticky.previewPageHome = await measureNav(previewPage, "Preview Page Home", '[data-website-preview-block-type="nav-bar"], [data-website-preview-block-type="navigation-bar"]');
    await previewPage.close();

    for (const [label, slug] of Object.entries({ Home: "home", "About Us": "about-us", SMS: "sms", Pricing: "pricing" })) {
      const livePage = await browser.newPage();
      await livePage.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
      await livePage.goto(`${BASE_URL}/sites/gr8-result-digital-solutions/${slug}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await livePage.waitForSelector('[data-published-block-type="nav-bar"], [data-published-block-type="navigation-bar"]', { timeout: 30000 });
      summary.sticky[label] = await measureNav(livePage, `Live ${label}`, '[data-published-block-type="nav-bar"], [data-published-block-type="navigation-bar"]');
      if (label === "Home") {
        const off = await measureStickyOffControl(livePage, '[data-published-block-type="nav-bar"], [data-published-block-type="navigation-bar"]');
        assert.ok(off?.rectTop < -100, `Sticky OFF control should scroll away: ${JSON.stringify(off)}`);
        summary.sticky.stickyOffControl = off;
      }
      await livePage.close();
    }

    const homeFirstLoss = findFirstLoss(summary.traces.Home, HOME_VIDEO_URL);
    const modulesFirstLoss = findFirstLoss(summary.traces.Modules, MODULES_VIDEO_URL);
    summary.firstLoss = { Home: homeFirstLoss, Modules: modulesFirstLoss };
    assert.equal(homeFirstLoss, null, "Home video must not be lost at any traced stage");
    assert.equal(modulesFirstLoss, null, "Modules video must not be lost at any traced stage");

    fs.writeFileSync(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
