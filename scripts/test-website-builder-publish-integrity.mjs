import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

dotenv.config({ path: ".env.local", quiet: true });

const PROJECT_ID = "2208a52a-8175-477e-823c-fc6de7fe4afe";
const OWNER_EMAIL = "support@gr8result.com";
const PAGE_NAME = "Pricing";
const BASE_URL = (process.env.WB_BROWSER_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const OUT_DIR = path.join(process.cwd(), "test-results", "website-builder-publish-integrity");
const PROBE_ID = `wb-publish-integrity-${Date.now()}`;
const DELETE_MARKER = `${PROBE_ID}-delete-marker`;
const PROPERTY_MARKER = `${PROBE_ID}-property-marker`;
const PROPERTY_VALUE_A = `${PROBE_ID}-property-A`;
const IMAGE_A = "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80";
const IMAGE_B = "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=80";
const AVATAR_A = "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80";
const AVATAR_B = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80";
const PAGE_NAMES = ["Home", "About Us", "Modules", "Contact Us", "Email", "Pricing", "CRM", "SMS", "Funnels", "Website Builder", "Social Media", "Project Hub"];

fs.mkdirSync(OUT_DIR, { recursive: true });

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value) {
  return crypto.createHash("sha256").update(stableJson(value ?? null)).digest("hex");
}

function pageByName(project, pageName) {
  const slug = slugify(pageName);
  return (project.pages || []).find((page) => page.name === pageName || page.slug === slug) || null;
}

function slugify(value) {
  return String(value || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function materialPageState(project, pageName) {
  return {
    page: pageByName(project, pageName),
    blocks: project.pageBlocks?.[pageName] || [],
    chai: project.chaiData?.[pageName] || null,
    pageSettings: {
      pageWidthMode: project.pageWidthMode,
      globalPageWidthMode: project.globalPageWidthMode,
      containedWidth: project.containedWidth,
    },
    globalNavBlock: project.globalNavBlock || null,
    globalFooterBlock: project.globalFooterBlock || null,
    brandAssets: project.brandAssets || null,
  };
}

function liveInputFromPublished(siteData) {
  return siteData || {};
}

function pageHash(project, pageName) {
  return hash(materialPageState(project, pageName));
}

function contains(value, needle) {
  return stableJson(value).includes(needle);
}

function pricingSummary(project) {
  const blocks = project.pageBlocks?.[PAGE_NAME] || [];
  const testimonial = blocks.find((block) => block.type === "testimonial");
  const hero = blocks.find((block) => block.id === "hero-4xaodxr") || blocks.find((block) => block.type === "hero");
  return {
    savingsDisclosure: contains(materialPageState(project, PAGE_NAME), "Savings Disclosure"),
    dependencies: contains(materialPageState(project, PAGE_NAME), "dependencies"),
    criticalPath: contains(materialPageState(project, PAGE_NAME), "critical path"),
    marginValues: [
      hero?.props?.marginTop,
      project.chaiData?.[PAGE_NAME]?.blocks?.find((block) => block.id === hero?.id)?.props?.marginTop,
    ],
    avatars: (testimonial?.props?.items || []).map((item) => ({
      id: item.id || "",
      author: item.author || item.name || "",
      url: item.avatarUrl || item.avatar || item.imageUrl || item.image || item.src || "",
    })),
  };
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

async function fetchDraftApi(token) {
  const response = await fetch(`${BASE_URL}/api/website-builder/projects?projectId=${encodeURIComponent(PROJECT_ID)}&page=${encodeURIComponent(PAGE_NAME)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = await response.json();
  assert.equal(response.status, 200, `draft GET failed: ${body?.error || response.status}`);
  return body.project;
}

async function savePricing(token, project, blocks) {
  const nextProject = {
    ...project,
    pageBlocks: {
      ...(project.pageBlocks || {}),
      [PAGE_NAME]: blocks,
    },
    chaiData: {
      ...(project.chaiData || {}),
      [PAGE_NAME]: {
        ...(project.chaiData?.[PAGE_NAME] || {}),
        blocks: clone(blocks),
      },
    },
  };
  const response = await fetch(`${BASE_URL}/api/website-builder/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ project: nextProject, projectId: PROJECT_ID, pageName: PAGE_NAME, saveSource: "manual-save" }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, `save failed: ${body?.error || response.status}`);
  return body.project;
}

async function saveProject(token, project, { pageName = PAGE_NAME, siteOnly = false, saveSource = "manual-save" } = {}) {
  const response = await fetch(`${BASE_URL}/api/website-builder/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ project, projectId: PROJECT_ID, pageName, siteOnly, saveSource }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, `save project failed: ${body?.error || response.status}`);
  return body.project;
}

async function publish(token) {
  const response = await fetch(`${BASE_URL}/api/websites/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ project: { id: PROJECT_ID, name: "Gr8 Result Digital Solutions", slug: "gr8-result-digital-solutions" } }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, `publish failed: ${body?.error || response.status}`);
  assert.equal(body?.verified?.savedHash, body?.verified?.publishedHash, "publish API saved/published hash mismatch");
  return body;
}

async function latestPublished(admin) {
  const { data, error } = await admin
    .from("published_websites")
    .select("id, project_id, slug, primary_domain, custom_domain, published_at, updated_at, site_data")
    .eq("project_id", PROJECT_ID)
    .eq("published", true)
    .order("published_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  assert.ok(data?.[0]?.site_data, "Expected published website row");
  return data[0];
}

async function canonical(token) {
  return fetchDraftApi(token);
}

async function assertPipeline(admin, token, label) {
  const draft = await canonical(token);
  const publishedRow = await latestPublished(admin);
  const published = publishedRow.site_data;
  const liveInput = liveInputFromPublished(published);
  const hashes = {
    canonical: pageHash(draft, PAGE_NAME),
    published: pageHash(published, PAGE_NAME),
    liveInput: pageHash(liveInput, PAGE_NAME),
  };
  assert.equal(hashes.canonical, hashes.published, `${label}: canonical and published Pricing hashes differ`);
  assert.equal(hashes.published, hashes.liveInput, `${label}: published and live-input Pricing hashes differ`);
  return {
    label,
    hashes,
    probes: {
      deleteMarker: {
        canonical: contains(materialPageState(draft, PAGE_NAME), DELETE_MARKER),
        published: contains(materialPageState(published, PAGE_NAME), DELETE_MARKER),
        liveInput: contains(materialPageState(liveInput, PAGE_NAME), DELETE_MARKER),
      },
      propertyA: {
        canonical: contains(materialPageState(draft, PAGE_NAME), PROPERTY_VALUE_A),
        published: contains(materialPageState(published, PAGE_NAME), PROPERTY_VALUE_A),
        liveInput: contains(materialPageState(liveInput, PAGE_NAME), PROPERTY_VALUE_A),
      },
      imageA: {
        canonical: contains(materialPageState(draft, PAGE_NAME), IMAGE_A),
        published: contains(materialPageState(published, PAGE_NAME), IMAGE_A),
        liveInput: contains(materialPageState(liveInput, PAGE_NAME), IMAGE_A),
      },
      imageB: {
        canonical: contains(materialPageState(draft, PAGE_NAME), IMAGE_B),
        published: contains(materialPageState(published, PAGE_NAME), IMAGE_B),
        liveInput: contains(materialPageState(liveInput, PAGE_NAME), IMAGE_B),
      },
    },
    pricing: { canonical: pricingSummary(draft), published: pricingSummary(published), liveInput: pricingSummary(liveInput) },
  };
}

function addProbeBlock(project, patch) {
  const blocks = clone(project.pageBlocks?.[PAGE_NAME] || []);
  return [
    ...blocks,
    {
      id: PROBE_ID,
      type: "text",
      props: {
        text: DELETE_MARKER,
        title: DELETE_MARKER,
        backgroundImage: IMAGE_A,
        imageUrl: IMAGE_A,
        ...patch,
      },
    },
  ];
}

function updateProbeBlock(project, patch) {
  return clone(project.pageBlocks?.[PAGE_NAME] || []).map((block) => (
    block.id === PROBE_ID
      ? { ...block, props: { ...(block.props || {}), ...patch } }
      : block
  ));
}

function removeProbeBlock(project) {
  return clone(project.pageBlocks?.[PAGE_NAME] || []).filter((block) => block.id !== PROBE_ID);
}

function findProbeBlock(project) {
  return (project.pageBlocks?.[PAGE_NAME] || []).find((block) => block.id === PROBE_ID) || null;
}

function findPricingHero(project) {
  return (project.pageBlocks?.[PAGE_NAME] || []).find((block) => block.id === "hero-4xaodxr")
    || (project.pageBlocks?.[PAGE_NAME] || []).find((block) => block.type === "hero")
    || null;
}

function findPricingTestimonial(project) {
  return (project.pageBlocks?.[PAGE_NAME] || []).find((block) => block.type === "testimonial") || null;
}

function updateBlock(project, pageName, blockId, updater) {
  const blocks = clone(project.pageBlocks?.[pageName] || []).map((block) => (
    block.id === blockId ? updater(block) : block
  ));
  return {
    ...project,
    pageBlocks: {
      ...(project.pageBlocks || {}),
      [pageName]: blocks,
    },
    chaiData: {
      ...(project.chaiData || {}),
      [pageName]: {
        ...(project.chaiData?.[pageName] || {}),
        blocks: clone(blocks),
      },
    },
  };
}

function setGlobalNavSticky(project, sticky) {
  const block = project.globalNavBlock || null;
  assert.ok(block?.props, "Expected global navigation block");
  return {
    ...project,
    globalNavBlock: {
      ...block,
      props: {
        ...(block.props || {}),
        style: "solid",
        variant: "solid",
        sticky,
        positionSticky: sticky,
        stickyMode: sticky ? "sticky-solid" : "normal",
      },
    },
  };
}

async function browserAcceptance(session, expectedHash) {
  const storageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: storageKey, value: session });
    await page.goto(`${BASE_URL}/modules/website-builder/project/${PROJECT_ID}/preview?page=pricing`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.screenshot({ path: path.join(OUT_DIR, "pricing-preview.png"), fullPage: true });
    const previewText = await page.evaluate(() => document.body.innerText);

    const live = await browser.newPage();
    await live.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    const liveResponse = await live.goto(`${BASE_URL}/sites/gr8-result-digital-solutions/pricing`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await live.screenshot({ path: path.join(OUT_DIR, "pricing-live.png"), fullPage: true });
    const liveText = await live.evaluate(() => document.body.innerText);
    const liveHash = liveResponse.headers()["x-gr8-site-data-hash"] || "";
    const sticky = await live.evaluate(async () => {
      const nav = document.querySelector("[data-published-block-type='nav-bar'], [data-published-block-type='navigation-bar']");
      const read = () => Math.round((nav?.getBoundingClientRect?.().top || 0) * 100) / 100;
      const values = [];
      for (const y of [0, 400, 1000]) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 200));
        values.push({ scrollY: window.scrollY, top: read() });
      }
      return values;
    });
    assert.equal(previewText.includes("Savings Disclosure"), false, "Preview DOM contains Savings Disclosure");
    assert.equal(liveText.includes("Savings Disclosure"), false, "Live DOM contains Savings Disclosure");
    assert.ok(liveHash, "Live route should expose X-GR8-Site-Data-Hash");
    assert.deepEqual(sticky.map((entry) => entry.top), [0, 0, 0], "Sticky nav top measurements must be 0 -> 0 -> 0");
    return { liveHash, expectedHash, sticky, screenshots: ["pricing-preview.png", "pricing-live.png"] };
  } finally {
    await browser.close();
  }
}

async function browserBuilderPageSwitchAcceptance(session) {
  const storageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: storageKey, value: session });
    const pages = ["Pricing", "About Us", "Pricing", "SMS", "Modules", "Pricing"];
    const results = [];
    for (const pageName of pages) {
      const response = await page.goto(`${BASE_URL}/modules/website-builder/visual-builder?projectId=${PROJECT_ID}&page=${encodeURIComponent(pageName)}`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForSelector("body", { timeout: 30000 });
      const text = await page.evaluate(() => document.body.innerText);
      results.push({ pageName, status: response?.status() || 0, hasRuntimeError: /Internal Server Error|Unhandled Runtime Error|Application error/i.test(text) });
    }
    assert.deepEqual(results.map((entry) => entry.status), [200, 200, 200, 200, 200, 200], "Builder page switching did not return HTTP 200");
    assert.equal(results.some((entry) => entry.hasRuntimeError), false, "Builder page switching hit a runtime error");
    return results;
  } finally {
    await browser.close();
  }
}

async function main() {
  const session = await mintSession();
  const token = session.access_token;
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const summary = { projectId: PROJECT_ID, pageName: PAGE_NAME, stages: [], generic: {}, siteWide: {}, browser: null };
  let originalProject = null;

  try {
    originalProject = await fetchDraftApi(token);
    await publish(token);
    summary.stages.push(await assertPipeline(admin, token, "initial"));

    let working = await fetchDraftApi(token);
    working = await savePricing(token, working, addProbeBlock(working));
    await publish(token);
    let probeStage = await assertPipeline(admin, token, "probe added");
    assert.deepEqual(Object.values(probeStage.probes.deleteMarker), [true, true, true], "probe added stage should contain marker");

    working = await fetchDraftApi(token);
    working = await savePricing(token, working, removeProbeBlock(working));
    await publish(token);
    probeStage = await assertPipeline(admin, token, "probe deleted");
    assert.deepEqual(Object.values(probeStage.probes.deleteMarker), [false, false, false], "deleted probe marker returned");
    summary.generic.deletion = { marker: DELETE_MARKER, result: "absent after save/publish/live-input" };

    working = await fetchDraftApi(token);
    working = await savePricing(token, working, addProbeBlock(working, { text: PROPERTY_MARKER, title: PROPERTY_MARKER, probeProperty: PROPERTY_VALUE_A }));
    await publish(token);
    probeStage = await assertPipeline(admin, token, "property A added");
    assert.deepEqual(Object.values(probeStage.probes.propertyA), [true, true, true], "property A should publish");

    working = await fetchDraftApi(token);
    working = await savePricing(token, working, updateProbeBlock(working, { probeProperty: undefined, replacementProperty: `${PROBE_ID}-property-B` }));
    await publish(token);
    probeStage = await assertPipeline(admin, token, "property A removed");
    assert.deepEqual(Object.values(probeStage.probes.propertyA), [false, false, false], "removed property A returned");
    summary.generic.propertyRemoval = { removed: PROPERTY_VALUE_A, result: "absent after save/publish/live-input" };

    working = await fetchDraftApi(token);
    working = await savePricing(token, working, updateProbeBlock(working, { backgroundImage: IMAGE_A, imageUrl: IMAGE_A }));
    await publish(token);
    probeStage = await assertPipeline(admin, token, "image A added");
    assert.deepEqual(Object.values(probeStage.probes.imageA), [true, true, true], "image A should publish");

    working = await fetchDraftApi(token);
    working = await savePricing(token, working, updateProbeBlock(working, { backgroundImage: IMAGE_B, imageUrl: IMAGE_B }));
    await publish(token);
    probeStage = await assertPipeline(admin, token, "image B replaced A");
    assert.deepEqual(Object.values(probeStage.probes.imageA), [false, false, false], "image A returned after replacement");
    assert.deepEqual(Object.values(probeStage.probes.imageB), [true, true, true], "image B should publish");
    summary.generic.imageReplacement = { from: IMAGE_A, to: IMAGE_B, result: "B present, A absent after save/publish/live-input" };

    working = await fetchDraftApi(token);
    await savePricing(token, working, removeProbeBlock(working));
    await savePricing(token, await fetchDraftApi(token), clone(originalProject.pageBlocks[PAGE_NAME] || []));

    working = await fetchDraftApi(token);
    const hero = findPricingHero(working);
    assert.ok(hero?.id, "Expected Pricing hero block");
    working = updateBlock(working, PAGE_NAME, hero.id, (block) => ({ ...block, props: { ...(block.props || {}), marginTop: 37 } }));
    working = await saveProject(token, working);
    working = updateBlock(working, PAGE_NAME, hero.id, (block) => ({ ...block, props: { ...(block.props || {}), marginTop: 0 } }));
    working = await saveProject(token, working);
    let reloaded = await fetchDraftApi(token);
    assert.equal(findPricingHero(reloaded)?.props?.marginTop, 0, "numeric zero margin did not survive reload");
    summary.generic.numericZero = { property: "Pricing hero props.marginTop", value: findPricingHero(reloaded)?.props?.marginTop };

    working = await fetchDraftApi(token);
    working = await saveProject(token, setGlobalNavSticky(working, false), { siteOnly: true });
    reloaded = await fetchDraftApi(token);
    assert.equal(reloaded.globalNavBlock?.props?.sticky, false, "sticky false did not persist");
    working = await saveProject(token, setGlobalNavSticky(reloaded, true), { siteOnly: true });
    reloaded = await fetchDraftApi(token);
    assert.equal(reloaded.globalNavBlock?.props?.sticky, true, "sticky true did not persist");
    assert.equal(reloaded.globalNavBlock?.props?.stickyMode, "sticky-solid", "sticky solid mode did not persist");
    summary.generic.booleanSticky = { falsePersisted: true, truePersisted: true, stickyMode: reloaded.globalNavBlock?.props?.stickyMode };

    working = await fetchDraftApi(token);
    working = await saveProject(token, { ...working, pageWidthMode: "full", globalPageWidthMode: "full" }, { siteOnly: true });
    reloaded = await fetchDraftApi(token);
    assert.equal(reloaded.pageWidthMode, "full", "pageWidthMode full did not persist");
    assert.equal(reloaded.globalPageWidthMode, "full", "globalPageWidthMode full did not persist");
    summary.generic.fullWidth = { pageWidthMode: reloaded.pageWidthMode, globalPageWidthMode: reloaded.globalPageWidthMode };

    working = await fetchDraftApi(token);
    working = await savePricing(token, working, addProbeBlock(working, { items: [{ id: `${PROBE_ID}-nested-a`, label: "keep" }, { id: `${PROBE_ID}-nested-b`, label: "delete" }] }));
    working = await fetchDraftApi(token);
    working = await savePricing(token, working, updateProbeBlock(working, { items: [{ id: `${PROBE_ID}-nested-a`, label: "keep" }] }));
    reloaded = await fetchDraftApi(token);
    assert.equal(contains(findProbeBlock(reloaded), `${PROBE_ID}-nested-b`), false, "deleted nested array item returned after reload");
    summary.generic.nestedDeletion = { removed: `${PROBE_ID}-nested-b`, result: "absent after save/reload" };

    working = await fetchDraftApi(token);
    const testimonial = findPricingTestimonial(working);
    assert.ok(testimonial?.id, "Expected Pricing testimonial block");
    const originalItems = clone(testimonial.props?.items || []);
    assert.ok(originalItems[0]?.id, "Expected testimonial item");
    const editedItemsA = originalItems.map((item, index) => index === 0 ? { ...item, avatarUrl: AVATAR_A } : item);
    working = updateBlock(working, PAGE_NAME, testimonial.id, (block) => ({ ...block, props: { ...(block.props || {}), items: editedItemsA } }));
    working = await saveProject(token, working);
    const editedItemsB = editedItemsA.map((item, index) => index === 0 ? { ...item, avatarUrl: AVATAR_B } : item);
    working = updateBlock(working, PAGE_NAME, testimonial.id, (block) => ({ ...block, props: { ...(block.props || {}), items: editedItemsB } }));
    working = await saveProject(token, working);
    reloaded = await fetchDraftApi(token);
    assert.equal(findPricingTestimonial(reloaded)?.props?.items?.[0]?.avatarUrl, AVATAR_B, "avatar B did not replace avatar A");
    working = updateBlock(reloaded, PAGE_NAME, testimonial.id, (block) => ({
      ...block,
      props: {
        ...(block.props || {}),
        items: (block.props?.items || []).map((item, index) => index === 0 ? { ...item, quote: `${item.quote || item.text || ""} ` } : item),
      },
    }));
    working = await saveProject(token, working);
    reloaded = await fetchDraftApi(token);
    assert.equal(findPricingTestimonial(reloaded)?.props?.items?.[0]?.avatarUrl, AVATAR_B, "unchanged avatar was lost during testimonial text edit");
    summary.generic.avatarReplacement = { from: AVATAR_A, to: AVATAR_B, result: "B persisted and survived text edit" };

    working = await fetchDraftApi(token);
    working = await savePricing(token, working, removeProbeBlock(working));
    await savePricing(token, await fetchDraftApi(token), clone(originalProject.pageBlocks[PAGE_NAME] || []));
    working = await fetchDraftApi(token);
    const staleChaiBlock = { id: `${PROBE_ID}-stale-chai`, type: "text", props: { text: `${PROBE_ID}-stale-chai-value` } };
    const canonicalBlock = { id: `${PROBE_ID}-canonical-pageblocks`, type: "text", props: { text: `${PROBE_ID}-canonical-pageblocks-value` } };
    const staleProject = {
      ...working,
      pageBlocks: { ...(working.pageBlocks || {}), [PAGE_NAME]: [...clone(working.pageBlocks?.[PAGE_NAME] || []), canonicalBlock] },
      chaiData: { ...(working.chaiData || {}), [PAGE_NAME]: { ...(working.chaiData?.[PAGE_NAME] || {}), blocks: [...clone(working.pageBlocks?.[PAGE_NAME] || []), staleChaiBlock] } },
    };
    await saveProject(token, staleProject);
    reloaded = await fetchDraftApi(token);
    assert.equal(contains(materialPageState(reloaded, PAGE_NAME), canonicalBlock.props.text), true, "canonical pageBlocks value missing after stale chaiData save");
    assert.equal(contains(materialPageState(reloaded, PAGE_NAME), staleChaiBlock.props.text), false, "stale chaiData overrode canonical pageBlocks");
    summary.generic.staleChaiData = { canonicalWon: true, staleValueAbsent: true };

    await savePricing(token, await fetchDraftApi(token), clone(originalProject.pageBlocks[PAGE_NAME] || []));
    await saveProject(token, {
      ...(await fetchDraftApi(token)),
      pageWidthMode: originalProject.pageWidthMode,
      globalPageWidthMode: originalProject.globalPageWidthMode,
      globalNavBlock: originalProject.globalNavBlock,
    }, { siteOnly: true });
    await publish(token);
    summary.stages.push(await assertPipeline(admin, token, "restored"));

    const draft = await canonical(token);
    const published = (await latestPublished(admin)).site_data;
    const draftRenderInput = liveInputFromPublished(draft);
    const publishedRenderInput = liveInputFromPublished(published);
    const liveInput = liveInputFromPublished(published);
    summary.siteWide = Object.fromEntries(PAGE_NAMES.map((pageName) => {
      const hashes = {
        canonical: pageHash(draftRenderInput, pageName),
        published: pageHash(publishedRenderInput, pageName),
        liveInput: pageHash(liveInput, pageName),
      };
      assert.equal(hashes.canonical, hashes.published, `${pageName}: canonical/published hash mismatch`);
      assert.equal(hashes.published, hashes.liveInput, `${pageName}: published/live-input hash mismatch`);
      return [pageName, hashes];
    }));

    summary.finalPricing = {
      hashes: {
        previewExpected: pageHash(draft, PAGE_NAME),
        canonical: pageHash(draft, PAGE_NAME),
        published: pageHash(published, PAGE_NAME),
        liveInput: pageHash(liveInput, PAGE_NAME),
      },
      traces: {
        savings: {
          canonical: contains(materialPageState(draft, PAGE_NAME), "Savings Disclosure"),
          published: contains(materialPageState(published, PAGE_NAME), "Savings Disclosure"),
          liveInput: contains(materialPageState(liveInput, PAGE_NAME), "Savings Disclosure"),
        },
        verticalText: {
          canonical: pricingSummary(draft),
          published: pricingSummary(published),
          liveInput: pricingSummary(liveInput),
        },
      },
    };
    summary.browser = await browserAcceptance(session, hash(published));
    summary.browserBuilderPageSwitch = await browserBuilderPageSwitchAcceptance(session);

    await fs.promises.writeFile(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    if (originalProject) {
      try {
        const latest = await fetchDraftApi(token);
        await savePricing(token, latest, clone(originalProject.pageBlocks[PAGE_NAME] || []));
        await publish(token);
      } catch (error) {
        console.error("Failed to restore/publish original Pricing state:", error);
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
