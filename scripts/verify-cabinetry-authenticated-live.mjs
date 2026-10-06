import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

// Real authenticated verification. The only test tenant allowed by this harness
// is the existing demo company. Every fixture is newly allocated and cleaned up.
// Supabase and API successes are never mocked. Browser request interception is
// only a write guard: unexpected mutations are aborted, never fabricated.
for (const filename of [".env.local", ".env"]) dotenv.config({ path: filename, quiet: true });
const baseUrl = process.env.CLIENT_SELECTIONS_BASE_URL || "http://localhost:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const ownerEmail = process.env.PRODUCT_LIBRARY_TEST_EMAIL || "support@gr8result.com";
const workspaceId = "00000000-0000-4000-8000-000000000001";
const projectId = randomUUID(), snapshotId = randomUUID();
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const includeLaminate = process.argv.includes("--laminate");
const outDir = path.resolve("artifacts/test-results/client-selections-cabinetry-live", runId);
fs.mkdirSync(outDir, { recursive: true });
const report = {
  checkedAt: new Date().toISOString(), runId,
  scope: "Actual local Next app; genuine Supabase authenticated user JWT and anon key; isolated fixture in existing demo company; no mocked successes",
  workspaceId, projectId, snapshotId, sessionId: null, includeLaminate,
  results: Object.fromEntries(["AUTHENTICATED INSERT", "AUTHENTICATED READ", "RLS WRITE ACCESS", "RLS READ ACCESS", "REVISION REPLACEMENT", "CROSS-ROOM ISOLATION", ...(includeLaminate ? ["POLYTEC UI SAVE/RELOAD", "LAMINEX UI SAVE/RELOAD"] : [])].map((key) => [key, "FAIL"])),
  checks: [], network: [], blockedMutations: [], runtimeErrors: [], fixtures: {}, cleanup: [],
};
let admin, client, browser, page, session, stage = "configuration";
let projectCreated = false, snapshotCreated = false;
const pendingResponses = new Set();
const selectionIds = new Set(), sessionIds = new Set();
const stages = ["configuration", "finish", "internals", "kickboard", "handles", "benchtop", "hardware", "specialFeatures", "review"];
const isActive = (row) => row.is_active !== false && !["replaced", "removed"].includes(row.selection_status || row.status);
const productIdentity = (product) => product.productId || product.id;
function sanitize(value) {
  let text = String(value || "");
  for (const secret of [serviceRoleKey, anonKey, session?.access_token, session?.refresh_token].filter(Boolean)) text = text.split(secret).join("[redacted]");
  return text.replace(/Bearer\s+[A-Za-z0-9_.-]+/g, "Bearer [redacted]");
}
function writeReport() { fs.writeFileSync(path.join(outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`); }
function ensureResult(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.code || ""} ${result.error.message}`);
  return result.data;
}
async function check(label, operation) {
  stage = label;
  const evidence = await operation();
  report.checks.push({ label, passed: true, ...(evidence === undefined ? {} : { evidence }) });
  console.log(`PASS ${label}`);
  writeReport();
  return evidence;
}
async function ready(selector) {
  const handle = await page.waitForSelector(selector); await handle.dispose();
}
async function clickText(text) {
  await page.waitForFunction((value) => [...document.querySelectorAll("button,a")].some((el) => el.textContent.trim() === value), {}, text);
  await page.evaluate((value) => [...document.querySelectorAll("button,a")].find((el) => el.textContent.trim() === value).click(), text);
}
async function field(label, tag = "select") {
  const handle = await page.evaluateHandle(({ label, tag }) => {
    const match = [...document.querySelectorAll('[data-testid="showroom-cabinetry"] label')].find((element) => [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join("").trim() === label);
    const input = match?.querySelector(tag);
    if (!input) throw new Error(`Field missing: ${label} (${tag})`);
    return input;
  }, { label, tag });
  return handle.asElement();
}
async function choose(label, value) {
  const handle = await field(label); try { await handle.select(value); } finally { await handle.dispose(); }
}
async function firstProduct(label, index = 0) {
  const handle = await field(label);
  try {
    const options = await handle.evaluate((select) => [...select.options].filter((option) => option.value).map((option) => ({ value: option.value, text: option.textContent })));
    assert.ok(options[index], `${label}: verified product option ${index} exists`);
    await handle.select(options[index].value);
    return options[index];
  } finally { await handle.dispose(); }
}
async function tick(label) {
  const handle = await field(label, 'input[type="checkbox"]');
  try { if (!(await handle.evaluate((el) => el.checked))) await handle.click(); } finally { await handle.dispose(); }
}
async function setText(label, value, tag = "input") {
  const handle = await field(label, tag);
  try {
    await handle.evaluate((el, value) => {
      const prototype = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value").set.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
  } finally { await handle.dispose(); }
}
async function next(stage) { await page.click('[data-testid="cabinetry-next"]'); await ready(`[data-testid="cabinetry-step-${stage}"]`); }
async function goStage(key) {
  const index = stages.indexOf(key);
  await page.$eval(`nav[aria-label="Cabinetry workflow stages"] button:nth-child(${index + 1})`, (el) => el.click());
  await ready(`[data-testid="cabinetry-step-${key}"]`);
}
async function selectProject() {
  await page.waitForFunction((id) => [...document.querySelectorAll(".setupControls label:nth-child(1) select option")].some((el) => el.value === id), {}, projectId);
  await page.select(".setupControls label:nth-child(1) select", projectId);
  await page.waitForFunction((id) => document.querySelector(".setupControls label:nth-child(2) select")?.value === id, {}, snapshotId);
  if (report.sessionId) await page.waitForFunction((id) => document.querySelector(".setupControls label:nth-child(3) select")?.value === id, {}, report.sessionId);
}
async function openCabinetry() {
  if (await page.$('[data-testid="showroom-choose-area"]')) await page.evaluate(() => [...document.querySelectorAll("button.areaCard")].find((button) => button.querySelector("h3")?.textContent === "Interior").click());
  if (await page.$('[data-testid="showroom-interior-categories"]')) await page.click('[data-requirement-key="kitchen"]');
  await page.evaluate(() => {
    const row = [...document.querySelectorAll(".requirementRow")].find((row) => row.querySelector("h3")?.textContent === "Cabinetry" || row.textContent.includes("Cabinetry"));
    if (!row) throw new Error("Cabinetry checklist row missing"); row.querySelector("button").click();
  });
  await ready('[data-testid="cabinetry-room-list"]');
}
async function openRoom(key) { await page.$eval(`[data-testid="cabinetry-room-${key}"]`, (el) => el.click()); await ready('[data-testid="cabinetry-step-configuration"]'); }
async function browserRows() {
  const result = await page.evaluate(async ({ supabaseUrl, workspaceId, projectId }) => {
    const client = window[`__gr8SupabaseNonStealing:${supabaseUrl}`];
    if (!client) throw new Error("Actual browser Supabase client unavailable");
    const { data, error } = await client.from("builder_client_selections").select("id,workspace_id,project_id,snapshot_id,session_id,is_active,status,selection_status,selected_details,created_by,updated_by,created_at,updated_at").eq("workspace_id", workspaceId).eq("project_id", projectId).order("created_at");
    return { data, error };
  }, { supabaseUrl, workspaceId, projectId });
  const rows = ensureResult(result, "authenticated browser fixture read");
  for (const row of rows) {
    assert.equal(row.workspace_id, workspaceId); assert.equal(row.project_id, projectId); assert.equal(row.snapshot_id, snapshotId);
    selectionIds.add(row.id); if (row.session_id) sessionIds.add(row.session_id);
  }
  return rows;
}
async function saveRoom(key, label) {
  await ready('[data-testid="cabinetry-step-review"]');
  await page.screenshot({ path: path.join(outDir, `${label}-review.png`), fullPage: false });
  await page.click('[data-testid="cabinetry-save"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="cabinetry-room-list"]') || [...document.querySelectorAll('[role="alert"]')].some((el) => /could not|error|failed/i.test(el.textContent)));
  if (!(await page.$('[data-testid="cabinetry-room-list"]'))) throw new Error(`Save Room failed: ${await page.evaluate(() => document.body.innerText)}`);
  const rows = await browserRows();
  const row = rows.filter(isActive).find((row) => row.selected_details?.roomKey === key);
  assert.ok(row, `Authenticated database has active ${key}`);
  assert.equal(row.created_by, session.user.id);
  report.sessionId ||= row.session_id;
  report.fixtures[label] = row;
  return row;
}
async function configureRoom(key) {
  await openRoom(key); await tick("Base cabinets");
  await page.$eval('[aria-label="Base cabinets quantity"]', (el, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true })); }, key === "kitchen" ? "7" : "2");
  await next("finish"); await choose("Cabinet finish brand", key === "kitchen" ? "Polytec" : "Laminex"); await firstProduct("Cabinet finish product");
  await next("internals"); await choose("Internal cabinet finish", "standardWhite");
  await next("kickboard"); await choose("Kickboard finish", "matching");
  await next("handles"); await choose("Handle system", "barHandles"); await firstProduct("Handle product"); await firstProduct("Handle finish"); await firstProduct("Handle size");
  await next("benchtop"); await choose("Benchtop material", "stone"); await choose("Benchtop brand", key === "kitchen" ? "Caesarstone" : "Neolith"); await firstProduct("Benchtop material product");
  await setText("Thickness (mm)", "20"); await setText("Fabrication notes", `Isolated cabinetry verification ${runId} ${key}`, "textarea");
  await next("hardware"); await tick("Soft-close doors"); await next("specialFeatures"); if (key === "laundry") await tick("Hanging rail"); await next("review");
}
async function assertReload(row, label) {
  await page.reload({ waitUntil: "domcontentloaded", timeout: 180000 }); await selectProject(); await openCabinetry();
  const saved = row.selected_details.cabinetryRoom;
  await openRoom(saved.roomKey);
  assert.equal(await page.$eval('[aria-label="Base cabinets quantity"]', (el) => el.value), String(saved.configuration.quantities.baseCabinets));
  await goStage("finish"); let control = await field("Cabinet finish product"); assert.equal(await control.evaluate((el) => el.value), productIdentity(saved.finish)); await control.dispose();
  await goStage("benchtop");
  for (const [fieldName, expected] of [["Benchtop material", saved.benchtop.material], ["Benchtop brand", saved.benchtop.brand], ["Benchtop material product", productIdentity(saved.benchtop.product)]]) {
    control = await field(fieldName); assert.equal(await control.evaluate((el) => el.value), expected, `${label}: ${fieldName} restored`); await control.dispose();
  }
  if (saved.benchtop.product.variantId) {
    control = await field("Material variant"); assert.equal(await control.evaluate((el) => el.value), saved.benchtop.product.variantId, `${label}: material SKU variant restored`); await control.dispose();
  }
  control = await field("Fabrication notes", "textarea"); assert.equal(await control.evaluate((el) => el.value), saved.benchtop.fabrication.notes); await control.dispose();
  await page.screenshot({ path: path.join(outDir, `${label}-reloaded-benchtop.png`), fullPage: false });
  const rows = await browserRows();
  const loaded = rows.find((item) => item.id === row.id); assert.deepEqual(loaded.selected_details, row.selected_details);
  await clickText("Room List"); await ready('[data-testid="cabinetry-room-list"]');
}
async function cleanup() {
  // Service access here is limited to explicit IDs in this newly-created fixture.
  if (!projectCreated) return;
  const project = ensureResult(await admin.from("builder_commercial_projects").select("id,workspace_id,source_metadata").eq("id", projectId).eq("workspace_id", workspaceId).single(), "cleanup fixture ownership");
  assert.equal(project.source_metadata?.verificationRunId, runId, "Cleanup only owns this exact run");
  const scopedSelections = ensureResult(await admin.from("builder_client_selections").select("id,session_id").eq("workspace_id", workspaceId).eq("project_id", projectId), "cleanup selection IDs");
  scopedSelections.forEach((row) => { selectionIds.add(row.id); if (row.session_id) sessionIds.add(row.session_id); });
  const scopedSessions = ensureResult(await admin.from("builder_selection_sessions").select("id").eq("workspace_id", workspaceId).eq("project_id", projectId), "cleanup session IDs");
  scopedSessions.forEach((row) => sessionIds.add(row.id));
  const groups = [
    ["builder_client_selections", [...selectionIds]], ["builder_selection_sessions", [...sessionIds]],
    ["builder_estimate_snapshots", snapshotCreated ? [snapshotId] : []], ["builder_commercial_projects", [projectId]],
  ];
  for (const [table, ids] of groups) {
    if (!ids.length) continue;
    let query = admin.from(table).delete().eq("workspace_id", workspaceId).in("id", ids);
    if (table !== "builder_commercial_projects") query = query.eq("project_id", projectId);
    const deleted = ensureResult(await query.select("id"), `cleanup ${table}`);
    assert.equal(deleted.length, ids.length, `Cleanup deleted own ${table} rows`);
    report.cleanup.push({ table, ids: deleted.map((row) => row.id), passed: true });
  }
  report.cleanupVerified = true;
}
try {
  if (!supabaseUrl || !serviceRoleKey || !anonKey) throw new Error("Missing Supabase URL, anon key, or service role key required for existing trusted authentication workflow.");
  admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  await check("Genuine authenticated user session and existing safe demo workspace", async () => {
    const link = ensureResult(await admin.auth.admin.generateLink({ type: "magiclink", email: ownerEmail }), "trusted account magic link generation");
    const auth = ensureResult(await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token }), "Supabase OTP verification");
    session = auth.session; assert.ok(session?.access_token);
    const claims = JSON.parse(Buffer.from(session.access_token.split(".")[1], "base64url").toString());
    assert.equal(claims.role, "authenticated"); assert.equal(claims.sub, session.user.id);
    const response = await fetch(`${baseUrl}/api/workspaces`, { headers: { Authorization: `Bearer ${session.access_token}` } });
    const body = await response.json(); assert.equal(response.status, 200, JSON.stringify(body));
    const workspace = body.workspaces?.find((row) => row.id === workspaceId);
    assert.ok(workspace, "Trusted authenticated account cannot access the existing demo company; refusing any other tenant");
    assert.equal(workspace.is_demo, true); report.userId = session.user.id; report.authRole = claims.role;
    return { workspaceId: workspace.id, workspaceName: workspace.name, membershipRole: workspace.role, authRole: claims.role };
  });
  await check("Isolated project and snapshot created with authenticated user client", async () => {
    ensureResult(await client.from("builder_commercial_projects").insert({ id: projectId, workspace_id: workspaceId, project_name: `Cabinetry live verification ${runId}`, status: "draft", source_metadata: { verificationRunId: runId }, created_by: session.user.id, updated_by: session.user.id }).select("id").single(), "authenticated fixture project insert"); projectCreated = true;
    ensureResult(await client.from("builder_estimate_snapshots").insert({ id: snapshotId, workspace_id: workspaceId, project_id: projectId, snapshot_number: 1, snapshot_label: `Cabinetry live verification ${runId}`, status: "current", created_by: session.user.id }).select("id").single(), "authenticated fixture snapshot insert"); snapshotCreated = true;
    return { projectId, snapshotId };
  });
  browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, protocolTimeout: 180000, defaultViewport: { width: 1500, height: 1050 } });
  page = await browser.newPage(); page.setDefaultTimeout(60000);
  page.on("pageerror", (error) => report.runtimeErrors.push(sanitize(error.message)));
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin !== new URL(supabaseUrl).origin || !url.pathname.startsWith("/rest/v1/builder_")) return;
    const task = (async () => {
      const request = response.request(); const table = url.pathname.split("/").at(-1);
      const entry = { table, method: request.method(), status: response.status(), filters: Object.fromEntries(url.searchParams) };
      if (!response.ok()) entry.error = sanitize(await response.text());
      if (request.postData() && ["builder_client_selections", "builder_selection_sessions"].includes(table)) {
        const payload = JSON.parse(request.postData()); entry.payload = payload;
      }
      report.network.push(entry);
    })().catch((error) => report.runtimeErrors.push(`Response capture: ${sanitize(error.message)}`));
    pendingResponses.add(task); task.finally(() => pendingResponses.delete(task));
  });
  await page.setRequestInterception(true);
  page.on("request", async (request) => {
    const url = new URL(request.url()), method = request.method();
    if (["GET", "HEAD", "OPTIONS"].includes(method)) { request.continue(); return; }
    let permitted = false;
    if (url.origin === new URL(supabaseUrl).origin && url.pathname.startsWith("/auth/v1/")) permitted = true;
    if (url.origin === new URL(supabaseUrl).origin && url.pathname.startsWith("/rest/v1/")) {
      const table = url.pathname.split("/").at(-1);
      let payload; try { payload = JSON.parse(request.postData() || "{}"); } catch { payload = {}; }
      if (method === "POST" && ["builder_client_selections", "builder_selection_sessions"].includes(table)) permitted = payload.workspace_id === workspaceId && payload.project_id === projectId && payload.snapshot_id === snapshotId;
      if (method === "PATCH" && table === "builder_client_selections") permitted = url.searchParams.get("workspace_id") === `eq.${workspaceId}` && url.searchParams.get("project_id") === `eq.${projectId}`;
      if (method === "PATCH" && table === "builder_selection_sessions") permitted = url.searchParams.get("workspace_id") === `eq.${workspaceId}` && [...sessionIds].some((id) => url.searchParams.get("id") === `eq.${id}`);
      // Verify a newly UI-created session before allowing its first budget update.
      if (method === "PATCH" && table === "builder_selection_sessions" && !permitted && url.searchParams.get("workspace_id") === `eq.${workspaceId}`) {
        const idFilter = url.searchParams.get("id") || "";
        if (/^eq\.[0-9a-f-]{36}$/i.test(idFilter)) {
          const id = idFilter.slice(3);
          const owned = await client.from("builder_selection_sessions").select("id").eq("id", id).eq("workspace_id", workspaceId).eq("project_id", projectId).eq("snapshot_id", snapshotId).maybeSingle();
          if (!owned.error && owned.data?.id === id) { sessionIds.add(id); permitted = true; }
        }
      }
    }
    if (permitted) request.continue();
    else { report.blockedMutations.push({ method, origin: url.origin, pathname: url.pathname }); request.abort("blockedbyclient"); }
  });
  await page.evaluateOnNewDocument(({ session, supabaseUrl, workspaceId }) => {
    if (!/^https?:$/.test(location.protocol)) return;
    localStorage.setItem(`sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`, JSON.stringify(session));
    localStorage.setItem("active_workspace_id", workspaceId);
  }, { session, supabaseUrl, workspaceId });
  await check("Actual Client Selections opens the fixture project and Cabinetry room list", async () => {
    await page.goto(`${baseUrl}/modules/builders/client-selections`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await selectProject(); await openCabinetry();
  });
  const revisionA = await check("Kitchen revision A: real UI selection, authenticated insert and read", async () => {
    await configureRoom("kitchen"); const row = await saveRoom("kitchen", "kitchen-A");
    report.results["AUTHENTICATED INSERT"] = "PASS"; report.results["AUTHENTICATED READ"] = "PASS";
    report.results["RLS WRITE ACCESS"] = "PASS"; report.results["RLS READ ACCESS"] = "PASS";
    return row;
  });
  await check("Kitchen revision A: browser refresh and full saved identity hydration", () => assertReload(revisionA, "kitchen-A"));
  const revisionB = await check("Kitchen revision B replaces only revision A", async () => {
    await openRoom("kitchen"); await goStage("benchtop"); await firstProduct("Benchtop material product", 1); await setText("Fabrication notes", `Kitchen revision B ${runId}`, "textarea"); await goStage("review");
    const row = await saveRoom("kitchen", "kitchen-B"); const rows = await browserRows(); const prior = rows.find((item) => item.id === revisionA.id);
    assert.notEqual(row.id, revisionA.id); assert.equal(row.is_active, true); assert.equal(row.selection_status, "selected");
    assert.equal(prior.is_active, false); assert.equal(prior.selection_status, "replaced"); assert.equal(prior.status, "changed");
    assert.deepEqual(prior.selected_details, revisionA.selected_details); assert.equal(rows.filter(isActive).length, 1);
    report.results["REVISION REPLACEMENT"] = "PASS"; report.fixtures["kitchen-A-retired"] = prior;
    return row;
  });
  await check("Kitchen revision B: browser refresh hydrates the active revision", () => assertReload(revisionB, "kitchen-B"));
  const laundry = await check("Laundry save cannot retire or alter Kitchen", async () => {
    await configureRoom("laundry"); const row = await saveRoom("laundry", "laundry"); const rows = await browserRows(); const kitchen = rows.find((item) => item.id === revisionB.id);
    assert.equal(kitchen.is_active, true); assert.equal(kitchen.selection_status, "selected"); assert.deepEqual(kitchen.selected_details, revisionB.selected_details);
    assert.equal(rows.filter(isActive).length, 2); report.results["CROSS-ROOM ISOLATION"] = "PASS";
    return row;
  });
  await check("Laundry: browser refresh hydrates its independent room product", () => assertReload(laundry, "laundry"));
  await check("Unauthenticated anon client cannot read the isolated selection rows", async () => {
    const anonymous = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const result = await anonymous.from("builder_client_selections").select("id").eq("workspace_id", workspaceId).eq("project_id", projectId);
    assert.equal(result.data?.length || 0, 0, "Anonymous client must not see fixture selections");
    return { returnedRows: result.data?.length || 0, errorCode: result.error?.code || null };
  });
  if (includeLaminate) for (const brand of ["Polytec", "Laminex"]) {
    await check(`${brand} laminate: actual picker, Review, Save Room, reload and identity preservation`, async () => {
      await openRoom("kitchen"); await goStage("benchtop"); await choose("Benchtop material", "laminate"); await choose("Benchtop brand", brand);
      const option = await firstProduct("Benchtop material product"); const variant = await firstProduct("Material variant"); await setText("Fabrication notes", `${brand} verified laminate ${runId}`, "textarea"); await goStage("review");
      const review = await page.$eval('[data-testid="cabinetry-step-review"]', (el) => el.textContent); assert.ok(review.includes(brand));
      const row = await saveRoom("kitchen", `${brand.toLowerCase()}-laminate`); const selected = row.selected_details.cabinetryRoom.benchtop;
      assert.equal(selected.material, "laminate"); assert.equal(selected.brand, brand); assert.equal(productIdentity(selected.product), option.value); assert.equal(selected.product.brand, brand);
      assert.equal(selected.product.variantId, variant.value); assert.ok(selected.product.sku || selected.product.productCode, "Actual selected material SKU survives save");
      assert.equal(selected.product.variants, undefined, "Saved snapshot does not duplicate the catalogue variant array");
      assert.ok(selected.product.sourceUrl || selected.product.source_url || selected.product.productUrl || selected.product.source?.url, "Verified manufacturer source survives save");
      await assertReload(row, `${brand.toLowerCase()}-laminate`);
      const rows = await browserRows(); assert.equal(rows.filter(isActive).length, 2); assert.deepEqual(rows.find((item) => item.id === laundry.id).selected_details, laundry.selected_details);
      report.results[`${brand.toUpperCase()} UI SAVE/RELOAD`] = "PASS";
      return { selectionId: row.id, selectedProduct: selected.product, pickerLabel: option.text };
    });
  }
  await Promise.allSettled([...pendingResponses]);
  report.finalRowsBeforeCleanup = await browserRows();
  assert.equal(report.runtimeErrors.length, 0, report.runtimeErrors.join("\n"));
  report.passed = Object.values(report.results).every((result) => result === "PASS");
} catch (error) {
  report.passed = false; report.failedStage = stage; report.error = sanitize(error.message); report.checks.push({ label: stage, passed: false, error: report.error });
  console.error(`FAIL ${stage}: ${report.error}`);
  if (page && !page.isClosed()) {
    await page.screenshot({ path: path.join(outDir, "failure.png"), fullPage: false }).catch(() => {});
    fs.writeFileSync(path.join(outDir, "failure.txt"), sanitize(await page.evaluate(() => document.body.innerText).catch(() => "Page unavailable")));
  }
  process.exitCode = 1;
} finally {
  await Promise.allSettled([...pendingResponses]);
  if (browser) await browser.close();
  writeReport();
  try { await cleanup(); } catch (error) { report.cleanupError = sanitize(error.message); report.passed = false; process.exitCode = 1; console.error(`FAIL fixture cleanup: ${report.cleanupError}`); }
  report.completedAt = new Date().toISOString(); writeReport();
  fs.writeFileSync(path.resolve("artifacts/test-results/client-selections-cabinetry-live/latest-report.json"), `${JSON.stringify({ reportPath: path.join(outDir, "report.json"), passed: report.passed, results: report.results, error: report.error || null, cleanupVerified: report.cleanupVerified || false }, null, 2)}\n`);
  console.log(JSON.stringify({ reportPath: path.join(outDir, "report.json"), passed: report.passed, results: report.results, cleanupVerified: report.cleanupVerified || false }, null, 2));
}
