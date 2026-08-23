/**
 * Website Builder content-lock regression test.
 *
 * Exercises protected -> unlock -> save -> save again -> relock entirely against an
 * ISOLATED FIXTURE project. The approved live website is never read, written or
 * published by this test; the fixture site row is deleted again at the end.
 */
import assert from "node:assert";
import crypto from "node:crypto";
import fs from "node:fs";

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Za-z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const LIVE_WEBSITE_PROJECT_ID = "2208a52a-8175-477e-823c-fc6de7fe4afe";
const FIXTURE_SITE_ID = `fixture-lock-${crypto.randomUUID()}`;

// Protect the fixture instead of the live website for the duration of this test.
process.env.WEBSITE_LOCK_PROTECTED_PROJECT_IDS = FIXTURE_SITE_ID;

const { supabaseAdmin } = await import("../lib/supabaseAdmin.js");
const lockMod = await import("../lib/website-builder/contentLock.js");
const storage = await import("../lib/website-builder/supabaseSiteStorage.js");

const {
  createWebsiteUnlockSession,
  isProtectedWebsiteProject,
  relockWebsite,
  assertWebsiteUnlockedForMutation,
  markWebsiteMutationCommitted,
  getWebsiteLockStatus,
  WEBSITE_LOCK_CONFIRMATION,
} = lockMod;

const USER_ID = "35ab846e-0764-498b-b1f8-7d2cf27d85a5";

function fixtureProject() {
  return {
    id: FIXTURE_SITE_ID,
    name: "Content lock fixture",
    slug: FIXTURE_SITE_ID,
    pages: [{ id: "home", name: "Home", slug: "home" }],
    pageBlocks: { Home: [{ id: "fixture-text", type: "text", props: { text: "fixture" } }] },
    pagesContent: {},
    chaiData: {},
  };
}

let failures = 0;
function check(label, fn) {
  try { fn(); console.log(`  PASS  ${label}`); }
  catch (e) { failures += 1; console.error(`  FAIL  ${label}\n        ${e?.message}`); }
}

async function checkAsync(label, fn) {
  try { await fn(); console.log(`  PASS  ${label}`); }
  catch (e) { failures += 1; console.error(`  FAIL  ${label}\n        ${e?.message}`); }
}

console.log(`fixture site: ${FIXTURE_SITE_ID}`);

// --- guard: the live website must never be the target of this test -------------
check("live website is NOT the protected id during this test", () => {
  assert.equal(isProtectedWebsiteProject(FIXTURE_SITE_ID), true, "fixture should be protected");
  assert.equal(isProtectedWebsiteProject(LIVE_WEBSITE_PROJECT_ID), false, "live website must not be targeted");
});

try {
  // --- 1. protected: unauthorised save is refused -------------------------------
  await checkAsync("protected website refuses a save with no unlock session (423)", async () => {
    await assert.rejects(
      () => storage.saveSplitWebsiteProject(USER_ID, fixtureProject(), { backupSource: "automated-test" }),
      (err) => {
        assert.equal(err.code, "WEBSITE_LOCKED", `expected WEBSITE_LOCKED, got ${err.code}`);
        assert.equal(err.status, 423, `expected 423, got ${err.status}`);
        return true;
      }
    );
  });

  check("status reports protected + locked", () => {
    const status = getWebsiteLockStatus(FIXTURE_SITE_ID);
    assert.equal(status.protected, true);
    assert.equal(status.locked, true);
  });

  // --- 2. unlock requires the typed confirmation --------------------------------
  check("unlock rejects a wrong confirmation", () => {
    const bad = createWebsiteUnlockSession({ userId: USER_ID, projectId: FIXTURE_SITE_ID, confirmation: "unlock please" });
    assert.equal(bad.ok, false);
    assert.equal(bad.status, 400);
  });

  check("unlock rejects an unauthenticated caller", () => {
    const anon = createWebsiteUnlockSession({ userId: "", projectId: FIXTURE_SITE_ID, confirmation: WEBSITE_LOCK_CONFIRMATION });
    assert.equal(anon.ok, false);
    assert.equal(anon.status, 401);
  });

  const unlocked = createWebsiteUnlockSession({
    userId: USER_ID,
    projectId: FIXTURE_SITE_ID,
    confirmation: WEBSITE_LOCK_CONFIRMATION,
    draftRevision: "rev-0",
  });
  check("unlock with typed UNLOCK creates an editing session", () => {
    assert.equal(unlocked.ok, true, unlocked.error || "");
    assert.ok(unlocked.token, "expected an unlock token");
    assert.ok(unlocked.expiresAt, "expected an expiry");
    const ttlMinutes = Math.round((Date.parse(unlocked.expiresAt) - Date.now()) / 60000);
    assert.ok(ttlMinutes >= 55 && ttlMinutes <= 60, `expected ~60 minute expiry, got ${ttlMinutes}`);
  });

  check("status reports unlocked while the session is live", () => {
    const status = getWebsiteLockStatus(FIXTURE_SITE_ID, unlocked.token);
    assert.equal(status.protected, true);
    assert.equal(status.locked, false);
  });

  // --- 3. authorised saves, repeatedly ------------------------------------------
  await checkAsync("authorised save succeeds and reads back", async () => {
    const saved = await storage.saveSplitWebsiteProject(
      USER_ID, fixtureProject(), { backupSource: "owner-save", unlockToken: unlocked.token }
    );
    assert.ok(saved, "expected the save to return the project");
    const readBack = await storage.loadFullSplitWebsiteProject(USER_ID, FIXTURE_SITE_ID);
    assert.ok(readBack, "expected the saved fixture to read back from Supabase");
  });

  await checkAsync("a second save in the same session is NOT rejected as stale", async () => {
    markWebsiteMutationCommitted({
      projectId: FIXTURE_SITE_ID, unlockToken: unlocked.token, action: "save", draftRevision: "rev-1",
    });
    const again = await storage.saveSplitWebsiteProject(
      USER_ID, { ...fixtureProject(), name: "Content lock fixture v2" },
      { backupSource: "owner-save-2", unlockToken: unlocked.token }
    );
    assert.ok(again, "the owner's own follow-up save must be allowed");
  });

  // --- 4. wrong user / wrong token are refused ----------------------------------
  check("a different user's token is refused (409)", () => {
    const other = assertWebsiteUnlockedForMutation({
      projectId: FIXTURE_SITE_ID, userId: "someone-else", unlockToken: unlocked.token, action: "save",
    });
    assert.equal(other.ok, false);
    assert.equal(other.status, 409);
  });

  check("an unknown (stale tab) token is refused", () => {
    const stale = assertWebsiteUnlockedForMutation({
      projectId: FIXTURE_SITE_ID, userId: USER_ID, unlockToken: crypto.randomUUID(), action: "save",
    });
    assert.equal(stale.ok, false);
    assert.ok(stale.status === 409 || stale.status === 423, `expected 409/423, got ${stale.status}`);
  });

  // --- 5. relock ----------------------------------------------------------------
  await checkAsync("relock ends the session and refuses further saves", async () => {
    relockWebsite(FIXTURE_SITE_ID, unlocked.token);
    assert.equal(getWebsiteLockStatus(FIXTURE_SITE_ID).locked, true, "expected the website to be locked again");
    await assert.rejects(
      () => storage.saveSplitWebsiteProject(USER_ID, fixtureProject(), { backupSource: "after-relock", unlockToken: unlocked.token }),
      (err) => { assert.equal(err.status, 423); return true; }
    );
  });
} finally {
  // --- cleanup: remove the fixture rows, never the live website ------------------
  assert.notEqual(FIXTURE_SITE_ID, LIVE_WEBSITE_PROJECT_ID);
  for (const table of ["website_builder_page_versions", "website_builder_pages", "website_builder_sites"]) {
    const { error } = await supabaseAdmin.from(table).delete().eq("site_id", FIXTURE_SITE_ID);
    if (error) console.warn(`  cleanup warning (${table}): ${error.message}`);
  }
  const { data: leftover } = await supabaseAdmin
    .from("website_builder_sites").select("site_id").eq("site_id", FIXTURE_SITE_ID);
  console.log(`cleanup: fixture rows remaining = ${leftover?.length ?? "?"}`);
}

if (failures) {
  console.error(`\nWebsite content lock test FAILED (${failures} check(s)).`);
  process.exit(1);
}
console.log("\nWebsite content lock regression checks passed.");
