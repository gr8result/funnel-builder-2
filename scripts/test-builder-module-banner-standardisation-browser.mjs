import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const baseUrl = process.env.BUILDER_BANNER_BASE_URL || "http://localhost:3000";
const workspaceId = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const outDir = path.join(root, "test-results", "builder-module-banners");
fs.mkdirSync(outDir, { recursive: true });

if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Missing Supabase environment values.");

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const email = `codex-builder-banner-${runId}@example.test`;
const password = `Codex-${runId}-Pass!`;

await ensureWorkspaceUser();
const auth = await signIn();

const pages = [
  ["dataInput", "Job Setup", "01-job-setup.png"],
  ["aiPlanTakeoff", "AI Plan Takeoff", "02-ai-plan-takeoff.png"],
  ["projectEstimate", "Project Estimate", "03-project-estimate.png"],
  ["clientSelections", "Client Selections", "04-client-selections.png"],
  ["quotation", "Quotation Builder", "05-quotation-builder.png"],
  ["productLibrary", "Product Library", "06-product-library.png"],
  ["estimatingCatalogue", "Estimating Catalogue", "07-estimating-catalogue.png"],
];

const browser = await puppeteer.launch({
  headless: "new",
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  defaultViewport: { width: 1920, height: 1080 },
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.stack || error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /ReferenceError|is not defined|Cannot read|Cannot access/i.test(message.text())) {
      runtimeErrors.push(message.text());
    }
  });

  await primeAuth(page, auth.session);
  for (const [pageKey, expectedTitle, fileName] of pages) {
    await page.goto(`${baseUrl}/modules/estimate-builder?page=${pageKey}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForSelector('[data-testid="builder-module-banner-title"]');
    const state = await page.evaluate(() => {
      const title = document.querySelector('[data-testid="builder-module-banner-title"]');
      const job = document.querySelector('[data-testid="builder-module-banner-job"]');
      const icon = document.querySelector('[data-testid="builder-module-banner-icon"]');
      const actions = document.querySelector('[data-testid="builder-module-banner"] > div > div:last-child');
      const titleStyle = window.getComputedStyle(title);
      const titleRect = title.getBoundingClientRect();
      const actionsRect = actions?.getBoundingClientRect();
      const overlapsActions = Boolean(actionsRect)
        && titleRect.right > actionsRect.left
        && titleRect.left < actionsRect.right
        && titleRect.bottom > actionsRect.top
        && titleRect.top < actionsRect.bottom;
      return {
        title: title?.textContent?.trim() || "",
        job: job?.textContent?.trim() || "",
        fontSize: titleStyle.fontSize,
        fontWeight: titleStyle.fontWeight,
        iconPresent: Boolean(icon),
        overlapsActions,
        body: document.body.innerText,
      };
    });
    assert.equal(state.title, expectedTitle, `${pageKey} renders correct module title`);
    assert.equal(state.fontSize, "48px", `${pageKey} desktop title renders at 48px`);
    assert.equal(Number(state.fontWeight), 600, `${pageKey} title weight renders at 600`);
    assert.ok(state.iconPresent, `${pageKey} renders a module icon`);
    assert.equal(state.job, "No job open", `${pageKey} shows no active job as secondary text`);
    assert.equal(state.body.includes("Johnson 123"), false, `${pageKey} has no Johnson fallback`);
    assert.equal(state.overlapsActions, false, `${pageKey} title does not overlap actions`);
    await page.screenshot({ path: path.join(outDir, fileName), fullPage: true });
  }
  await assertNoRuntimeErrors(runtimeErrors);
  console.log(`Builder module banner screenshots saved to ${outDir}`);
} finally {
  await browser.close();
}

async function primeAuth(page, sessionObject) {
  await page.goto(`${baseUrl}/modules/estimate-builder?page=dataInput`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  await page.evaluate(({ key, sessionObject, workspaceId }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(key, JSON.stringify(sessionObject));
    localStorage.setItem("active_workspace_id", workspaceId);
  }, { key: `sb-${ref}-auth-token`, sessionObject, workspaceId });
}

async function ensureWorkspaceUser() {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const userId = data.user.id;
  await upsertWithFallback("accounts", {
    user_id: userId,
    email,
    full_name: "Codex Builder Banner Tester",
    business_name: "Builder Banner Verification",
    approved: true,
    is_approved: true,
    status: "approved",
    subscription_status: "active",
    onboarding_completed: true,
    phone_verified: true,
    email_verified: true,
  }, "user_id");
  const { error: memberError } = await admin
    .from("workspace_members")
    .insert({ workspace_id: workspaceId, user_id: userId, role: "owner", status: "active" });
  if (memberError) throw memberError;
}

async function upsertWithFallback(table, payload, onConflict) {
  let next = { ...payload };
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await admin.from(table).upsert(next, { onConflict }).select("*").single();
    if (!error) return data;
    const missing = missingColumn(error);
    if (!missing || !(missing in next)) throw error;
    delete next[missing];
  }
  throw new Error(`Could not upsert ${table}.`);
}

function missingColumn(error) {
  const message = `${error?.message || ""} ${error?.details || ""}`;
  const match = message.match(/'([^']+)' column|column "([^"]+)"/i);
  return match?.[1] || match?.[2] || "";
}

async function signIn() {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function assertNoRuntimeErrors(errors) {
  assert.deepEqual(errors, [], `Runtime errors detected:\n${errors.join("\n")}`);
}
