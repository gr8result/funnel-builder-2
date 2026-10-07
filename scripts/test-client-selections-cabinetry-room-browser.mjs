import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import puppeteer from "puppeteer";

// Runs the actual Next route and Supabase browser client against isolated HTTP
// fixtures. No authentication emails or production database writes are made.
dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const baseUrl = process.env.CLIENT_SELECTIONS_BASE_URL || "http://localhost:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
if (!supabaseUrl) throw new Error("The local Next application's Supabase URL is required.");
const outDir = path.resolve("artifacts/test-results/client-selections-cabinetry-rooms");
fs.mkdirSync(outDir, { recursive: true });
const workspaceId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const snapshotId = "33333333-3333-4333-8333-333333333333";
const sessionId = "44444444-4444-4444-8444-444444444444";
const otherSessionId = "55555555-5555-4555-8555-555555555555";
const newSnapshotId = "77777777-7777-4777-8777-777777777777";
const user = { id: "66666666-6666-4666-8666-666666666666", email: "cabinetry-test@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
const expiresAt = Math.floor(Date.now() / 1000) + 7200;
const token = [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: user.id, exp: expiresAt, aud: "authenticated", role: "authenticated" })).toString("base64url"), "isolated-test-signature"].join(".");
const session = { user, access_token: token, refresh_token: "isolated-test-refresh", token_type: "bearer", expires_at: expiresAt, expires_in: 7200 };
const tables = {
  accounts: [{ user_id: user.id, business_name: "Cabinetry Test", approved: true, is_approved: true, status: "approved", subscription_status: "active", onboarding_completed: true }],
  builder_commercial_projects: [{ id: projectId, workspace_id: workspaceId, project_name: "Cabinetry verification project", client_name: "Isolated HTTP fixtures", currency: "AUD", original_estimate_total: 500000 }],
  builder_estimate_snapshots: [
    { id: snapshotId, workspace_id: workspaceId, project_id: projectId, snapshot_number: 1, snapshot_label: "Cabinetry test snapshot", final_quote_total: 500000 },
    { id: newSnapshotId, workspace_id: workspaceId, project_id: projectId, snapshot_number: 2, snapshot_label: "Fresh snapshot with no session", final_quote_total: 500000 },
  ],
  builder_selection_sessions: [
    { id: sessionId, workspace_id: workspaceId, project_id: projectId, snapshot_id: snapshotId, session_name: "Cabinetry test session", status: "draft", original_estimate_total: 500000 },
    { id: otherSessionId, workspace_id: workspaceId, project_id: projectId, snapshot_id: snapshotId, session_name: "Other isolated session", status: "draft", original_estimate_total: 500000 },
  ],
  builder_client_selections: [],
  builder_products: [],
};
const writes = [], loads = [], checks = [], runtimeErrors = [], memory = [];
let nextId = 0;
let rejectNextSelectionInsert = false;
let delaySelectionReads = 0;
function matches(row, params) {
  return [...params].every(([key, value]) => {
    if (["select", "order", "limit", "offset", "on_conflict"].includes(key)) return true;
    const [column, property] = key.split("->>");
    const actual = property ? row[column]?.[property] : row[column];
    if (value.startsWith("eq.")) return String(actual) === value.slice(3);
    if (value.startsWith("neq.")) return String(actual) !== value.slice(4);
    if (value.startsWith("in.(")) return value.slice(4, -1).split(",").map((v) => v.replace(/^"|"$/g, "")).includes(String(actual));
    if (value === "is.null") return actual == null;
    if (value === "is.true") return actual === true;
    throw new Error(`Unsupported fixture filter ${key}=${value}`);
  });
}
const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, protocolTimeout: 180000, defaultViewport: { width: 1500, height: 1050 } });
let page;
async function createPage() {
  const nextPage = await browser.newPage();
  nextPage.setDefaultTimeout(60000);
  nextPage.on("pageerror", (error) => runtimeErrors.push(error.message));
  nextPage.on("console", (message) => {
    if (message.type() === "error" && /Maximum update depth|Too many re-renders|out of memory|Unhandled Runtime Error/i.test(message.text())) runtimeErrors.push(message.text());
  });
  await nextPage.evaluateOnNewDocument(({ session, supabaseUrl, workspaceId }) => {
    if (!/^https?:$/.test(location.protocol)) return;
    localStorage.setItem(`sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`, JSON.stringify(session));
    localStorage.setItem("active_workspace_id", workspaceId);
  }, { session, supabaseUrl, workspaceId });
  await nextPage.setRequestInterception(true);
  nextPage.on("request", async (request) => {
    if (request.isInterceptResolutionHandled()) return;
    const url = new URL(request.url());
    const respond = (body, status = 200) => request.respond({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS", "content-range": "0-999/*" }, body: JSON.stringify(body) });
    try {
      if (url.origin === new URL(supabaseUrl).origin) {
        if (request.method() === "OPTIONS") return await respond({});
        if (url.pathname.startsWith("/auth/")) return await respond(url.pathname.endsWith("/user") ? user : session);
        if (url.pathname.startsWith("/storage/")) return await respond([]);
        if (!url.pathname.startsWith("/rest/v1/")) return await respond({});
        const table = url.pathname.split("/").at(-1);
        const source = tables[table] || [];
        const selected = source.filter((row) => matches(row, url.searchParams));
        const isSingle = /vnd.pgrst.object/.test(request.headers().accept || "");
        if (["GET", "HEAD"].includes(request.method())) {
          loads.push({ table, filters: Object.fromEntries(url.searchParams) });
          if (table === "builder_client_selections" && delaySelectionReads) await new Promise((resolve) => setTimeout(resolve, delaySelectionReads));
          const order = url.searchParams.get("order");
          if (order?.includes("updated_at.desc")) selected.sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
          return await respond(isSingle ? selected[0] || null : selected);
        }
        const payload = request.postData() ? JSON.parse(request.postData()) : null;
        writes.push({ table, method: request.method(), filters: Object.fromEntries(url.searchParams), payload });
        if (table !== "builder_client_selections" && table !== "builder_selection_sessions") return await respond({ message: `Unexpected write blocked: ${table}` }, 400);
        if (request.method() === "POST") {
          if (table === "builder_client_selections" && rejectNextSelectionInsert) {
            rejectNextSelectionInsert = false;
            return await respond({ message: "Injected insert failure", code: "23514" }, 400);
          }
          const inserted = (Array.isArray(payload) ? payload : [payload]).map((row) => ({ ...row, id: `fixture-selection-${++nextId}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }));
          tables[table].push(...inserted);
          return await respond(isSingle ? inserted[0] : inserted, 201);
        }
        if (request.method() === "PATCH") {
          selected.forEach((row) => Object.assign(row, payload));
          return await respond(isSingle ? selected[0] || null : selected);
        }
        return await respond({ message: "Deletion is forbidden in this verification." }, 400);
      }
      if (url.origin === new URL(baseUrl).origin && url.pathname.startsWith("/api/")) {
        if (url.pathname === "/api/workspaces") return await respond({ workspaces: [{ id: workspaceId, name: "Cabinetry test workspace", role: "owner", plan: "enterprise" }] });
        return await respond({ success: true, allowed: true, usage: {}, limits: {} });
      }
      if (!["GET", "HEAD"].includes(request.method())) return await respond({ message: "External mutation blocked by cabinetry browser test" }, 400);
      await request.continue();
    } catch (error) {
      runtimeErrors.push(`Fixture request: ${error.message}`);
      if (!request.isInterceptResolutionHandled()) await request.abort();
    }
  });
  return nextPage;
}
async function clickText(text) {
  await page.waitForFunction((expected) => [...document.querySelectorAll("button, a")].some((el) => el.textContent.trim() === expected), {}, text);
  await page.evaluate((expected) => [...document.querySelectorAll("button, a")].find((el) => el.textContent.trim() === expected).click(), text);
}
async function waitForSelectorReady(selector) {
  // An undisposed Puppeteer ElementHandle pins a removed React subtree in Chrome
  // and would make the harness itself appear to leak DOM nodes during navigation.
  const handle = await page.waitForSelector(selector);
  await handle.dispose();
}
async function selectProject() {
  await page.waitForFunction((id) => [...document.querySelectorAll(".setupControls select:first-of-type option")].some((el) => el.value === id), {}, projectId);
  await page.select(".setupControls label:nth-child(1) select", projectId);
  await page.waitForFunction((id) => document.querySelector(".setupControls label:nth-child(3) select")?.value === id, {}, sessionId);
}
async function openCabinetry() {
  if (await page.$('[data-testid="showroom-choose-area"]')) await page.evaluate(() => [...document.querySelectorAll("button.areaCard")].find((button) => button.querySelector("h3")?.textContent === "Interior").click());
  if (await page.$('[data-testid="showroom-interior-categories"]')) await page.click('[data-requirement-key="kitchen"]');
  await page.evaluate(() => {
    const row = [...document.querySelectorAll(".requirementRow")].find((row) => row.querySelector("h3")?.textContent === "Cabinetry" || row.textContent.includes("Cabinetry"));
    if (!row) throw new Error("Cabinetry checklist row is missing");
    row.querySelector("button").click();
  });
  await waitForSelectorReady('[data-testid="cabinetry-room-list"]');
}
async function openRoom(key) {
  await page.$eval(`[data-testid="cabinetry-room-${key}"]`, (button) => button.click());
  await waitForSelectorReady('[data-testid="cabinetry-step-configuration"]');
}
async function field(label, tag = "select") {
  const handle = await page.evaluateHandle(({ label, tag }) => {
    const candidates = [...document.querySelectorAll('[data-testid="showroom-cabinetry"] label')];
    const match = candidates.find((element) => [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join("").trim() === label);
    const input = match?.querySelector(tag);
    if (!input) throw new Error(`Field missing: ${label} (${tag})`);
    return input;
  }, { label, tag });
  return handle.asElement();
}
async function choose(label, value) {
  const handle = await field(label);
  try { await handle.select(value); } finally { await handle.dispose(); }
}
async function firstProduct(label) {
  const handle = await field(label);
  try {
    const value = await handle.evaluate((select) => [...select.options].find((option) => option.value)?.value);
    assert.ok(value, `${label}: real catalogue option exists`);
    await handle.select(value);
    return value;
  } finally { await handle.dispose(); }
}
async function tick(label, checked = true) {
  const handle = await field(label, 'input[type="checkbox"]');
  try { if (await handle.evaluate((input) => input.checked) !== checked) await handle.click(); } finally { await handle.dispose(); }
}
async function input(label, value) {
  const handle = await field(label, "input");
  try {
    await handle.evaluate((input, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); }, value);
  } finally { await handle.dispose(); }
}
async function next(stage) {
  await page.click('[data-testid="cabinetry-next"]');
  await waitForSelectorReady(`[data-testid="cabinetry-step-${stage}"]`);
}
async function configureRoom(key) {
  await openRoom(key);
  const component = key === "bathroom" ? "Wall-mounted 2-door vanity" : "Base cabinets";
  if (key === "bathroom") {
    const text = await page.$eval('[data-testid="cabinetry-step-configuration"]', (element) => element.textContent);
    for (const kitchenOnly of ["Island cabinetry", "Fridge panels", "Dishwasher panels", "Microwave cabinetry", "Rangehood cabinetry"]) assert.equal(text.includes(kitchenOnly), false, kitchenOnly);
  }
  await tick(component);
  await page.$eval(`[aria-label="${component} quantity"]`, (input, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); }, key === "kitchen" ? "5" : "2");
  await next("finish");
  await choose("Cabinet finish brand", key === "kitchen" ? "Polytec" : "Laminex");
  await firstProduct("Cabinet finish product");
  await next("internals");
  await choose("Internal cabinet finish", "catalogue");
  await firstProduct("Internal finish product");
  await tick("Exposed cabinet interiors");
  await firstProduct("Exposed interior finish");
  await firstProduct("Open shelf finish");
  await firstProduct("Feature shelf finish");
  await next("kickboard");
  await choose("Kickboard finish", key === "kitchen" ? "brushedAluminium" : "matching");
  await next("handles");
  await choose("Handle system", "barHandles");
  await firstProduct("Handle product");
  await firstProduct("Handle finish");
  await firstProduct("Handle size");
  await next("benchtop");
  await choose("Benchtop material", "stone");
  await choose("Benchtop brand", key === "laundry" ? "Neolith" : "Caesarstone");
  await firstProduct("Benchtop material product");
  await input("Thickness (mm)", "20");
  await choose("Edge profile", "square");
  await tick("Mitred / drop edge");
  await input("Drop edge height (mm)", "40");
  await choose("Waterfall ends", "1");
  await choose("Splashback / upstand", "upstand");
  await input("Splashback / upstand height (mm)", "100");
  await next("hardware");
  await tick("Soft-close doors"); await tick("Soft-close drawers");
  await choose("Drawer system", "concealedRunners"); await choose("Hinges / hardware", "softCloseConcealed");
  await next("specialFeatures");
  await tick("Open shelving"); await tick("Raw MDF bulkheads");
  if (key === "laundry") await tick("Hanging rail");
  await next("review");
  const review = await page.$eval('[data-testid="cabinetry-step-review"]', (element) => element.textContent);
  for (const group of ["Configuration", "Cabinet Finish", "Internals", "Kickboards", "Handles", "Benchtop", "Hardware", "Special Features"]) assert.ok(review.includes(group), group);
  assert.equal(review.includes('"components"'), false);
}
async function assertHydratedFields(key, expected) {
  await openRoom(key);
  const component = key === "bathroom" ? "Wall-mounted 2-door vanity" : "Base cabinets";
  const inputHandle = await field(component, 'input[type="checkbox"]');
  assert.equal(await inputHandle.evaluate((input) => input.checked), true);
  await inputHandle.dispose();
  const componentKey = key === "bathroom" ? "wallTwoDoorVanity" : "baseCabinets";
  assert.equal(await page.$eval(`[aria-label="${component} quantity"]`, (input) => input.value), String(expected.configuration.quantities[componentKey]));
  await next("finish");
  let selected = await field("Cabinet finish product");
  assert.equal(await selected.evaluate((input) => input.value), expected.finish.productId || expected.finish.id); await selected.dispose();
  await next("internals");
  selected = await field("Internal cabinet finish"); assert.equal(await selected.evaluate((input) => input.value), expected.internals.type); await selected.dispose();
  selected = await field("Internal finish product"); assert.equal(await selected.evaluate((input) => input.value), expected.internals.product.productId || expected.internals.product.id); await selected.dispose();
  await next("kickboard"); selected = await field("Kickboard finish"); assert.equal(await selected.evaluate((input) => input.value), expected.kickboard.type); await selected.dispose();
  await next("handles"); selected = await field("Handle product"); assert.equal(await selected.evaluate((input) => input.value), expected.handles.product.productId || expected.handles.product.id); await selected.dispose();
  for (const [label, value] of [["Handle finish", expected.handles.finish], ["Handle size", expected.handles.size]]) { selected = await field(label); assert.equal(await selected.evaluate((input) => input.value), value); await selected.dispose(); }
  await next("benchtop"); selected = await field("Benchtop material product"); assert.equal(await selected.evaluate((input) => input.value), expected.benchtop.product.productId || expected.benchtop.product.id); await selected.dispose();
  selected = await field("Thickness (mm)", "input"); assert.equal(await selected.evaluate((input) => input.value), expected.benchtop.fabrication.thickness); await selected.dispose();
  await next("hardware"); selected = await field("Drawer system"); assert.equal(await selected.evaluate((input) => input.value), expected.hardware.drawerSystem); await selected.dispose();
  await next("specialFeatures"); selected = await field("Raw MDF bulkheads", 'input[type="checkbox"]'); assert.equal(await selected.evaluate((input) => input.checked), true); await selected.dispose();
  await next("review");
  await clickText("Room List");
  await waitForSelectorReady('[data-testid="cabinetry-room-list"]');
}
async function roomSpecification(key) {
  return activeRows().find((row) => row.session_id === sessionId && row.selected_details?.roomKey === key)?.selected_details?.cabinetryRoom;
}
async function review() {
  const stages = ["configuration", "finish", "internals", "kickboard", "handles", "benchtop", "hardware", "specialFeatures", "review"];
  for (const stage of stages.slice(1)) {
    await page.click('[data-testid="cabinetry-next"]');
    await waitForSelectorReady(`[data-testid="cabinetry-step-${stage}"]`);
  }
}
async function check(label, operation) {
  await operation();
  checks.push(label);
  console.log(`PASS ${label}`);
}
function activeRows() { return tables.builder_client_selections.filter((row) => row.is_active !== false && !["replaced", "removed"].includes(row.selection_status || row.status)); }
try {
  page = await createPage();
  await page.goto(`${baseUrl}/modules/builders/client-selections`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await selectProject();
  await check("Actual Client Selections route opens Cabinetry room list", openCabinetry);
  const savedRooms = {};
  for (const key of ["kitchen", "laundry", "bathroom"]) {
    await check(`${key}: all nine stages -> Save Room -> Room List`, async () => {
      await configureRoom(key);
      await page.screenshot({ path: path.join(outDir, `${key}-review.png`), fullPage: false });
      await page.click('[data-testid="cabinetry-save"]');
      await waitForSelectorReady('[data-testid="cabinetry-room-list"]');
      savedRooms[key] = structuredClone(await roomSpecification(key));
      assert.ok(savedRooms[key]);
      assert.ok(savedRooms[key].finish.productId && savedRooms[key].handles.product.productId && savedRooms[key].benchtop.product.productId);
      assert.ok(JSON.stringify(savedRooms[key]).length < 30000, "Room stores selected product snapshots only");
    });
    await check(`${key}: discard page state -> browser refresh -> scoped load -> hydrate every section`, async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await selectProject(); await openCabinetry();
      await assertHydratedFields(key, savedRooms[key]);
      for (const previous of Object.keys(savedRooms)) assert.deepEqual(await roomSpecification(previous), savedRooms[previous]);
    });
  }
  await check("Multi-room save and requirement/subcategory isolation", async () => {
    assert.equal(activeRows().filter((row) => row.session_id === sessionId).length, 3);
    assert.equal(new Set(activeRows().map((row) => row.subcategory)).size, 3);
    await openRoom("kitchen");
    await page.$eval('[aria-label="Base cabinets quantity"]', (input) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "8"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    await review(); await page.click('[data-testid="cabinetry-save"]'); await waitForSelectorReady('[data-testid="cabinetry-room-list"]');
    savedRooms.kitchen = structuredClone(await roomSpecification("kitchen"));
    assert.equal(savedRooms.kitchen.configuration.quantities.baseCabinets, 8);
    assert.deepEqual(await roomSpecification("laundry"), savedRooms.laundry); assert.deepEqual(await roomSpecification("bathroom"), savedRooms.bathroom);
    assert.equal(activeRows().length, 3);
    const retire = writes.filter((entry) => entry.table === "builder_client_selections" && entry.method === "PATCH").at(-1);
    assert.equal(retire.filters["selected_details->>requirementKey"], "eq.cabinetry:kitchen");
    for (const field of ["workspace_id", "project_id", "snapshot_id", "session_id", "id"]) assert.ok(retire.filters[field]);
  });
  await check("Save failure preserves Review and existing saved room; retry succeeds", async () => {
    await openRoom("bathroom"); await review();
    const before = structuredClone(tables.builder_client_selections);
    rejectNextSelectionInsert = true;
    await page.click('[data-testid="cabinetry-save"]');
    await page.waitForFunction(() => document.body.innerText.includes("Injected insert failure"));
    assert.ok(await page.$('[data-testid="cabinetry-step-review"]'));
    assert.deepEqual(tables.builder_client_selections, before);
    await page.click('[data-testid="cabinetry-save"]'); await waitForSelectorReady('[data-testid="cabinetry-room-list"]');
  });
  await check("Copy Colours Only: Kitchen to Butler's Pantry preserves other sections", async () => {
    await configureRoom("butlers-pantry"); await page.click('[data-testid="cabinetry-save"]'); await waitForSelectorReady('[data-testid="cabinetry-room-list"]');
    const before = structuredClone(await roomSpecification("butlers-pantry"));
    await choose("Copy from room", "kitchen"); await choose("Copy to room", "butlers-pantry"); await clickText("Copy Colours Only");
    if (await page.$('[data-testid="cabinetry-room-list"]')) await openRoom("butlers-pantry");
    await review(); await page.click('[data-testid="cabinetry-save"]'); await waitForSelectorReady('[data-testid="cabinetry-room-list"]');
    const copied = await roomSpecification("butlers-pantry");
    assert.deepEqual(copied.finish, savedRooms.kitchen.finish);
    for (const section of ["configuration", "handles", "benchtop", "hardware", "specialFeatures"]) assert.deepEqual(copied[section], before[section]);
    assert.equal(copied.roomKey, "butlers-pantry");
  });
  await check("Copy Complete Specification preserves destination room identity", async () => {
    await choose("Copy from room", "kitchen"); await choose("Copy to room", "pantry"); await clickText("Copy Complete Specification");
    if (await page.$('[data-testid="cabinetry-room-list"]')) await openRoom("pantry");
    await review(); await page.click('[data-testid="cabinetry-save"]'); await waitForSelectorReady('[data-testid="cabinetry-room-list"]');
    const copied = await roomSpecification("pantry");
    for (const section of ["configuration", "finish", "internals", "kickboard", "handles", "benchtop", "hardware", "specialFeatures"]) assert.deepEqual(copied[section], savedRooms.kitchen[section]);
    assert.equal(copied.roomKey, "pantry"); assert.equal(copied.roomLabel, "Pantry");
  });
  await check("Finish Cabinetry returns to main Client Selections and saved rooms reopen", async () => {
    await page.click('[data-testid="cabinetry-finish"]'); await waitForSelectorReady('[data-testid="showroom-choose-area"]');
    await openCabinetry(); await assertHydratedFields("kitchen", savedRooms.kitchen);
  });
  await check("Leave Client Selections, reopen project/session, and hydrate persisted rooms", async () => {
    await page.goto("about:blank");
    await page.goto(`${baseUrl}/modules/builders/client-selections`, { waitUntil: "domcontentloaded" });
    await selectProject(); await openCabinetry();
    for (const key of ["kitchen", "laundry", "bathroom"]) await assertHydratedFields(key, savedRooms[key]);
  });
  await check("A new browser tab reopens the saved project/session and hydrates the room", async () => {
    const oldPage = page;
    page = await createPage(); await oldPage.close();
    await page.goto(`${baseUrl}/modules/builders/client-selections`, { waitUntil: "domcontentloaded" });
    await selectProject(); await openCabinetry(); await assertHydratedFields("bathroom", savedRooms.bathroom);
  });
  await check("Delayed selection load hydrates an already opened room", async () => {
    delaySelectionReads = 2500;
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction((id) => [...document.querySelectorAll(".setupControls label:nth-child(1) select option")].some((option) => option.value === id), {}, projectId);
    await page.select(".setupControls label:nth-child(1) select", projectId);
    await openCabinetry(); await openRoom("kitchen");
    await page.waitForFunction(() => document.querySelector('[aria-label="Base cabinets quantity"]')?.value === "8");
    delaySelectionReads = 0;
    await clickText("Room List");
  });
  await check("Switching session never hydrates another session's rooms", async () => {
    await page.select(".setupControls label:nth-child(3) select", otherSessionId);
    await openRoom("kitchen");
    const checkbox = await field("Base cabinets", 'input[type="checkbox"]'); assert.equal(await checkbox.evaluate((input) => input.checked), false); await checkbox.dispose();
    await clickText("Room List");
    await page.select(".setupControls label:nth-child(3) select", sessionId);
    await assertHydratedFields("kitchen", savedRooms.kitchen);
  });
  await check("First-session insert failure preserves all room edits; retry saves in the chosen snapshot", async () => {
    await page.select(".setupControls label:nth-child(2) select", newSnapshotId);
    await page.waitForFunction(() => document.querySelector(".setupControls label:nth-child(3) select")?.value === "");
    await configureRoom("kitchenette");
    rejectNextSelectionInsert = true;
    await page.click('[data-testid="cabinetry-save"]');
    await page.waitForFunction(() => document.body.innerText.includes("Injected insert failure"));
    assert.equal(tables.builder_selection_sessions.filter((row) => row.snapshot_id === newSnapshotId).length, 1);
    if (await page.$('[data-testid="cabinetry-step-configuration"]')) {
      assert.equal(await page.$eval('[aria-label="Base cabinets quantity"]', (input) => input.value), "2", "Draft survives newly created session scope");
      await review();
    }
    await page.click('[data-testid="cabinetry-save"]'); await waitForSelectorReady('[data-testid="cabinetry-room-list"]');
    const inserted = activeRows().find((row) => row.snapshot_id === newSnapshotId && row.selected_details?.roomKey === "kitchenette");
    assert.ok(inserted); assert.ok(inserted.selected_details.cabinetryRoom.finish.productId); assert.ok(inserted.selected_details.cabinetryRoom.benchtop.product.productId);
    assert.equal(inserted.session_id, tables.builder_selection_sessions.find((row) => row.snapshot_id === newSnapshotId).id);
    await page.select(".setupControls label:nth-child(3) select", sessionId);
    await page.waitForFunction((id) => document.querySelector(".setupControls label:nth-child(2) select")?.value === id, {}, snapshotId);
    await assertHydratedFields("kitchen", savedRooms.kitchen);
  });
  await check("Repeated Cabinetry navigation remains stable in Chrome", async () => {
    const cdp = await page.createCDPSession();
    for (let cycle = 0; cycle < 12; cycle++) {
      await openRoom("kitchen"); await next("finish"); await next("internals"); await clickText("Room List");
      await cdp.send("HeapProfiler.collectGarbage");
      memory.push({ cycle, ...(await page.metrics()) });
    }
    await cdp.detach();
    const settled = memory.slice(3).map((entry) => entry.JSHeapUsedSize);
    assert.ok(Math.max(...settled) - Math.min(...settled) < 24 * 1024 * 1024, "Post-GC heap remains bounded after warm-up");
    assert.equal(runtimeErrors.length, 0, runtimeErrors.join("\n"));
  });
  await page.screenshot({ path: path.join(outDir, "room-list.png"), fullPage: false });
  assert.deepEqual(runtimeErrors, []);
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify({ passed: true, scope: "Actual Next route, isolated Supabase HTTP fixtures; no live database writes", checks, memory, loads, writes, runtimeErrors }, null, 2));
} catch (error) {
  if (page && !page.isClosed()) {
    await page.screenshot({ path: path.join(outDir, "failure.png"), fullPage: false }).catch(() => {});
    fs.writeFileSync(path.join(outDir, "failure.txt"), await page.evaluate(() => document.body.innerText).catch(() => "Page unavailable"));
  }
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify({ passed: false, message: error.message, checks, memory, loads, writes, runtimeErrors }, null, 2));
  throw error;
} finally { await browser.close(); }
