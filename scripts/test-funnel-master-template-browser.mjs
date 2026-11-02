import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import net from "node:net";
import puppeteer from "puppeteer";
import { startMockSupabase } from "./lib/mock-supabase-server.mjs";
import { composeDocument } from "../lib/landing-pages/generator.js";
import { templateContent } from "../lib/funnels/templateContent.js";
import { assertWindowsTestMemory, captureOwnedProcessIdentity, terminateOwnedProcessTree } from "./lib/owned-test-process.mjs";

const APP_PORT = Number(process.env.FUNNEL_E2E_PORT || 3110);
const DB_PORT = Number(process.env.FUNNEL_E2E_DB_PORT || 54410);
const APP = `http://127.0.0.1:${APP_PORT}`;
const WAIT_MS = Number(process.env.FUNNEL_E2E_WAIT_MS || 240_000);
const NAV_MS = Number(process.env.FUNNEL_E2E_NAV_MS || Math.max(420_000, WAIT_MS * 2));
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = process.env.FUNNEL_E2E_OUT || `artifacts/funnel-master-template-e2e/${RUN_ID}`;
const DIST = process.env.FUNNEL_E2E_DIST_DIR || `.next-funnel-template-e2e-${Date.now()}`;
const DIST_PATH = path.resolve(DIST);

assert.notEqual(APP_PORT, 3000, "The Funnel Builder acceptance server must never use port 3000.");
assert.notEqual(DB_PORT, 3000, "The mock database must not use port 3000.");
assert(!fs.existsSync(DIST_PATH), `Refusing to overwrite an existing isolated Next output: ${DIST_PATH}`);
fs.mkdirSync(OUT, { recursive: true });

const ADMIN = { id: "a0000000-0000-4000-8000-0000000000e1", email: "admin@funnel.test", password: "e2e-password" };
const BUILDER_B = { id: "b0000000-0000-4000-8000-0000000000e2", email: "builder-b@funnel.test", password: "e2e-password" };
const BUILDER_C = { id: "c0000000-0000-4000-8000-0000000000e3", email: "builder-c@funnel.test", password: "e2e-password" };
const WS_ADMIN = "aaaaaaaa-0000-4000-8000-0000000000e1";
const WS_B = "bbbbbbbb-0000-4000-8000-0000000000e2";
const WS_C = "cccccccc-0000-4000-8000-0000000000e3";
const SOURCE_FUNNEL = "dddddddd-0000-4000-8000-0000000000e1";
const SOURCE_LIST = "eeeeeeee-0000-4000-8000-0000000000e1";
const BUILDER_B_LIST = "eeeeeeee-0000-4000-8000-0000000000e2";
const sourceSteps = [
  { title: "Offer", content: `<section><h1>Original GR8 Offer</h1><p>First original page.</p><form id="funnel-native-form" method="post" action="/api/forms/submit"><input type="hidden" name="list_id" value="${SOURCE_LIST}"><input type="hidden" name="notify_to" value="private-admin@example.test"><label>Name<input name="name"></label><label>Email<input name="email" type="email" required></label><label>Phone<input name="phone"></label><button type="submit">Send enquiry</button></form></section>`, order_index: 0 },
  { title: "Thank you", content: "<section><h1>Original thank you</h1><p>Second original page.</p></section>", order_index: 1 },
];
const SOURCE_CAMPAIGN = "dddddddd-0000-4000-8000-0000000000f1";
const SOURCE_CAMPAIGN_PAGE = "dddddddd-0000-4000-8000-0000000000f2";
const SOURCE_CAMPAIGN_SECOND = "dddddddd-0000-4000-8000-0000000000f3";
const campaignDocument = composeDocument({
  campaignName: "GR8 JSON Campaign Master", businessName: "Original campaign business",
  objective: "enquiries", offering: "Custom designs", audience: "Families", serviceArea: "Queensland",
}).document;
campaignDocument.sections.find((section) => section.type === "hero").props.headline = "Original JSON Campaign Offer";
campaignDocument.sections.find((section) => section.type === "hero").props.primaryCta.href = "/lp/json-source-second#enquire";
const secondCampaignDocument = structuredClone(campaignDocument);
secondCampaignDocument.sections.find((section) => section.type === "hero").props.headline = "Original JSON Next Step";
const seedSql = `
  insert into auth.users values
    ('${ADMIN.id}','${ADMIN.email}','${ADMIN.password}'),
    ('${BUILDER_B.id}','${BUILDER_B.email}','${BUILDER_B.password}'),
    ('${BUILDER_C.id}','${BUILDER_C.email}','${BUILDER_C.password}');
  insert into accounts (user_id, email, business_name, full_name, is_approved, approved, status, subscription_status, onboarding_completed, phone_verified) values
    ('${ADMIN.id}','${ADMIN.email}','GR8 Administrator','Admin',true,true,'active','active',true,true),
    ('${BUILDER_B.id}','${BUILDER_B.email}','Builder B','Builder B',true,true,'active','active',true,true),
    ('${BUILDER_C.id}','${BUILDER_C.email}','Builder C','Builder C',true,true,'active','active',true,true);
  insert into workspaces (id, name, slug, owner_id, plan, is_demo) values
    ('${WS_ADMIN}','GR8 Admin','gr8-admin','${ADMIN.id}','professional',false),
    ('${WS_B}','Builder B','builder-b','${BUILDER_B.id}','professional',false),
    ('${WS_C}','Builder C','builder-c','${BUILDER_C.id}','professional',false);
  insert into workspace_members (workspace_id, user_id, role, status) values
    ('${WS_ADMIN}','${ADMIN.id}','owner','active'),
    ('${WS_B}','${BUILDER_B.id}','owner','active'),
    ('${WS_C}','${BUILDER_C.id}','owner','active');
  create table public.email_lists (
    id uuid primary key,
    user_id uuid not null,
    name text not null,
    created_at timestamptz not null default now()
  );
  insert into email_lists (id, user_id, name) values
    ('${SOURCE_LIST}','${ADMIN.id}','Admin private list'),
    ('${BUILDER_B_LIST}','${BUILDER_B.id}','Builder B private list');
  create table subscribers(id uuid primary key default gen_random_uuid(),user_id uuid not null,name text,email text,created_at timestamptz default now(),unique(user_id,email));
  create table list_subscribers(id uuid primary key default gen_random_uuid(),list_id uuid references email_lists(id),subscriber_id uuid references subscribers(id),unique(list_id,subscriber_id));
  create table form_submissions(id uuid primary key default gen_random_uuid(),user_id uuid,funnel_id uuid,step_id uuid,list_id uuid,name text,email text,payload jsonb);
  create table public.funnels (
    id uuid primary key default gen_random_uuid(),
    owner_user_id uuid not null,
    workspace_id uuid,
    name text not null,
    description text,
    notify_email text,
    default_list_id uuid,
    slug text unique,
    status text not null default 'draft',
    is_master_template boolean not null default false,
    template_description text,
    template_thumbnail text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  create table public.funnel_steps (
    id uuid primary key default gen_random_uuid(),
    funnel_id uuid not null references public.funnels(id) on delete cascade,
    title text not null,
    content text not null default '',
    order_index integer not null default 0,
    updated_at timestamptz not null default now()
  );
  ${fs.readFileSync("supabase/migrations/20261101000100_funnel_master_templates.sql", "utf8")}
  ${fs.readFileSync("supabase/migrations/20261101000200_crm_lead_notes_access.sql", "utf8")}
  ${fs.readFileSync("supabase/migrations/20261101000300_campaign_master_templates.sql", "utf8")}
  ${fs.readFileSync("supabase/migrations/20261101000400_funnel_form_crm.sql", "utf8")}
  insert into funnels (id, owner_user_id, workspace_id, name, description, notify_email, default_list_id, status)
  values ('${SOURCE_FUNNEL}','${ADMIN.id}','${WS_ADMIN}','GR8 Quote Master','Original source description','private-admin@example.test','${SOURCE_LIST}','draft');
  insert into funnel_steps (funnel_id, title, content, order_index) values
    ('${SOURCE_FUNNEL}','Offer','${sourceSteps[0].content}',0),
    ('${SOURCE_FUNNEL}','Thank you','${sourceSteps[1].content}',1);
  insert into landing_campaigns (id,workspace_id,created_by,name,status,brief)
    values ('${SOURCE_CAMPAIGN}','${WS_ADMIN}','${ADMIN.id}','GR8 JSON Campaign Master','active','{}');
  insert into landing_pages(id,workspace_id,campaign_id,created_by,title,slug,document) values
    ('${SOURCE_CAMPAIGN_PAGE}','${WS_ADMIN}','${SOURCE_CAMPAIGN}','${ADMIN.id}','Campaign offer','json-source-first','${JSON.stringify(campaignDocument).replace(/'/g, "''")}'),
    ('${SOURCE_CAMPAIGN_SECOND}','${WS_ADMIN}','${SOURCE_CAMPAIGN}','${ADMIN.id}','Campaign next step','json-source-second','${JSON.stringify(secondCampaignDocument).replace(/'/g, "''")}');
  insert into landing_page_versions(workspace_id,page_id,version_no,kind,document,created_by)
    select workspace_id,id,1,'publish',document,created_by from landing_pages where campaign_id='${SOURCE_CAMPAIGN}';
  update landing_pages p set status='published',published_version_id=v.id
    from landing_page_versions v where p.id=v.page_id and p.campaign_id='${SOURCE_CAMPAIGN}';
`;

const results = [];
const step = async (name, run) => {
  const started = Date.now();
  try {
    await run();
    results.push({ name, ok: true, milliseconds: Date.now() - started });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error: error.message, milliseconds: Date.now() - started });
    throw error;
  }
};
const waitForHttp = async (url, timeoutMs) => {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${url}`);
};
const ensurePortFree = (port) => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once("error", reject);
  server.listen(port, "127.0.0.1", () => server.close(resolve));
});
const waitForText = (page, text) => page.waitForFunction(
  (value) => document.body.innerText.includes(value),
  { timeout: WAIT_MS },
  text,
);
const clickButton = async (page, text) => {
  await page.waitForFunction((value) => [...document.querySelectorAll("button")]
    .some((button) => button.innerText.includes(value) && !button.disabled), { timeout: WAIT_MS }, text);
  await page.evaluate((value) => {
    const button = [...document.querySelectorAll("button")]
      .find((candidate) => candidate.innerText.includes(value) && !candidate.disabled);
    button?.click();
  }, text);
};
const fill = async (page, selector, value) => {
  await page.waitForSelector(selector, { timeout: WAIT_MS });
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.type(selector, value);
};
const tokenFor = (mock, user) => JSON.stringify(mock.session(user));
const addSession = async (page, session) => {
  await page.evaluateOnNewDocument((value) => localStorage.setItem("sb-127-auth-token", value), session);
};
const stubOptionalAssetLibrary = async (page) => {
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/assets/list-library") {
      void request.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, images: [], videos: [] }),
      });
    } else {
      void request.continue();
    }
  });
};
const inspectEditorAccess = async (page) => page.evaluate(() => {
  const button = [...document.querySelectorAll("button")]
    .find((candidate) => candidate.innerText.includes("Save as Master Template"));
  const editorError = [...document.querySelectorAll("p")]
    .find((paragraph) => paragraph.innerText.startsWith("Editor failed to load:"));
  return {
    buttonExists: Boolean(button),
    buttonDisabled: button?.disabled ?? null,
    editorError: editorError?.innerText || null,
    loadingText: document.body.innerText.includes("Loading…"),
    editorCanvasExists: Boolean(document.querySelector("#gjs")),
  };
});

let mock, next, browser, nextIdentity;
async function cleanup() {
  const errors = [];
  try { await browser?.close(); } catch (error) { errors.push(`Browser cleanup failed: ${error.message}`); }
  try { await terminateOwnedProcessTree(next, nextIdentity, { port: APP_PORT, workspace: process.cwd() }); } catch (error) { errors.push(`Next cleanup failed: ${error.message}`); }
  try { await mock?.close(); } catch (error) { errors.push(`Mock database cleanup failed: ${error.message}`); }
  if (fs.existsSync(DIST_PATH)) {
    try { fs.rmSync(DIST_PATH, { recursive: true, force: true }); } catch (error) { errors.push(`Isolated build cleanup failed: ${error.message}`); }
  }
  for (const error of errors) console.error(error);
  if (errors.length) process.exitCode = 1;
}

try {
  await assertWindowsTestMemory();
  await ensurePortFree(APP_PORT);
  await ensurePortFree(DB_PORT);
  mock = await startMockSupabase({ port: DB_PORT, seedSql });
  const env = {
    ...process.env,
    NEXT_DIST_DIR: DIST,
    PORT: String(APP_PORT),
    NODE_ENV: "development",
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PUBLIC_SUPABASE_URL: mock.url,
    SUPABASE_URL: mock.url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-funnel-e2e",
    SUPABASE_SERVICE_ROLE_KEY: "service-funnel-e2e",
    SUPABASE_SERVICE_KEY: "service-funnel-e2e",
    FUNNEL_PREVIEW_SECRET: "isolated-funnel-preview-secret",
    OPENAI_API_KEY: "",
    SENDGRID_API_KEY: "",
    RESEND_API_KEY: "",
    GR8_MAIL_SEND_ONLY: "",
  };
  next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(APP_PORT)], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const serverLog = fs.createWriteStream(path.join(OUT, "next-dev.log"));
  next.stdout.pipe(serverLog);
  next.stderr.pipe(serverLog);
  if (process.platform === "win32") nextIdentity = await captureOwnedProcessIdentity(next, { port: APP_PORT, workspace: process.cwd() });
  await waitForHttp(`${APP}/api/ping`, WAIT_MS);
  for (const route of [
    "/api/workspaces", "/api/workspaces/activate-invite", "/api/usage/check-limits",
    "/api/funnels/manage", "/api/account/branding", "/api/funnels/templates",
    "/api/funnels/preview-token", "/api/funnels/public-page",
    `/modules/funnels/edit/${SOURCE_FUNNEL}`, "/modules/funnels/templates", "/p/isolated-warmup",
    `/modules/landing-pages/editor/${SOURCE_CAMPAIGN_PAGE}`,
  ]) {
    await waitForHttp(`${APP}${route}`, NAV_MS);
  }
  browser = await puppeteer.launch({ headless: true, protocolTimeout: Math.max(600_000, NAV_MS + 120_000), args: ["--no-sandbox", "--disable-gpu"] });

  const adminPage = await browser.newPage();
  adminPage.on("pageerror", (error) => console.error(`[isolated admin page] ${error.message}`));
  adminPage.setDefaultNavigationTimeout(NAV_MS);
  await stubOptionalAssetLibrary(adminPage);
  await addSession(adminPage, tokenFor(mock, ADMIN));
  adminPage.on("dialog", async (dialog) => {
    if (dialog.type() === "prompt") await dialog.accept("A tested GR8 Result master funnel.");
    else await dialog.accept();
  });
  await step("administrator promotes an existing multi-step funnel as a master", async () => {
    await adminPage.goto(`${APP}/modules/funnels/edit/${SOURCE_FUNNEL}`, { waitUntil: "domcontentloaded", timeout: NAV_MS });
    await waitForText(adminPage, "GR8 Quote Master");
    const workspaceResponse = await fetch(`${APP}/api/workspaces`, {
      headers: { Authorization: `Bearer ${mock.session(ADMIN).access_token}` },
    });
    const workspaceBody = await workspaceResponse.json();
    assert.equal(workspaceResponse.status, 200, "administrator workspace membership must load");
    assert(workspaceBody.workspaces.some((workspace) => ["owner", "admin"].includes(workspace.role)), "administrator role missing");
    try {
      await adminPage.waitForFunction(() => {
        const button = [...document.querySelectorAll("button")]
          .find((candidate) => candidate.innerText.includes("Save as Master Template"));
        return button && !button.disabled;
      }, { timeout: WAIT_MS });
    } catch (error) {
      const state = await inspectEditorAccess(adminPage);
      throw new Error(`Editor did not become ready; button readiness state: ${JSON.stringify(state)}; cause: ${error.message}`);
    }
    const [promotionResponse] = await Promise.all([
      adminPage.waitForResponse((response) => response.url().endsWith("/api/funnels/templates") && response.request().method() === "POST", { timeout: WAIT_MS }),
      clickButton(adminPage, "Save as Master Template"),
    ]);
    assert.equal(promotionResponse.status(), 200, await promotionResponse.text());
    const { rows } = await mock.pg.query(
      "select is_master_template, template_description, notify_email, default_list_id from funnels where id = $1",
      [SOURCE_FUNNEL],
    );
    assert.deepEqual(rows[0], {
      is_master_template: true,
      template_description: "A tested GR8 Result master funnel.",
      notify_email: "private-admin@example.test",
      default_list_id: SOURCE_LIST,
    });
  });

  const { rows: masterSteps } = await mock.pg.query(
    "select title, content, order_index from funnel_steps where funnel_id = $1 order by order_index",
    [SOURCE_FUNNEL],
  );
  const subscriberContext = await browser.createBrowserContext();
  const subscriberPage = await subscriberContext.newPage();
  subscriberPage.setDefaultNavigationTimeout(NAV_MS);
  await stubOptionalAssetLibrary(subscriberPage);
  await addSession(subscriberPage, tokenFor(mock, BUILDER_B));
  subscriberPage.on("dialog", async (dialog) => { await dialog.accept(); });
  await step("subscriber browses and previews both master funnel steps on desktop and mobile", async () => {
    await subscriberPage.goto(`${APP}/modules/funnels/templates`, { waitUntil: "domcontentloaded", timeout: NAV_MS });
    await waitForText(subscriberPage, "GR8 Quote Master");
    assert.equal(await subscriberPage.$eval("section[aria-label='Master template catalogue']", (el) => el.querySelectorAll("button").length), 1);
    await clickButton(subscriberPage, "GR8 Quote Master");
    await subscriberPage.waitForSelector("section[aria-label='Template preview'] iframe", { timeout: WAIT_MS });
    let iframeTitle = await subscriberPage.$eval("section[aria-label='Template preview'] iframe", (el) => el.title);
    assert.match(iframeTitle, /Offer/);
    await clickButton(subscriberPage, "Thank you");
    await subscriberPage.waitForFunction(() => document.querySelector("section[aria-label='Template preview'] iframe")?.title.includes("Thank you"), { timeout: WAIT_MS });
    await clickButton(subscriberPage, "Mobile");
    const mobileWidth = await subscriberPage.$eval("section[aria-label='Template preview'] iframe", (el) => el.style.width);
    assert.equal(mobileWidth, "390px");
    await clickButton(subscriberPage, "Desktop");
  });

  let copyBId;
  await step("subscriber clones the master into an independent draft with no inherited CRM settings", async () => {
    const copyName = "Builder B Independent Funnel";
    await fill(subscriberPage, "input[maxlength='160']", copyName);
    await clickButton(subscriberPage, "Create from Template");
    await subscriberPage.waitForFunction(() => /\/modules\/funnels\/edit\/[0-9a-f-]{36}$/.test(location.pathname), { timeout: WAIT_MS });
    copyBId = subscriberPage.url().split("/").pop();
    await waitForText(subscriberPage, copyName);
    const { rows } = await mock.pg.query(
      "select owner_user_id, workspace_id, name, status, notify_email, default_list_id, is_master_template from funnels where id = $1",
      [copyBId],
    );
    assert.deepEqual(rows[0], {
      owner_user_id: BUILDER_B.id,
      workspace_id: WS_B,
      name: copyName,
      status: "draft",
      notify_email: null,
      default_list_id: null,
      is_master_template: false,
    });
    const { rows: copiedSteps } = await mock.pg.query(
      "select title, content, order_index from funnel_steps where funnel_id = $1 order by order_index",
      [copyBId],
    );
    assert.deepEqual(copiedSteps, masterSteps.map((step) => ({ ...step, content: templateContent(step.content) })), "deep copy includes every page without the master's private routing fields");
  });

  await step("subscriber edits and saves CRM routing and funnel details, then reopens the draft", async () => {
    await fill(subscriberPage, 'input[placeholder="Funnel name"]', "Builder B Edited Funnel");
    await fill(subscriberPage, 'input[placeholder="public-url-slug"]', "builder-b-edited-funnel");
    await fill(subscriberPage, 'input[placeholder="alerts@yourdomain.com"]', "alerts@builder-b.example.test");
    await subscriberPage.select("select", BUILDER_B_LIST);
    const [saveResponse] = await Promise.all([
      subscriberPage.waitForResponse((response) => response.url().endsWith("/api/funnels/manage") && response.request().method() === "POST", { timeout: WAIT_MS }),
      clickButton(subscriberPage, "💾 Save"),
    ]);
    assert.equal(saveResponse.status(), 200, await saveResponse.text());
    const saved = await mock.pg.query(
      "select name, slug, notify_email, default_list_id, status from funnels where id = $1",
      [copyBId],
    );
    assert.deepEqual(saved.rows[0], {
      name: "Builder B Edited Funnel",
      slug: "builder-b-edited-funnel",
      notify_email: "alerts@builder-b.example.test",
      default_list_id: BUILDER_B_LIST,
      status: "draft",
    });
    await subscriberPage.reload({ waitUntil: "domcontentloaded", timeout: NAV_MS });
    await subscriberPage.waitForFunction(
      () => document.querySelector('input[placeholder="Funnel name"]')?.value === "Builder B Edited Funnel",
      { timeout: WAIT_MS },
    );
    assert.equal(await subscriberPage.$eval('input[placeholder="alerts@yourdomain.com"]', (el) => el.value), "alerts@builder-b.example.test");
  });

  await step("subscriber publishes, opens the public funnel, then unpublishes it", async () => {
    await clickButton(subscriberPage, "🚀 Publish");
    await waitForText(subscriberPage, "Published at");
    let status = await mock.pg.query("select status, slug from funnels where id = $1", [copyBId]);
    assert.deepEqual(status.rows[0], { status: "published", slug: "builder-b-edited-funnel" });
    const publicContext = await browser.createBrowserContext();
    const publicPage = await publicContext.newPage();
    publicPage.setDefaultNavigationTimeout(NAV_MS);
    await publicPage.goto(`${APP}/p/builder-b-edited-funnel`, { waitUntil: "domcontentloaded", timeout: NAV_MS });
    await waitForText(publicPage, "Original GR8 Offer");
    await fill(publicPage, '#funnel-native-form input[name="name"]', "Funnel browser visitor");
    await fill(publicPage, '#funnel-native-form input[name="email"]', "funnel-browser-visitor@example.test");
    await fill(publicPage, '#funnel-native-form input[name="phone"]', "0412345678");
    assert.equal(await publicPage.$('#funnel-native-form input[name="list_id"]'), null, "private master routing is absent from the copy");
    await publicPage.$eval("#funnel-native-form", (form, listId) => {
      const input = document.createElement("input"); input.type = "hidden"; input.name = "list_id"; input.value = listId; form.appendChild(input);
    }, SOURCE_LIST);
    const enquiry = await publicPage.$eval("#funnel-native-form", (form) => Object.fromEntries(new FormData(form)));
    assert.match(enquiry.submission_key, /^[0-9a-f-]{36}$/);
    await Promise.all([
      publicPage.waitForNavigation({ waitUntil: "domcontentloaded", timeout: NAV_MS }),
      publicPage.click('#funnel-native-form button[type="submit"]'),
    ]);
    await waitForText(publicPage, "Thank you!");
    const captured = (await mock.pg.query("select * from form_submissions where submission_key=$1", [enquiry.submission_key])).rows[0];
    assert.equal(captured.user_id, BUILDER_B.id);
    assert.equal(captured.workspace_id, WS_B);
    assert.equal(captured.list_id, BUILDER_B_LIST, "the master form's hidden list cannot route to the master owner");
    assert(captured.crm_synced_at, "native funnel enquiry reaches CRM");
    const replay = await publicPage.evaluate(async (body) => {
      const response = await fetch("/api/forms/submit", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    }, enquiry);
    assert.equal(replay.status, 200);
    assert.equal(replay.body.duplicate, true);
    assert.equal((await mock.pg.query("select id from lead_notes where lead_id=$1", [captured.crm_lead_id])).rows.length, 1);
    assert.equal((await mock.pg.query("select user_id from subscribers where email=$1", [enquiry.email])).rows[0].user_id, BUILDER_B.id);
    assert.equal((await mock.pg.query("select id from leads where user_id=$1", [ADMIN.id])).rows.length, 0);
    await publicPage.close();
    await publicContext.close();
    await clickButton(subscriberPage, "⏸ Unpublish");
    await subscriberPage.waitForFunction(() => document.body.innerText.includes("Draft — add a slug and publish when ready"), { timeout: WAIT_MS });
    status = await mock.pg.query("select status from funnels where id = $1", [copyBId]);
    assert.deepEqual(status.rows[0], { status: "draft" });
  });

  await step("page content edits survive saving and reopening without altering the master", async () => {
    await subscriberPage.waitForFunction(() => window.grapesjs?.editors?.some((editor) => editor.getWrapper()?.find("h1").length), { timeout: WAIT_MS });
    await subscriberPage.evaluate(() => {
      const editor = window.grapesjs.editors.find((candidate) => candidate.getWrapper()?.find("h1").length);
      editor.getWrapper().find("h1")[0].components("Builder B saved page content");
    });
    const [saveResponse] = await Promise.all([
      subscriberPage.waitForResponse((response) => response.url().endsWith("/api/funnels/manage") && response.request().method() === "POST", { timeout: WAIT_MS }),
      clickButton(subscriberPage, "Save Page"),
    ]);
    assert.equal(saveResponse.status(), 200, await saveResponse.text());
    const { rows: edited } = await mock.pg.query("select content from funnel_steps where funnel_id=$1 order by order_index", [copyBId]);
    assert.match(edited[0].content, /Builder B saved page content/);
    await subscriberPage.reload({ waitUntil: "domcontentloaded", timeout: NAV_MS });
    await subscriberPage.waitForFunction(() => window.grapesjs?.editors?.some((editor) => editor.getHtml().includes("Builder B saved page content")), { timeout: WAIT_MS });
    const { rows: unchanged } = await mock.pg.query(
      "select title, content, order_index from funnel_steps where funnel_id=$1 order by order_index",
      [SOURCE_FUNNEL],
    );
    assert.deepEqual(unchanged, masterSteps, "subscriber page edits leave the original master content unchanged");
  });

  let copyCId;
  const builderCContext = await browser.createBrowserContext();
  const builderCPage = await builderCContext.newPage();
  builderCPage.setDefaultNavigationTimeout(NAV_MS);
  await stubOptionalAssetLibrary(builderCPage);
  await addSession(builderCPage, tokenFor(mock, BUILDER_C));
  await step("a second subscriber clones the same master without sharing ownership or edits", async () => {
    await builderCPage.goto(`${APP}/modules/funnels/templates`, { waitUntil: "domcontentloaded", timeout: NAV_MS });
    await waitForText(builderCPage, "GR8 Quote Master");
    await clickButton(builderCPage, "GR8 Quote Master");
    await builderCPage.waitForSelector("section[aria-label='Template preview'] iframe", { timeout: WAIT_MS });
    await fill(builderCPage, "input[maxlength='160']", "Builder C Independent Funnel");
    await clickButton(builderCPage, "Create from Template");
    await builderCPage.waitForFunction(() => /\/modules\/funnels\/edit\/[0-9a-f-]{36}$/.test(location.pathname), { timeout: WAIT_MS });
    copyCId = builderCPage.url().split("/").pop();
    const { rows } = await mock.pg.query(
      "select owner_user_id, workspace_id, status, notify_email, default_list_id from funnels where id = $1",
      [copyCId],
    );
    assert.deepEqual(rows[0], {
      owner_user_id: BUILDER_C.id,
      workspace_id: WS_C,
      status: "draft",
      notify_email: null,
      default_list_id: null,
    });
    assert.notEqual(copyCId, copyBId);
    const { rows: copyCSteps } = await mock.pg.query(
      "select title, content, order_index from funnel_steps where funnel_id=$1 order by order_index",
      [copyCId],
    );
    assert.deepEqual(copyCSteps, masterSteps.map((step) => ({ ...step, content: templateContent(step.content) })), "builder C does not inherit builder B's edits or master routing settings");
    assert.equal((await mock.pg.query("select name from funnels where id = $1", [SOURCE_FUNNEL])).rows[0].name, "GR8 Quote Master");
  });

  await step("private funnels, draft previews, and preview-token issuance are tenant scoped", async () => {
    const tokenB = mock.session(BUILDER_B).access_token;
    const foreignFunnel = await subscriberPage.evaluate(async ({ id, token, workspaceId }) => {
      const response = await fetch(`/api/funnels/manage?id=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}`, "x-workspace-id": workspaceId },
      });
      return response.status;
    }, { id: copyCId, token: tokenB, workspaceId: WS_B });
    assert.equal(foreignFunnel, 404, "builder B cannot load builder C's funnel");

    const foreignTokenStatus = await subscriberPage.evaluate(async ({ id, token, workspaceId }) => {
      const response = await fetch("/api/funnels/preview-token", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "x-workspace-id": workspaceId, "Content-Type": "application/json" },
        body: JSON.stringify({ funnelId: id }),
      });
      return response.status;
    }, { id: copyCId, token: tokenB, workspaceId: WS_B });
    assert.equal(foreignTokenStatus, 404, "builder B cannot mint a preview token for builder C");

    const noToken = await (await fetch(`${APP}/api/funnels/public-page?preview=1&funnelId=${copyBId}`)).json();
    assert.equal(noToken.error, "Not found");
    const issued = await subscriberPage.evaluate(async ({ id, token, workspaceId }) => {
      const response = await fetch("/api/funnels/preview-token", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "x-workspace-id": workspaceId, "Content-Type": "application/json" },
        body: JSON.stringify({ funnelId: id }),
      });
      return { status: response.status, body: await response.json() };
    }, { id: copyBId, token: tokenB, workspaceId: WS_B });
    assert.equal(issued.status, 200);
    const allowed = await fetch(`${APP}/api/funnels/public-page?preview=1&funnelId=${copyBId}&previewToken=${encodeURIComponent(issued.body.token)}`);
    assert.equal(allowed.status, 200, "an owner's signed preview token opens only their draft");
    const wrongFunnel = await fetch(`${APP}/api/funnels/public-page?preview=1&funnelId=${copyCId}&previewToken=${encodeURIComponent(issued.body.token)}`);
    assert.equal(wrongFunnel.status, 404, "a token cannot be retargeted to another funnel");
  });
  await step("JSON campaign masters preview, clone and reopen in the native editor without changing published originals", async () => {
    const originals = (await mock.pg.query("select * from landing_pages where campaign_id=$1 order by id", [SOURCE_CAMPAIGN])).rows;
    await adminPage.goto(`${APP}/modules/landing-pages/editor/${SOURCE_CAMPAIGN_PAGE}`, { waitUntil: "domcontentloaded", timeout: NAV_MS });
    try {
      await adminPage.waitForSelector('[data-testid="save-campaign-master"]:not([disabled])', { timeout: 30_000 });
    } catch (error) {
      console.error("Campaign editor readiness:", await adminPage.evaluate(() => ({ url: location.pathname, text: document.body.innerText.slice(0, 1600), button: document.querySelector('[data-testid="save-campaign-master"]')?.outerHTML })));
      throw error;
    }
    const [promotion] = await Promise.all([
      adminPage.waitForResponse((response) => response.url().endsWith("/api/funnels/templates") && response.request().method() === "POST", { timeout: WAIT_MS }),
      adminPage.click('[data-testid="save-campaign-master"]'),
    ]);
    assert.equal(promotion.status(), 200, await promotion.text());
    await subscriberPage.goto(`${APP}/modules/funnels/templates`, { waitUntil: "domcontentloaded", timeout: NAV_MS });
    await clickButton(subscriberPage, "GR8 JSON Campaign Master");
    await subscriberPage.waitForSelector("section[aria-label='Template preview'] iframe", { timeout: WAIT_MS });
    let previewFrame = await (await subscriberPage.$("section[aria-label='Template preview'] iframe")).contentFrame();
    await previewFrame.waitForFunction(() => document.querySelector(".lp-s-hero h1")?.textContent === "Original JSON Campaign Offer", { timeout: WAIT_MS });
    await clickButton(subscriberPage, "Campaign next step");
    previewFrame = await (await subscriberPage.$("section[aria-label='Template preview'] iframe")).contentFrame();
    await previewFrame.waitForFunction(() => document.querySelector(".lp-s-hero h1")?.textContent === "Original JSON Next Step", { timeout: WAIT_MS });
    await clickButton(subscriberPage, "Mobile");
    assert.equal(await subscriberPage.$eval("section[aria-label='Template preview'] iframe", (frame) => frame.style.width), "390px");
    await clickButton(subscriberPage, "Campaign offer");
    await fill(subscriberPage, "input[maxlength='160']", "Builder B Native Campaign");
    const [cloning] = await Promise.all([
      subscriberPage.waitForResponse((response) => response.url().endsWith("/api/funnels/templates") && response.request().method() === "POST", { timeout: WAIT_MS }),
      clickButton(subscriberPage, "Create from Template"),
    ]);
    assert.equal(cloning.status(), 201, await cloning.text());
    const cloned = await cloning.json();
    await subscriberPage.waitForFunction(() => /\/modules\/landing-pages\/editor\/[0-9a-f-]{36}$/.test(location.pathname), { timeout: WAIT_MS });
    await subscriberPage.waitForSelector('[data-testid="canvas"] .lp-s-hero h1', { timeout: WAIT_MS });
    assert.equal(await subscriberPage.$eval('[data-testid="canvas"] .lp-s-hero h1', (node) => node.textContent), "Original JSON Campaign Offer");
    await subscriberPage.$eval('[data-testid="canvas"] .lp-s-hero h1', (node) => {
      node.focus(); node.innerText = "Subscriber JSON content"; node.blur();
    });
    await subscriberPage.waitForFunction(() => document.querySelector("header")?.textContent.includes("Unsaved"), { timeout: WAIT_MS });
    const [saving] = await Promise.all([
      subscriberPage.waitForResponse((response) => response.url().includes("/api/landing-pages/pages/") && response.request().method() === "PUT", { timeout: WAIT_MS }),
      subscriberPage.click('[data-testid="save"]'),
    ]);
    assert.equal(saving.status(), 200, await saving.text());
    await subscriberPage.waitForFunction(() => document.querySelector("header")?.textContent.includes("Saved") && !document.querySelector("header")?.textContent.includes("Unsaved"), { timeout: WAIT_MS });
    await subscriberPage.reload({ waitUntil: "domcontentloaded", timeout: NAV_MS });
    await subscriberPage.waitForFunction(() => document.querySelector('[data-testid="canvas"] .lp-s-hero h1')?.textContent === "Subscriber JSON content", { timeout: WAIT_MS });
    const campaign = (await mock.pg.query("select workspace_id,created_by,status from landing_campaigns where id=$1", [cloned.campaign.id])).rows[0];
    assert.deepEqual(campaign, { workspace_id: WS_B, created_by: BUILDER_B.id, status: "draft" });
    assert.equal(cloned.pageIds.length, 2);
    assert.deepEqual((await mock.pg.query("select * from landing_pages where campaign_id=$1 order by id", [SOURCE_CAMPAIGN])).rows, originals, "published originals and their live pointers are preserved");
  });
} catch (error) {
  process.exitCode = 1;
  console.error(error.stack || error);
} finally {
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ results }, null, 2));
  await cleanup();
  console.log(`\n${results.filter((result) => result.ok).length}/${results.length} Funnel Builder browser acceptance steps passed.`);
}
