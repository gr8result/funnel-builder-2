import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

dotenv.config({ path: ".env.local", quiet: true });

const PROJECT_ID = "2208a52a-8175-477e-823c-fc6de7fe4afe";
const OWNER_EMAIL = "support@gr8result.com";
const BASE_URL = (process.env.WB_BROWSER_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const OUT_DIR = path.join(process.cwd(), "test-results", "website-builder-pricing-table-layout");

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

function injectSession(page, storageKey, session) {
  return page.evaluateOnNewDocument(({ storageKey: key, session: value }) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, { storageKey, session });
}

async function collectPricingMetrics(page, label) {
  await page.waitForSelector('[data-wb-grid="pricing"] [data-pricing-feature-row="true"]', { timeout: 60000 });
  await page.evaluate(() => document.fonts?.ready).catch(() => {});

  const metrics = await page.evaluate((labelName) => {
    const grids = [...document.querySelectorAll('[data-wb-grid="pricing"]')];
    const grid = grids.find((node) => /Projects Hub/i.test(node.textContent || "")) || grids[0];
    const gridRect = grid?.getBoundingClientRect?.();
    const cards = [...(grid?.children || [])].map((card, index) => {
      const rect = card.getBoundingClientRect();
      return { index, width: rect.width, left: rect.left, top: rect.top };
    });
    const rows = [...(grid?.querySelectorAll('[data-pricing-feature-row="true"]') || [])].map((row, index) => {
      const rect = row.getBoundingClientRect();
      const spans = [...row.querySelectorAll("span")].map((span) => {
        const spanRect = span.getBoundingClientRect();
        const style = getComputedStyle(span);
        return {
          text: span.textContent.trim(),
          width: spanRect.width,
          height: spanRect.height,
          overflowWrap: style.overflowWrap,
          wordBreak: style.wordBreak,
          whiteSpace: style.whiteSpace,
        };
      });
      return {
        index,
        text: row.textContent.trim(),
        width: rect.width,
        gridTemplateColumns: getComputedStyle(row).gridTemplateColumns,
        spans,
      };
    });
    return {
      label: labelName,
      grid: gridRect ? { width: gridRect.width, left: gridRect.left, top: gridRect.top } : null,
      cards,
      rows,
      projectHubRows: rows.filter((row) => /Projects Hub/i.test(row.text)),
    };
  }, label);

  fs.writeFileSync(path.join(OUT_DIR, `${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`), JSON.stringify(metrics, null, 2));
  return metrics;
}

function assertPricingLayout(metrics, viewport) {
  assert.equal(metrics.cards.length, 4, `${metrics.label}: expected four pricing cards`);
  if (viewport.width >= 1200 && (metrics.grid?.width || 0) >= 1088) {
    const leftBuckets = new Set(metrics.cards.map((card) => Math.round(card.left / 10) * 10));
    assert.equal(leftBuckets.size, metrics.cards.length, `${metrics.label}: desktop cards should stay side by side without wrapping`);
    for (const card of metrics.cards) {
      assert.ok(card.width >= 255, `${metrics.label}: card ${card.index} collapsed to ${card.width}px`);
    }
  }

  assert.ok(metrics.projectHubRows.length >= 1, `${metrics.label}: expected Projects Hub rows`);
  for (const row of metrics.rows) {
    for (const span of row.spans) {
      assert.notEqual(span.overflowWrap, "anywhere", `${metrics.label}: ${span.text} uses character-level wrapping`);
      assert.notEqual(span.wordBreak, "break-all", `${metrics.label}: ${span.text} uses break-all`);
      assert.equal(span.whiteSpace, "normal", `${metrics.label}: ${span.text} should wrap normally`);
    }
  }

  for (const row of metrics.projectHubRows) {
    const [labelSpan, valueSpan] = row.spans;
    assert.ok(labelSpan?.width >= 90, `${metrics.label}: Projects Hub label collapsed to ${labelSpan?.width}px`);
    if (valueSpan) {
      assert.ok(valueSpan.width >= 95, `${metrics.label}: Projects Hub value collapsed to ${valueSpan.width}px`);
    }
    assert.ok(!/\b\d+px\b/.test(row.gridTemplateColumns) || !/\b[0-8]\dpx\b/.test(row.gridTemplateColumns), `${metrics.label}: Projects Hub grid has an unusably narrow track: ${row.gridTemplateColumns}`);
  }
}

async function measureContext(browser, storageKey, session, context) {
  const page = await browser.newPage();
  await page.setViewport({ ...context.viewport, deviceScaleFactor: 1 });
  await injectSession(page, storageKey, session);
  await page.goto(context.url, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (context.waitForBuilder) {
    await page.waitForFunction(() => !!window.__websiteBuilderRegressionApi?.getSnapshot?.(), { timeout: 60000 });
    await page.waitForFunction(() => window.__websiteBuilderRegressionApi.getSnapshot().hasSession === true, { timeout: 60000 });
  }
  const metrics = await collectPricingMetrics(page, context.label);
  await page.screenshot({ path: path.join(OUT_DIR, `${context.label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`), fullPage: true });
  await page.close();
  assertPricingLayout(metrics, context.viewport);
  return metrics;
}

async function main() {
  const session = await mintSession();
  const storageKey = getSupabaseStorageKey();
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const contexts = [
    {
      label: "builder-desktop",
      url: `${BASE_URL}/modules/website-builder/visual-builder?projectId=${encodeURIComponent(PROJECT_ID)}&page=Pricing&name=Gr8%20Result%20Digital%20Solutions`,
      viewport: { width: 1440, height: 1000 },
      waitForBuilder: true,
    },
    {
      label: "preview-desktop",
      url: `${BASE_URL}/modules/website-builder/project/${PROJECT_ID}/preview?page=pricing`,
      viewport: { width: 1440, height: 1000 },
    },
    {
      label: "live-desktop",
      url: `${BASE_URL}/sites/gr8-result-digital-solutions/pricing`,
      viewport: { width: 1440, height: 1000 },
    },
    {
      label: "live-tablet",
      url: `${BASE_URL}/sites/gr8-result-digital-solutions/pricing`,
      viewport: { width: 820, height: 1100 },
    },
    {
      label: "live-mobile",
      url: `${BASE_URL}/sites/gr8-result-digital-solutions/pricing`,
      viewport: { width: 390, height: 900 },
    },
  ];

  try {
    const results = [];
    for (const context of contexts) {
      results.push(await measureContext(browser, storageKey, session, context));
    }
    fs.writeFileSync(path.join(OUT_DIR, "summary.json"), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ ok: true, contexts: results.map((result) => result.label), outDir: OUT_DIR }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
