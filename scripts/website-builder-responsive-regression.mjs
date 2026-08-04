import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const root = process.cwd();
const projectPath = path.join(root, "website-builder-sites", "35ab846e-0764-498b-b1f8-7d2cf27d85a5", "2208a52a-8175-477e-823c-fc6de7fe4afe", "full-project.json");
const outDir = path.join(root, "tmp", "responsive-regression");
const baseUrl = process.env.WB_REGRESSION_BASE_URL || "http://localhost:3000";
const chromePath = process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const previewToken = "responsive-regression";
const requestedPages = (process.env.WB_REGRESSION_PAGE || "")
  .split(",")
  .map((slug) => slug.trim())
  .filter(Boolean);
const targetPages = requestedPages.length
  ? requestedPages
  : ["home", "about-us", "modules", "pricing", "website-builder", "project-hub"];

if (!fs.existsSync(projectPath)) {
  throw new Error(`Missing regression project fixture: ${projectPath}`);
}

fs.mkdirSync(outDir, { recursive: true });
const project = JSON.parse(fs.readFileSync(projectPath, "utf8"));
const viewports = process.env.WB_REGRESSION_EXHAUSTIVE === "1"
  ? [
      { width: 430, height: 1200, mode: "mobile" },
      { width: 390, height: 1200, mode: "mobile" },
      { width: 360, height: 1200, mode: "mobile" },
      { width: 768, height: 1200, mode: "tablet" },
      { width: 1024, height: 1200, mode: "tablet" },
    ]
  : [
      { width: 390, height: 1200, mode: "mobile" },
      { width: 768, height: 1200, mode: "tablet" },
    ];

const browser = await puppeteer.launch({
  headless: true,
  executablePath: chromePath,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const results = [];
try {
  for (const targetPage of targetPages) {
    const pageExists = (Array.isArray(project.pages) ? project.pages : []).some((entry) => entry?.slug === targetPage || entry?.id === targetPage);
    if (!pageExists) {
      results.push({
        page: targetPage,
        viewport: null,
        issues: [{ kind: "missing-fixture-page", message: `Missing page ${targetPage} in regression fixture` }],
      });
      continue;
    }

  for (const viewport of viewports) {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.evaluateOnNewDocument((seedProject) => {
      window.localStorage.setItem("gr8:website-projects:v1", JSON.stringify([seedProject]));
    }, project);

    const url = `${baseUrl}/modules/website-builder/project/${project.id}/preview?page=${encodeURIComponent(targetPage)}&viewport=${viewport.mode}&previewToken=${previewToken}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector(".gr8wb-viewport", { timeout: 30000 });
    await new Promise((resolve) => setTimeout(resolve, 500));

    const report = await page.evaluate(() => {
      const root = document.querySelector(".gr8wb-viewport");
      const firstSection = root?.querySelector("section, header, footer, article");
      const heroImage = root?.querySelector("section img, header img");
      const rootRect = root?.getBoundingClientRect();
      const firstRect = firstSection?.getBoundingClientRect();
      const heroImageRect = heroImage?.getBoundingClientRect();
      const clientWidth = document.documentElement.clientWidth;
      const scrollWidth = document.documentElement.scrollWidth;
      const viewportHeight = window.innerHeight || 1200;
      const issues = [];
      const isVisible = (element, rect) => {
        const style = window.getComputedStyle(element);
        return rect.width > 1 && rect.height > 1 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0.01;
      };
      const textOf = (element) => (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
      const blockNodes = Array.from(root?.querySelectorAll("[data-website-preview-block], [data-published-block], [data-canvas-block-index], [data-global-block-preview]") || []);
      const blockRects = blockNodes
        .map((node, index) => ({ node, index, rect: node.getBoundingClientRect(), type: node.dataset.websitePreviewBlockType || node.dataset.publishedBlockType || "" }))
        .filter(({ node, rect }) => isVisible(node, rect));

      for (let i = 1; i < blockRects.length; i += 1) {
        const previous = blockRects[i - 1];
        const current = blockRects[i];
        if (current.rect.top < previous.rect.bottom - 6) {
          issues.push({
            kind: "section-overlap",
            blockType: current.type,
            previousBlockType: previous.type,
            top: Math.round(current.rect.top),
            previousBottom: Math.round(previous.rect.bottom),
          });
        }
      }

      const absoluteCandidates = Array.from(root?.querySelectorAll("section *, header *, footer *, article *") || []);
      for (const element of absoluteCandidates) {
        const style = window.getComputedStyle(element);
        if (style.position !== "absolute") continue;
        const rect = element.getBoundingClientRect();
        if (!isVisible(element, rect)) continue;
        const text = textOf(element);
        const block = element.closest("[data-website-preview-block], [data-published-block], [data-canvas-block-index], [data-global-block-preview]");
        const blockType = block?.dataset.websitePreviewBlockType || block?.dataset.publishedBlockType || "";
        const catchesDesktopPlacement = ["hero", "parallax", "image-stack", "hover-cards", "video-hero"].includes(blockType);
        const isLongContent = text.length >= 48;
        const isLargeMedia = ["IMG", "VIDEO", "IFRAME"].includes(element.tagName) && rect.width >= clientWidth * 0.45 && rect.height >= 80;
        const dataLabel = Object.keys(element.dataset || {}).join(" ");
        const isBackgroundVideo = element.tagName === "VIDEO" && text.length === 0 && style.objectFit === "cover";
        const decorative = element.getAttribute("aria-hidden") === "true"
          || style.pointerEvents === "none" && text.length === 0
          || isBackgroundVideo
          || /background|decor|overlay|bounds|controls/i.test(dataLabel);
        if (catchesDesktopPlacement && !decorative && (isLongContent || isLargeMedia)) {
          issues.push({
            kind: "absolute-normal-content",
            tag: element.tagName.toLowerCase(),
            blockType,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            textLength: text.length,
          });
        }
      }

      const textCandidates = Array.from(root?.querySelectorAll("h1, h2, h3, p, li, a, button, span, div") || []);
      for (const element of textCandidates) {
        const text = textOf(element);
        if (text.length < 80) continue;
        const rect = element.getBoundingClientRect();
        if (!isVisible(element, rect)) continue;
        const style = window.getComputedStyle(element);
        const fontSize = Number.parseFloat(style.fontSize || "16");
        if (fontSize < 13.5) {
          issues.push({ kind: "tiny-text", tag: element.tagName.toLowerCase(), fontSize: Math.round(fontSize * 10) / 10, textLength: text.length });
        }
        const tagName = element.tagName.toLowerCase();
        const narrowThreshold = clientWidth < 768 ? 220 : 190;
        if (["p", "li", "h1", "h2", "h3"].includes(tagName) && rect.width < narrowThreshold) {
          issues.push({ kind: "narrow-text-column", tag: element.tagName.toLowerCase(), width: Math.round(rect.width), textLength: text.length });
        }
      }

      if (scrollWidth > clientWidth + 1) {
        issues.push({ kind: "document-overflow", clientWidth, scrollWidth });
      }
      if ((rootRect?.width || 0) < Math.floor(clientWidth * 0.96)) {
        issues.push({ kind: "narrow-root", rootWidth: rootRect ? Math.round(rootRect.width) : 0, clientWidth });
      }
      if (blockRects.length < 2) {
        issues.push({ kind: "empty-page", blockCount: blockRects.length });
      }

      return {
        clientWidth,
        scrollWidth,
        viewportHeight,
        rootWidth: rootRect ? Math.round(rootRect.width) : 0,
        rootLeft: rootRect ? Math.round(rootRect.left) : null,
        rootRight: rootRect ? Math.round(rootRect.right) : null,
        firstBlockWidth: firstRect ? Math.round(firstRect.width) : 0,
        firstBlockLeft: firstRect ? Math.round(firstRect.left) : null,
        firstBlockRight: firstRect ? Math.round(firstRect.right) : null,
        heroImageWidth: heroImageRect ? Math.round(heroImageRect.width) : 0,
        heroImageHeight: heroImageRect ? Math.round(heroImageRect.height) : 0,
        blockCount: root ? root.querySelectorAll("section, header, footer, article").length : 0,
        issues,
      };
    });

    const screenshot = path.join(outDir, `${targetPage}-${viewport.width}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    results.push({ page: targetPage, viewport, screenshot: path.relative(root, screenshot), ...report });
    await page.close();
  }
  }
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));

const failures = results.filter((entry) => Array.isArray(entry.issues) && entry.issues.length > 0);

console.log(JSON.stringify({
  checked: results.length,
  failures: failures.length,
  output: path.relative(root, outDir),
  results,
}, null, 2));

if (failures.length) {
  process.exitCode = 1;
}
