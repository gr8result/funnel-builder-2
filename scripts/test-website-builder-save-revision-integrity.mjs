import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: process.env.WB_ENV_FILE || ".env.local", quiet: true });

const BASE_URL = (process.env.WB_BROWSER_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const PROJECT_ID = "2208a52a-8175-477e-823c-fc6de7fe4afe";
const PAGE_NAME = "Pricing";
const OWNER_EMAIL = "support@gr8result.com";
const PROBE = `SAVE-PERSISTENCE-20260817-${Date.now()}`;

function assertPricingFeatureRowsKeepReadableTracks() {
  const source = fs.readFileSync("components/website-builder/WebsiteBlockRenderer.js", "utf8");
  assert.match(source, /gridTemplateColumns:\s*compact \? "1fr" : "minmax\(96px, 0\.82fr\) minmax\(112px, 1\.18fr\)"/);
  assert.doesNotMatch(source, /data-pricing-feature-row="true"[\s\S]{0,320}minmax\(0,1fr\) minmax\(72px,auto\)/);
  assert.doesNotMatch(source, /data-pricing-feature-row="true"[\s\S]{0,360}overflowWrap:\s*"anywhere"/);
  assert.doesNotMatch(source, /data-pricing-feature-row="true"[\s\S]{0,360}wordBreak:\s*"break-all"/);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value) {
  return crypto.createHash("sha256").update(stableJson(value ?? null)).digest("hex");
}

function pageState(project) {
  return {
    blocks: project?.pageBlocks?.[PAGE_NAME] || [],
    chai: project?.chaiData?.[PAGE_NAME] || null,
  };
}

function injectProbe(project, value) {
  const next = clone(project);
  const blocks = Array.isArray(next.pageBlocks?.[PAGE_NAME]) ? clone(next.pageBlocks[PAGE_NAME]) : [];
  assert.ok(blocks.length, "Expected Pricing blocks for save revision probe");
  blocks[0] = { ...blocks[0], props: { ...(blocks[0].props || {}), __savePersistenceProbe: value } };
  next.pageBlocks = { ...(next.pageBlocks || {}), [PAGE_NAME]: blocks };
  next.chaiData = { ...(next.chaiData || {}), [PAGE_NAME]: { ...(next.chaiData?.[PAGE_NAME] || {}), blocks } };
  next.pagesContent = { ...(next.pagesContent || {}), [PAGE_NAME]: "" };
  next.__saveBaseUpdatedAt = project.updatedAt || project.savedAt || project.createdAt || "";
  next.__saveBaseRevision = project.revision ?? project.saveRevision ?? "";
  next.__saveBasePageRevision = project.pageRevisions?.[PAGE_NAME] ?? "";
  next.__saveRequestId = `revision-race-${value}`;
  next.updatedAt = new Date().toISOString();
  return next;
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
  assert.ok(data?.session?.access_token, "Expected Supabase session");
  return data.session;
}

async function api(token, method = "GET", body = null) {
  const response = await fetch(`${BASE_URL}/api/website-builder/projects?projectId=${encodeURIComponent(PROJECT_ID)}&page=${encodeURIComponent(PAGE_NAME)}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
}

async function save(token, project, saveSource) {
  return api(token, "POST", {
    project,
    pageName: PAGE_NAME,
    siteOnly: false,
    saveSource,
    pageVersion: project.projectVersion || "",
    baseUpdatedAt: project.__saveBaseUpdatedAt || "",
    baseRevision: project.__saveBaseRevision ?? "",
    basePageRevision: project.__saveBasePageRevision ?? "",
    requestId: project.__saveRequestId || "",
  });
}

const session = await mintSession();
assertPricingFeatureRowsKeepReadableTracks();
const token = session.access_token;
const initial = await api(token);
assert.equal(initial.status, 200, initial.payload?.error || "Initial draft load failed");

const original = initial.payload.project;
const originalBlocks = clone(original.pageBlocks?.[PAGE_NAME] || []);
const beforeHash = hash(pageState(original));
let restoreResult = null;

try {
  const first = injectProbe(original, `${PROBE}-A`);
  const second = injectProbe(original, `${PROBE}-B`);
  const [firstResult, secondResult] = await Promise.all([
    save(token, first, "revision-race-A"),
    save(token, second, "revision-race-B"),
  ]);
  const statuses = [firstResult.status, secondResult.status].sort();
  assert.deepEqual(statuses, [200, 409], "Concurrent saves must produce exactly one commit and one stale rejection");
  const stale = [firstResult, secondResult].find((entry) => entry.status === 409);
  assert.equal(stale.payload?.code, "STALE_WEBSITE_REVISION");

  const after = await api(token);
  assert.equal(after.status, 200, "Post-race draft read failed");
  const storedProbe = after.payload.project?.pageBlocks?.[PAGE_NAME]?.[0]?.props?.__savePersistenceProbe || "";
  assert.ok(storedProbe === `${PROBE}-A` || storedProbe === `${PROBE}-B`, "Committed probe was not retained");
  assert.notEqual(hash(pageState(after.payload.project)), beforeHash, "Probe save did not change stored page hash");

  const restore = clone(after.payload.project);
  restore.pageBlocks = { ...(restore.pageBlocks || {}), [PAGE_NAME]: originalBlocks };
  restore.chaiData = { ...(restore.chaiData || {}), [PAGE_NAME]: { ...(restore.chaiData?.[PAGE_NAME] || {}), blocks: originalBlocks } };
  restore.pagesContent = { ...(restore.pagesContent || {}), [PAGE_NAME]: "" };
  restore.__saveBaseUpdatedAt = after.payload.project?.updatedAt || "";
  restore.__saveBaseRevision = after.payload.project?.revision ?? after.payload.project?.saveRevision ?? "";
  restore.__saveBasePageRevision = after.payload.project?.pageRevisions?.[PAGE_NAME] ?? "";
  restore.__saveRequestId = `revision-race-restore-${PROBE}`;
  restore.updatedAt = new Date().toISOString();
  restoreResult = await save(token, restore, "revision-race-restore");
  assert.equal(restoreResult.status, 200, restoreResult.payload?.error || "Restore save failed");

  const final = await api(token);
  assert.equal(final.status, 200, "Final draft read failed");
  assert.equal(final.payload.project?.pageBlocks?.[PAGE_NAME]?.[0]?.props?.__savePersistenceProbe || "", "");
  assert.equal(hash(pageState(final.payload.project)), beforeHash, "Restore did not return Pricing page to original hash");

  console.log(JSON.stringify({
    ok: true,
    baseUrl: BASE_URL,
    projectId: PROJECT_ID,
    pageName: PAGE_NAME,
    probe: PROBE,
    statuses: [firstResult.status, secondResult.status],
    committedRevision: [firstResult, secondResult].find((entry) => entry.status === 200)?.payload?.project?.revision ?? null,
    restoredRevision: restoreResult.payload?.project?.revision ?? null,
    finalHash: beforeHash,
  }, null, 2));
} catch (error) {
  if (!restoreResult) {
    const current = await api(token).catch(() => null);
    if (current?.payload?.project) {
      const restore = clone(current.payload.project);
      restore.pageBlocks = { ...(restore.pageBlocks || {}), [PAGE_NAME]: originalBlocks };
      restore.chaiData = { ...(restore.chaiData || {}), [PAGE_NAME]: { ...(restore.chaiData?.[PAGE_NAME] || {}), blocks: originalBlocks } };
      restore.__saveBaseRevision = current.payload.project?.revision ?? current.payload.project?.saveRevision ?? "";
      restore.__saveBasePageRevision = current.payload.project?.pageRevisions?.[PAGE_NAME] ?? "";
      restore.__saveRequestId = `revision-race-cleanup-${PROBE}`;
      await save(token, restore, "revision-race-cleanup").catch(() => null);
    }
  }
  throw error;
}
