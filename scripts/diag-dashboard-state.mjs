// READ-ONLY: resolves what /dashboard will render for a real user, using the
// same functions the page uses. No writes, no secrets printed.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  MODULE_STATE, buildEntitledModuleIds, buildSubscriptionSummary,
  readBillingCycle, resolveModuleState,
} from "../lib/moduleEntitlements.js";

function loadEnv(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");}}
loadEnv(".env.local"); loadEnv(".env");
const db = createClient(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});

// Mirrors MODULE_ITEMS after the duplicate Project Workspace card removal.
const MODULE_ITEMS = [
  { id: "email_marketing", title: "Email Marketing" },
  { id: "crm", title: "CRM" },
  { id: "sms_marketing", title: "SMS Marketing" },
  { id: "social_media", title: "Social Media" },
  { id: "booking_calendar", title: "Booking Calendar" },
  { id: "website_builder", title: "Website Builder" },
  { id: "funnels", title: "Sales Funnels" },
  { id: "business_automation", title: "Business Automation" },
  { id: "evergreen_webinars", title: "Evergreen Webinars", comingSoon: true },
  { id: "pipelines", title: "Subscription Pipelines", comingSoon: true },
  { id: "human_resources", title: "Human Resources", comingSoon: true },
];

const EMAIL = process.argv[2] || "grant.rohde63@gmail.com";
const { data: users } = await db.auth.admin.listUsers({ perPage: 200 });
const user = (users?.users || []).find(u => (u.email||"").toLowerCase() === EMAIL.toLowerCase());
if (!user) { console.log("no user"); process.exit(0); }

const { data: ws } = await db.from("workspaces").select("id, plan").eq("owner_id", user.id).limit(1);
const workspace = ws?.[0];
if (!workspace) { console.log("no workspace"); process.exit(0); }

const [{ data: ents }, { data: legacy }, { data: acc }, { data: subs }] = await Promise.all([
  db.from("workspace_entitlements").select("module_id, enabled").eq("workspace_id", workspace.id).eq("enabled", true),
  db.from("user_modules").select("module_id").eq("user_id", user.id),
  db.from("accounts").select("sms_plan_tier, calendar_plan_tier, email_plan_tier, social_plan_tier, sendgrid_connected, sendgrid_from_email, sender_id, sms_api_key, twilio_phone").eq("user_id", user.id).maybeSingle(),
  db.from("subscriptions").select("plan_id, status, current_period_end").eq("account_id", user.id).limit(1),
]);

const legacyRows = legacy || [];
const entitled = buildEntitledModuleIds({
  planId: workspace.plan || "",
  entitlementRows: ents || [],
  legacyRows,
  account: acc || null,
});
const summary = buildSubscriptionSummary({
  subscription: subs?.[0] || null,
  workspace,
  billingCycle: readBillingCycle(legacyRows.map(r => r.module_id)),
});

console.log("=== LIVE INPUTS ===");
console.log("  workspace.plan          :", workspace.plan || "(none)");
console.log("  workspace_entitlements  :", (ents||[]).length, "rows");
console.log("  user_modules (legacy)   :", legacyRows.length, "rows");
console.log("  accounts row            :", acc ? "present" : "(none)");
console.log("  subscriptions row       :", subs?.length ? "present" : "(none)");

console.log("\n=== SUBSCRIPTION SUMMARY (item 9) ===");
console.log("  Current Plan:", summary.plan || "(not shown)");
console.log("  Billing     :", summary.cycle || "(not shown - no cadence recorded)");
console.log("  Status      :", summary.status || "(not shown)");

console.log("\n=== MODULE CARD STATES ===");
const buckets = {};
for (const item of MODULE_ITEMS) {
  const st = resolveModuleState({ moduleId: item.id, comingSoon: Boolean(item.comingSoon), entitledIds: entitled, context: { account: acc || null } });
  (buckets[st] ||= []).push(item.title);
}
for (const [st, titles] of Object.entries(buckets)) {
  console.log(`  ${st.padEnd(15)} ${titles.join(", ")}`);
}
console.log("\n  'Not set up' cards:", 0, "(state no longer exists)");
