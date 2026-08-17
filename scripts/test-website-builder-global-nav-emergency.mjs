import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

import { loadFullSplitWebsiteProject } from "../lib/website-builder/supabaseSiteStorage.js";

dotenv.config({ path: ".env.local", quiet: true });

const USER_ID = "35ab846e-0764-498b-b1f8-7d2cf27d85a5";
const PROJECT_ID = "2208a52a-8175-477e-823c-fc6de7fe4afe";
const OWNER_EMAIL = "support@gr8result.com";
const BASE_URL = (process.env.WB_BROWSER_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const OUT_DIR = path.join(process.cwd(), "test-results", "website-builder-global-nav-emergency");
const EXPECTED_TOP_LABELS = ["Home", "Modules", "About Us", "Contact Us", "Contact Support"];

fs.mkdirSync(OUT_DIR, { recursive: true });

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

function summarizeLinks(links = []) {
  return links.map((link) => ({
    id: link?.id || "",
    label: link?.label || "",
    href: link?.href || "",
    slug: link?.slug || "",
    pageId: link?.pageId || "",
    linkType: link?.linkType || "",
    highlighted: !!link?.highlighted,
    children: summarizeLinks(Array.isArray(link?.children) ? link.children : []),
  }));
}

function summarizeNavBlock(block) {
  const props = block?.props || {};
  return {
    id: block?.id || "",
    type: block?.type || "",
    sharedComponentId: block?.sharedComponentId || props.sharedComponentId || "",
    role: block?.role || props.role || "",
    brand: props.brand || "",
    logo: props.logo || "",
    logoAssetId: props.logoAssetId || "",
    logoWidth: props.logoWidth,
    variant: props.variant || "",
    style: props.style || "",
    sticky: props.sticky,
    stickyMode: props.stickyMode || "",
    positionSticky: props.positionSticky,
    useGlobalHeader: props.useGlobalHeader,
    showLogo: props.showLogo,
    hidden: props.hidden,
    visible: props.visible,
    desktopHidden: props.desktopHidden,
    tabletHidden: props.tabletHidden,
    mobileHidden: props.mobileHidden,
    ctaText: props.ctaText || "",
    ctaLink: props.ctaLink || "",
    links: summarizeLinks(Array.isArray(props.links) ? props.links : []),
    navigationLinks: summarizeLinks(Array.isArray(props.navigationLinks) ? props.navigationLinks : []),
    navLinks: summarizeLinks(Array.isArray(props.navLinks) ? props.navLinks : []),
  };
}

async function collectBuilderNav(page, label) {
  await page.waitForFunction(() => !!window.__websiteBuilderRegressionApi?.getSnapshot?.(), { timeout: 60000 });
  await page.waitForFunction(() => window.__websiteBuilderRegressionApi.getSnapshot().project?.id === "2208a52a-8175-477e-823c-fc6de7fe4afe", { timeout: 60000 });
  await page.waitForSelector('[data-global-block-preview="true"][data-global-role="nav"] [data-website-nav-shell="true"]', { timeout: 60000 });
  await new Promise((resolve) => setTimeout(resolve, 700));

  const result = await page.evaluate((labelName) => {
    const snapshot = window.__websiteBuilderRegressionApi.getSnapshot();
    const navBlock = snapshot.project?.globalNavBlock || null;
    const props = navBlock?.props || {};
    const wrapper = document.querySelector('[data-global-block-preview="true"][data-global-role="nav"]');
    const shell = wrapper?.querySelector('[data-website-nav-shell="true"]');
    const anchors = [...(shell?.querySelectorAll("a") || [])].map((anchor) => {
      const rect = anchor.getBoundingClientRect();
      const style = getComputedStyle(anchor);
      return {
        text: anchor.textContent.trim(),
        href: anchor.getAttribute("href") || "",
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
      };
    });
    const shellRect = shell?.getBoundingClientRect();
    const wrapperRect = wrapper?.getBoundingClientRect();
    return {
      label: labelName,
      activePage: snapshot.resolvedPageName,
      activeProjectGlobalNav: {
        id: navBlock?.id || "",
        type: navBlock?.type || "",
        brand: props.brand || "",
        sticky: props.sticky,
        stickyMode: props.stickyMode || "",
        links: (props.links || []).map((link) => ({ label: link.label, href: link.href, children: (link.children || []).map((child) => ({ label: child.label, href: child.href })) })),
        navigationLinks: (props.navigationLinks || []).map((link) => ({ label: link.label, href: link.href, children: (link.children || []).map((child) => ({ label: child.label, href: child.href })) })),
      },
      rendererDom: {
        wrapperTop: wrapperRect?.top ?? null,
        wrapperHeight: wrapperRect?.height ?? null,
        shellTop: shellRect?.top ?? null,
        shellHeight: shellRect?.height ?? null,
        shellPosition: shell ? getComputedStyle(shell).position : "",
        shellTopStyle: shell ? getComputedStyle(shell).top : "",
        anchors,
      },
    };
  }, label);

  const visibleTexts = result.rendererDom.anchors
    .filter((anchor) => anchor.width > 8 && anchor.height > 8 && anchor.visibility !== "hidden" && anchor.opacity !== "0")
    .map((anchor) => anchor.text);
  for (const expected of EXPECTED_TOP_LABELS) {
    assert.ok(visibleTexts.includes(expected), `${label}: expected visible nav item ${expected}; saw ${visibleTexts.join(", ")}`);
  }
  assert.ok(result.activeProjectGlobalNav.links.length >= 4, `${label}: active project global nav links disappeared`);
  return result;
}

async function switchBuilderPage(page, pageName) {
  await page.waitForFunction(() => !!window.__websiteBuilderRegressionApi?.setActivePage, { timeout: 60000 });
  await page.evaluate((name) => window.__websiteBuilderRegressionApi.setActivePage(name), pageName);
  await page.waitForFunction((name) => window.__websiteBuilderRegressionApi.getSnapshot().resolvedPageName === name, { timeout: 60000 }, pageName);
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function clickSave(page) {
  const clicked = await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((node) => /Save/.test(node.textContent || "") && !/Template/.test(node.textContent || ""));
    button?.click?.();
    return !!button;
  });
  assert.ok(clicked, "Expected to click the builder Save button");
  await page.waitForFunction(() => /Saved\s*✓|Saved/.test(document.body.innerText || ""), { timeout: 60000 });
}

async function measureBuilderSticky(page) {
  await page.evaluate(() => {
    const wrapper = document.querySelector('[data-global-block-preview="true"][data-global-role="nav"]');
    const findScrollParent = (node) => {
      let current = node?.parentElement || null;
      while (current && current !== document.body && current !== document.documentElement) {
        const style = getComputedStyle(current);
        if (/(auto|scroll)/.test(`${style.overflow}${style.overflowY}${style.overflowX}`) && current.scrollHeight > current.clientHeight + 8) return current;
        current = current.parentElement;
      }
      return window;
    };
    const scrollParent = findScrollParent(wrapper);
    if (!wrapper) return;
    if (scrollParent === window) {
      window.scrollTo(0, (window.scrollY || 0) + wrapper.getBoundingClientRect().top + 1);
      return;
    }
    const parentRect = scrollParent.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    scrollParent.scrollTop += wrapperRect.top - parentRect.top + 1;
  });
  await new Promise((resolve) => setTimeout(resolve, 350));
  const baseY = await page.evaluate(() => {
    const wrapper = document.querySelector('[data-global-block-preview="true"][data-global-role="nav"]');
    let current = wrapper?.parentElement || null;
    while (current && current !== document.body && current !== document.documentElement) {
      const style = getComputedStyle(current);
      if (/(auto|scroll)/.test(`${style.overflow}${style.overflowY}${style.overflowX}`) && current.scrollHeight > current.clientHeight + 8) return current.scrollTop || 0;
      current = current.parentElement;
    }
    return window.scrollY || 0;
  });
  const measurements = [];
  for (const delta of [0, 400, 1000]) {
    await page.evaluate((targetY) => {
      const wrapper = document.querySelector('[data-global-block-preview="true"][data-global-role="nav"]');
      let current = wrapper?.parentElement || null;
      while (current && current !== document.body && current !== document.documentElement) {
        const style = getComputedStyle(current);
        if (/(auto|scroll)/.test(`${style.overflow}${style.overflowY}${style.overflowX}`) && current.scrollHeight > current.clientHeight + 8) {
          current.scrollTop = targetY;
          return;
        }
        current = current.parentElement;
      }
      window.scrollTo(0, targetY);
    }, baseY + delta);
    await new Promise((resolve) => setTimeout(resolve, 350));
    measurements.push(await page.evaluate((scrollDelta) => {
      const wrapper = document.querySelector('[data-global-block-preview="true"][data-global-role="nav"]');
      const nav = document.querySelector('[data-global-block-preview="true"][data-global-role="nav"] [data-website-nav-shell="true"]');
      const rect = nav?.getBoundingClientRect();
      let scrollParent = "window";
      let scrollTop = window.scrollY || 0;
      let current = wrapper?.parentElement || null;
      while (current && current !== document.body && current !== document.documentElement) {
        const style = getComputedStyle(current);
        if (/(auto|scroll)/.test(`${style.overflow}${style.overflowY}${style.overflowX}`) && current.scrollHeight > current.clientHeight + 8) {
          scrollParent = current.getAttribute("data-builder-scroll-parent") || current.className || current.tagName;
          scrollTop = current.scrollTop || 0;
          break;
        }
        current = current.parentElement;
      }
      return {
        scrollDelta,
        scrollParent: String(scrollParent),
        scrollTop,
        windowScrollY: window.scrollY || 0,
        navTop: rect?.top ?? null,
        navBottom: rect?.bottom ?? null,
        navPosition: nav ? getComputedStyle(nav).position : "",
      };
    }, delta));
  }
  for (const item of measurements) {
    assert.ok(Math.abs(item.navTop) <= 2, `Builder sticky nav should remain pinned at top for delta ${item.scrollDelta}: ${JSON.stringify(item)}`);
  }
  return measurements;
}

async function measurePreviewSticky(browser, storageKey, session) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: storageKey, value: session });
  await page.goto(`${BASE_URL}/modules/website-builder/project/${PROJECT_ID}/preview?page=contact-us`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector('[data-website-preview-block-type="nav-bar"], [data-website-preview-block-type="navigation-bar"]', { timeout: 60000 });
  const measurements = [];
  for (const scrollY of [0, 400, 1000]) {
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await new Promise((resolve) => setTimeout(resolve, 350));
    measurements.push(await page.evaluate((y) => {
      const block = document.querySelector('[data-website-preview-block-type="nav-bar"], [data-website-preview-block-type="navigation-bar"]');
      const nav = block?.querySelector('[data-global-site-header="true"], [data-website-nav-shell="true"], section, nav, header') || block;
      const rect = nav?.getBoundingClientRect();
      return { scrollY: y, navTop: rect?.top ?? null, navBottom: rect?.bottom ?? null, navPosition: nav ? getComputedStyle(nav).position : "" };
    }, scrollY));
  }
  await page.close();
  for (const item of measurements) {
    assert.ok(Math.abs(item.navTop) <= 2, `Preview sticky nav should remain pinned at top for scroll ${item.scrollY}: ${JSON.stringify(item)}`);
  }
  return measurements;
}

async function main() {
  const canonicalProject = await loadFullSplitWebsiteProject(USER_ID, PROJECT_ID);
  const canonical = summarizeNavBlock(canonicalProject.globalNavBlock);
  assert.equal(canonical.type, "nav-bar", "Canonical global nav should be a nav-bar");
  assert.ok(canonical.links.length >= 4, "Canonical global nav should preserve menu links");

  const session = await mintSession();
  const storageKey = getSupabaseStorageKey();
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const results = { canonical, pageSwitches: {}, saveReload: null, builderSticky: null, previewSticky: null };

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: storageKey, value: session });
    await page.goto(`${BASE_URL}/modules/website-builder/visual-builder?projectId=${PROJECT_ID}&page=Contact%20Us&name=Gr8%20Result%20Digital%20Solutions`, { waitUntil: "domcontentloaded", timeout: 60000 });

    for (const name of ["Contact Us", "Home", "Modules", "SMS", "Contact Us"]) {
      await switchBuilderPage(page, name);
      results.pageSwitches[name] = await collectBuilderNav(page, name);
      await page.screenshot({ path: path.join(OUT_DIR, `${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-nav.png`), fullPage: true });
    }

    await clickSave(page);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => !!window.__websiteBuilderRegressionApi?.getSnapshot?.(), { timeout: 60000 });
    await switchBuilderPage(page, "Contact Us");
    results.saveReload = await collectBuilderNav(page, "Contact Us after save/reload");
    results.builderSticky = await measureBuilderSticky(page);
    await page.close();

    results.previewSticky = await measurePreviewSticky(browser, storageKey, session);
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(OUT_DIR, "summary.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({
    ok: true,
    canonical: {
      id: canonical.id,
      type: canonical.type,
      brand: canonical.brand,
      sticky: canonical.sticky,
      stickyMode: canonical.stickyMode,
      links: canonical.links,
      ctaText: canonical.ctaText,
      ctaLink: canonical.ctaLink,
    },
    pages: Object.keys(results.pageSwitches),
    builderSticky: results.builderSticky,
    previewSticky: results.previewSticky,
    outDir: OUT_DIR,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
