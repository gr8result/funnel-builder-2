import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(".env.local") });
dotenv.config({ path: path.resolve(".env") });

const root = process.cwd();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Missing Supabase environment values.");

const baseUrl = process.env.JOHNSON_VERIFY_BASE_URL || "http://localhost:3000";
const workspaceId = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const email = `codex-johnson-recovery-preview-${runId}@example.test`;
const password = `Codex-${runId}-Pass!`;
const outDir = path.join(root, "recovery", "johnson-takeoff-recovered-20260902-0800");
const resultPath = path.join(outDir, "johnson-recovery-preview-browser-result.json");

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

const user = await ensureWorkspaceUser();
const auth = await signIn();
const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 2400, height: 1200 },
  userDataDir: path.join(outDir, `.recovery-preview-browser-${runId}`),
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      console.log("BROWSER", message.type(), message.text().slice(0, 400));
    }
  });

  await primeBrowserSession(page, auth.session);
  const url = `${baseUrl}/modules/estimate-builder?page=aiPlanTakeoff`;
  await page.goto(url, { waitUntil: "networkidle2", timeout: 120000 });
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some((button) => /Open Johnson Recovery Preview/i.test(button.textContent || "")),
    { timeout: 120000 }
  );
  await page.evaluate(() => {
    [...document.querySelectorAll("button")]
      .find((button) => /Open Johnson Recovery Preview/i.test(button.textContent || ""))
      ?.click();
  });

  await page.waitForSelector("[data-johnson-recovery-preview-banner]", { timeout: 120000 });
  await page.waitForFunction(() => document.body.innerText.includes("Sheet 1 of 2"), { timeout: 120000 });
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const sheet1 = path.join(outDir, "johnson-recovery-preview-sheet-1.png");
  const sheet2 = path.join(outDir, "johnson-recovery-preview-sheet-2.png");
  await page.screenshot({ path: sheet1, fullPage: false });
  const sheet1State = await renderState(page);

  await page.click("#ai-plan-takeoff-next-sheet-button");
  await page.waitForFunction(() => document.body.innerText.includes("Sheet 2 of 2"), { timeout: 30000 });
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await page.screenshot({ path: sheet2, fullPage: false });
  const sheet2State = await renderState(page);

  const disabled = await page.evaluate(() => ({
    saveProgress: document.getElementById("ai-plan-takeoff-save-button")?.disabled ?? null,
    saveAs: document.getElementById("ai-plan-takeoff-save-as-button")?.disabled ?? null,
    downloadBackup: document.getElementById("ai-plan-takeoff-download-backup-button")?.disabled ?? null,
  }));

  const result = {
    url,
    userId: user.id,
    screenshots: { sheet1, sheet2 },
    banner: sheet1State.banner.replace(/\s+/g, " ").trim(),
    countsText: sheet1State.countsText,
    disabled,
    sheet1Canvases: sheet1State.canvases,
    sheet2Canvases: sheet2State.canvases,
    sheet1HasVisiblePlan: hasVisiblePlan(sheet1State.canvases),
    sheet2HasVisiblePlan: hasVisiblePlan(sheet2State.canvases),
  };

  fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}

async function ensureWorkspaceUser() {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await upsertWithFallback("accounts", {
    user_id: data.user.id,
    email,
    full_name: "Codex Johnson Recovery Preview",
    business_name: "Johnson Recovery Verification",
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
    .insert({ workspace_id: workspaceId, user_id: data.user.id, role: "owner", status: "active" });
  if (memberError) throw memberError;
  return data.user;
}

async function upsertWithFallback(table, payload, onConflict) {
  const next = { ...payload };
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

async function primeBrowserSession(page, authSession) {
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  await page.evaluateOnNewDocument(({ key, sessionObject, activeWorkspaceId }) => {
    localStorage.setItem(key, JSON.stringify(sessionObject));
    localStorage.setItem(`${key}-fallback`, JSON.stringify({ currentSession: sessionObject, expiresAt: sessionObject?.expires_at || null }));
    localStorage.setItem("active_workspace_id", activeWorkspaceId);
  }, { key: `sb-${ref}-auth-token`, sessionObject: authSession, activeWorkspaceId: workspaceId });
}

async function renderState(page) {
  return page.evaluate(() => {
    const canvases = [...document.querySelectorAll("canvas")].map((canvas, index) => {
      let nonBlank = 0;
      let total = 0;
      let error = "";
      try {
        const context = canvas.getContext("2d");
        const step = Math.max(1, Math.floor(Math.min(canvas.width || 1, canvas.height || 1) / 90));
        for (let y = 0; y < canvas.height; y += step) {
          for (let x = 0; x < canvas.width; x += step) {
            const [r, g, b, a] = context.getImageData(x, y, 1, 1).data;
            total += 1;
            if (!(r > 245 && g > 245 && b > 245 && a > 245)) nonBlank += 1;
          }
        }
      } catch (err) {
        error = err?.message || String(err);
      }
      const rect = canvas.getBoundingClientRect();
      return {
        index,
        width: canvas.width,
        height: canvas.height,
        clientWidth: rect.width,
        clientHeight: rect.height,
        nonBlank,
        total,
        error,
      };
    });
    return {
      banner: document.querySelector("[data-johnson-recovery-preview-banner]")?.textContent || "",
      countsText: document.querySelector("[data-johnson-recovery-preview-counts]")?.textContent || "",
      canvases,
    };
  });
}

function hasVisiblePlan(canvases) {
  return canvases.some((canvas) => canvas.width > 500 && canvas.height > 500 && canvas.nonBlank > 50);
}
