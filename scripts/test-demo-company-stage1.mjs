import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

const migration = read("supabase/migrations/20260817000000_demo_company_stage1.sql");
assert.match(migration, /add column if not exists is_demo boolean not null default false/i);
assert.match(migration, /'00000000-0000-4000-8000-000000000001'/);
assert.match(migration, /'Gr8 Result Demo Company'/);
assert.match(migration, /'gr8-result-demo'/);
assert.match(migration, /demo_action_log/);
assert.match(migration, /reset_demo_company_stage1/);
assert.match(migration, /id <> '00000000-0000-4000-8000-000000000001'[\s\S]*is_demo is distinct from false/i);

const demoWorkspace = read("lib/demoWorkspace.js");
assert.match(demoWorkspace, /export const DEMO_WORKSPACE_ID = "00000000-0000-4000-8000-000000000001"/);
assert.match(demoWorkspace, /export async function isDemoWorkspace/);
assert.match(demoWorkspace, /\.from\("workspaces"\)[\s\S]*\.select\("id, is_demo"\)/);
assert.match(demoWorkspace, /export async function ensureDemoCompanyForUser/);
assert.match(demoWorkspace, /\.from\("workspace_members"\)[\s\S]*\.upsert/);
assert.match(demoWorkspace, /export async function demoSimulationResult/);

const workspacesApi = read("pages/api/workspaces/index.js");
assert.match(workspacesApi, /ensureDemoCompanyForUser\(user\.id\)/);
assert.match(workspacesApi, /workspace:workspaces\(id, name, slug, plan, is_demo, created_at\)/);
assert.match(workspacesApi, /is_demo: false/);

const withWorkspace = read("lib/withWorkspace.js");
assert.match(withWorkspace, /getWorkspaceDemoState/);
assert.match(withWorkspace, /req\.isDemoWorkspace = demoState\.isDemo/);

const layout = read("components/Layout.js");
assert.match(layout, /isDemoWorkspace && <DemoCompanyBadge/);
assert.match(layout, /DEMO COMPANY/);

const dashboard = read("pages/dashboard.js");
assert.match(dashboard, /\.from\("workspace_entitlements"\)[\s\S]*\.eq\("workspace_id", workspaceId\)/);
assert.match(dashboard, /\.from\("leads"\)[\s\S]*\.eq\("workspace_id", workspaceId\)/);
assert.match(dashboard, /\.from\("email_sends"\)[\s\S]*\.eq\("workspace_id", workspaceId\)/);
assert.match(dashboard, /\.from\("sms_sent_history"\)[\s\S]*\.eq\("workspace_id", workspaceId\)/);

const calendarPrice = read("pages/api/calendar/create-stripe-price.js");
assert.match(calendarPrice, /\.from\("services"\)[\s\S]*\.eq\("workspace_id", req\.workspaceId\)/);

const outboundFiles = [
  ["lib/sendEmail.js", /Demo email simulated/],
  ["lib/email/broadcastSender.js", /Demo broadcast email simulated/],
  ["lib/smsglobal/index.js", /Demo SMS simulated/],
  ["pages/api/telephony/make-call.js", /Demo phone call simulated/],
  ["pages/api/twilio/test-call.js", /Demo phone call simulated/],
  ["pages/api/twilio/voice-client.js", /Demo phone call simulated/],
  ["pages/api/stripe/create-checkout-session.js", /Demo Stripe Checkout simulated/],
  ["pages/api/billing/checkout.js", /Demo billing checkout simulated/],
  ["pages/api/stripe/create-connect-account.js", /Demo Stripe Connect onboarding simulated/],
  ["pages/api/stripe/create-connect-link.js", /Demo Stripe Connect link simulated/],
  ["pages/api/calendar/create-stripe-price.js", /Demo Stripe price simulated/],
  ["pages/api/websites/publish.js", /Demo website publish simulated/],
  ["pages/api/websites/verify-domain.js", /Demo custom domain verification simulated/],
  ["pages/api/social/publish-now.js", /Demo social publish simulated/],
  ["pages/api/social/process-queue.js", /Demo social queue publish simulated/],
  ["pages/api/social/process-schedule.js", /Demo social schedule simulated/],
];

for (const [path, pattern] of outboundFiles) {
  assert.match(read(path), pattern, `${path} should simulate demo outbound work`);
}

const verifyDomain = read("pages/api/websites/verify-domain.js");
assert.match(verifyDomain, /\.select\("id, user_id, workspace_id,[^"]*primary_domain,[^"]*custom_domain,[^"]*domain_status"\)/);
assert.match(verifyDomain, /recordQuery = recordQuery\.eq\("workspace_id", workspaceId\)/);
assert.match(verifyDomain, /updateQuery = updateQuery\.eq\("workspace_id", workspaceId\)/);

const crmFiles = [
  "pages/modules/email/crm/kanban.js",
  "pages/modules/email/crm/tasks/index.js",
  "pages/modules/email/crm/deals.js",
];

for (const path of crmFiles) {
  assert.match(read(path), /useWorkspace/);
  assert.match(read(path), /workspaceId/);
  assert.match(read(path), /\.eq\(["']workspace_id["'], workspaceId\)/, `${path} should scope Supabase operations by workspace_id`);
}

console.log("test-demo-company-stage1.mjs passed");
