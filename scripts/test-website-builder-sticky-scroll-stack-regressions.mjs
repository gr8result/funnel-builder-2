import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const read = (file) => fs.readFileSync(path.join(repoRoot, file), "utf8");

const liveRenderer = read("pages/sites/[...slug].js");
const previewSurface = read("components/website-builder/WebsitePreviewSurface.js");
const blockRenderer = read("components/website-builder/website-renderer/wbBlockComponents.js");

assert.match(
  liveRenderer,
  /<main[^>]+overflowX:\s*"visible"/s,
  "published root must not clip sticky descendants"
);
assert.match(
  liveRenderer,
  /\[data-published-block-type="scroll-stack"\][\s\S]*?overflow:\s*visible !important/,
  "published scroll-stack frame must allow its sticky child to work"
);
assert.match(
  liveRenderer,
  /\[data-published-block-type="nav-bar"\][\s\S]*?overflow:\s*visible !important/,
  "published global nav frame must allow sticky positioning"
);
assert.match(
  previewSurface,
  /previewViewport:[\s\S]*?overflowX:\s*"visible"/,
  "preview viewport must not clip sticky descendants"
);
assert.match(
  blockRenderer,
  /const forceDesktopAccordion = /,
  "desktop accordion fallback must be explicit"
);
assert.doesNotMatch(
  blockRenderer,
  /return renderStackedAccordion\(false, false\);\s*return \(/,
  "desktop scroll-stack renderer must not be hidden behind an unconditional accordion return"
);

const browserUrl = process.env.WB_LIVE_TEST_URL;
if (!browserUrl) {
  console.log("source checks passed; set WB_LIVE_TEST_URL to run browser checks");
  process.exit(0);
}

const { default: puppeteer } = await import("puppeteer");

const hostHeader = process.env.WB_LIVE_TEST_HOST || "";
const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const page = await browser.newPage();
  if (hostHeader) {
    await page.setExtraHTTPHeaders({ "x-site-host": hostHeader });
  }
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(browserUrl, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector('[data-published-block-type="nav-bar"], [data-published-block-type="navigation-bar"]', { timeout: 30000 });

  const navBefore = await page.evaluate(() => {
    const block = document.querySelector('[data-published-block-type="nav-bar"], [data-published-block-type="navigation-bar"]');
    const shell = block?.querySelector("section, nav, header") || block;
    const rect = shell.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: rect.bottom,
      position: getComputedStyle(shell).position,
      wrapperPosition: getComputedStyle(block).position,
      wrapperOverflow: getComputedStyle(block).overflow,
    };
  });
  await page.evaluate(() => window.scrollTo(0, 1200));
  await new Promise((resolve) => setTimeout(resolve, 350));
  const navAfter = await page.evaluate(() => {
    const block = document.querySelector('[data-published-block-type="nav-bar"], [data-published-block-type="navigation-bar"]');
    const shell = block?.querySelector("section, nav, header") || block;
    const rect = shell.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: rect.bottom,
      position: getComputedStyle(shell).position,
      wrapperPosition: getComputedStyle(block).position,
      wrapperOverflow: getComputedStyle(block).overflow,
    };
  });

  assert.ok(Math.abs(navAfter.top) <= 2, `global nav should remain at viewport top after scroll: ${JSON.stringify({ navBefore, navAfter })}`);
  assert.ok(navAfter.bottom > 24, `global nav should remain visible after scroll: ${JSON.stringify({ navAfter })}`);

  await page.evaluate(() => {
    const stack = document.querySelector('[data-published-block-type="scroll-stack"], [data-published-block-type="side-scroll-accordion"]');
    stack?.scrollIntoView({ block: "start" });
  });
  await new Promise((resolve) => setTimeout(resolve, 450));
  await page.waitForSelector('[data-published-block-type="scroll-stack"], [data-published-block-type="side-scroll-accordion"]', { timeout: 30000 });

  const stackInitial = await page.evaluate(() => {
    const block = document.querySelector('[data-published-block-type="scroll-stack"], [data-published-block-type="side-scroll-accordion"]');
    const section = block?.querySelector("section");
    const viewportWidth = window.innerWidth;
    const texts = [
      "Promote sales",
      "A mobile experience",
      "Create intelligent SMS sequences",
    ];
    const painted = (needle) => {
      const walker = document.createTreeWalker(block || document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (!node.nodeValue.includes(needle)) continue;
        const parent = node.parentElement;
        const rect = parent?.getBoundingClientRect?.();
        if (!rect) return false;
        if (!(rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth)) return false;
        const x = Math.min(Math.max(rect.left + Math.min(40, rect.width / 2), 0), window.innerWidth - 1);
        const y = Math.min(Math.max(rect.top + Math.min(20, rect.height / 2), 0), window.innerHeight - 1);
        const topElement = document.elementFromPoint(x, y);
        return Boolean(topElement && (topElement === parent || parent.contains(topElement) || topElement.contains(parent)));
      }
      return false;
    };
    const paintedText = texts.map((needle) => [needle, painted(needle)]);
    const rect = block?.getBoundingClientRect();
    return {
      blockWidth: rect?.width || 0,
      sectionHeight: section?.getBoundingClientRect?.().height || 0,
      wrapperOverflow: block ? getComputedStyle(block).overflow : "",
      paintedText,
      paintedTextCount: paintedText.filter(([, isPainted]) => isPainted).length,
      viewportWidth,
    };
  });

  assert.ok(stackInitial.blockWidth >= stackInitial.viewportWidth - 2, `scroll-stack block should span the viewport: ${JSON.stringify(stackInitial)}`);
  assert.equal(stackInitial.wrapperOverflow, "visible", `scroll-stack wrapper must not clip sticky child: ${JSON.stringify(stackInitial)}`);
  assert.equal(stackInitial.paintedTextCount, 1, `scroll-stack should paint one expanded panel at a time: ${JSON.stringify(stackInitial)}`);

  const pageInfo = {
    url: page.url(),
    navBefore,
    navAfter,
    stackInitial,
  };
  console.log(JSON.stringify(pageInfo, null, 2));
} finally {
  await browser.close();
}
