import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const blockRenderer = fs.readFileSync(path.join(repoRoot, "components/website-builder/website-renderer/wbBlockComponents.js"), "utf8");

assert.match(
  blockRenderer,
  /const shouldUseFixedNav = !editor && \(isAlwaysMode \|\| \(isGlobalSiteHeader && isStickyMode\)\);/,
  "global sticky navigation must use the fixed-header path, not sticky inside the short nav wrapper"
);

const { default: puppeteer } = await import("puppeteer");

const baseUrl = (process.env.WB_NAV_STICKY_BASE_URL || "http://localhost:3000/sites/__host__").replace(/\/+$/, "");
const hostHeader = process.env.WB_NAV_STICKY_HOST || "www.gr8result.solutions";
const desktopPages = (process.env.WB_NAV_STICKY_PAGES || "home,sms,pricing")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function pageUrl(slug) {
  return `${baseUrl}/${encodeURIComponent(slug)}`;
}

async function measureNav(page) {
  return page.evaluate(() => {
    const block = document.querySelector('[data-published-block-type="nav-bar"], [data-published-block-type="navigation-bar"], [data-website-preview-block-type="nav-bar"], [data-website-preview-block-type="navigation-bar"], [data-global-block-preview="true"][data-global-role="nav"]');
    const wrapper = block?.querySelector('[data-global-site-header-wrapper="true"]') || block;
    const nav = block?.querySelector('[data-global-site-header="true"], [data-website-nav-shell="true"], section, nav, header') || block;
    if (!nav) return null;
    const navRect = nav.getBoundingClientRect();
    const wrapperRect = wrapper?.getBoundingClientRect?.();
    const navStyle = getComputedStyle(nav);
    const wrapperStyle = wrapper ? getComputedStyle(wrapper) : null;
    return {
      navTop: navRect.top,
      navBottom: navRect.bottom,
      navHeight: navRect.height,
      navPosition: navStyle.position,
      navTopStyle: navStyle.top,
      navZIndex: navStyle.zIndex,
      wrapperTop: wrapperRect?.top ?? null,
      wrapperBottom: wrapperRect?.bottom ?? null,
      wrapperHeight: wrapperRect?.height ?? null,
      wrapperPosition: wrapperStyle?.position || "",
      wrapperPaddingTop: wrapperStyle?.paddingTop || "",
      pageScrollY: window.scrollY || 0,
      viewportHeight: window.innerHeight,
    };
  });
}

async function assertStickyAt(page, scrollY, label) {
  await page.evaluate((nextY) => window.scrollTo(0, nextY), scrollY);
  await new Promise((resolve) => setTimeout(resolve, 350));
  const result = await measureNav(page);
  assert.ok(result, `${label}: nav not found`);
  assert.ok(Math.abs(result.navTop) <= 2, `${label}: nav should remain at viewport top after scroll ${scrollY}: ${JSON.stringify(result)}`);
  assert.ok(result.navBottom > 24, `${label}: nav should remain visible after scroll ${scrollY}: ${JSON.stringify(result)}`);
  return result;
}

async function loadPage(browser, slug, viewport) {
  const page = await browser.newPage();
  if (hostHeader) await page.setExtraHTTPHeaders({ "x-site-host": hostHeader });
  await page.setViewport(viewport);
  await page.goto(pageUrl(slug), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector('[data-published-block-type="nav-bar"], [data-published-block-type="navigation-bar"], [data-website-preview-block-type="nav-bar"], [data-website-preview-block-type="navigation-bar"], [data-global-block-preview="true"][data-global-role="nav"]', { timeout: 30000 });
  return page;
}

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const desktopResults = [];
  for (const slug of desktopPages) {
    const page = await loadPage(browser, slug, { width: 1440, height: 900, deviceScaleFactor: 1 });
    const top = await measureNav(page);
    const at400 = await assertStickyAt(page, 400, `${slug} desktop`);
    const at1000 = await assertStickyAt(page, 1000, `${slug} desktop`);
    const maxScroll = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - window.innerHeight - 40));
    const nearBottom = await assertStickyAt(page, maxScroll, `${slug} desktop near bottom`);
    desktopResults.push({ slug, top, at400, at1000, nearBottom });
    await page.close();
  }

  const mobilePage = await loadPage(browser, desktopPages[0] || "home", { width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 });
  const mobileTop = await measureNav(mobilePage);
  const mobile400 = await assertStickyAt(mobilePage, 400, "mobile");
  const mobile1000 = await assertStickyAt(mobilePage, 1000, "mobile");
  await mobilePage.close();

  const offPage = await loadPage(browser, desktopPages[0] || "home", { width: 1440, height: 900, deviceScaleFactor: 1 });
  const stickyOff = await offPage.evaluate(async () => {
    const block = document.querySelector('[data-published-block-type="nav-bar"], [data-published-block-type="navigation-bar"], [data-website-preview-block-type="nav-bar"], [data-website-preview-block-type="navigation-bar"], [data-global-block-preview="true"][data-global-role="nav"]');
    const wrapper = block?.querySelector('[data-global-site-header-wrapper="true"]') || block;
    const nav = block?.querySelector('[data-global-site-header="true"], [data-website-nav-shell="true"], section, nav, header') || block;
    if (!nav) return null;
    [block, wrapper, nav].forEach((element) => {
      if (!element) return;
      element.style.position = "static";
      element.style.top = "auto";
      element.style.left = "auto";
      element.style.right = "auto";
      element.style.paddingTop = "0px";
    });
    window.scrollTo(0, 500);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const rect = nav.getBoundingClientRect();
    return {
      navTop: rect.top,
      navBottom: rect.bottom,
      navPosition: getComputedStyle(nav).position,
      wrapperPosition: wrapper ? getComputedStyle(wrapper).position : "",
      scrollY: window.scrollY,
    };
  });
  await offPage.close();

  assert.ok(stickyOff, "sticky off control: nav not found");
  assert.ok(stickyOff.navTop < -100, `sticky off control should scroll away: ${JSON.stringify(stickyOff)}`);

  console.log(JSON.stringify({
    baseUrl,
    hostHeader,
    desktopResults,
    mobile: { top: mobileTop, at400: mobile400, at1000: mobile1000 },
    stickyOff,
  }, null, 2));
} finally {
  await browser.close();
}
