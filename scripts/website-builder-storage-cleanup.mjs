#!/usr/bin/env node
// scripts/website-builder-storage-cleanup.mjs
//
// Prunes local filesystem recovery snapshots under website-builder-backups/ (and, opt-in,
// the two orphaned top-level "website-builder-sites-*-backup-*" folders left over from an
// earlier manual recovery). Supabase (website_builder_sites / website_builder_pages) is the
// durable store for customer websites -- these are development recovery aids only.
//
// SAFE BY DEFAULT: dry-run unless --apply is passed. Before deleting anything for a given
// project, verifies that project's pages are actually readable back from Supabase; if that
// verification fails, the project's backups are left untouched and it's reported as skipped.
// The single newest snapshot per project is never deleted, regardless of --retain.
//
// Usage:
//   node scripts/website-builder-storage-cleanup.mjs                # dry-run, default retain=5
//   node scripts/website-builder-storage-cleanup.mjs --retain=3     # dry-run, keep latest 3
//   node scripts/website-builder-storage-cleanup.mjs --apply        # actually delete
//   node scripts/website-builder-storage-cleanup.mjs --apply --include-stray
//       also removes the two known orphaned top-level backup folders (see STRAY_FOLDERS below)

import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const INCLUDE_STRAY = args.includes("--include-stray");
const retainArg = args.find((arg) => arg.startsWith("--retain="));
const RETAIN = Math.max(1, Number(retainArg?.split("=")[1]) || Number(process.env.WEBSITE_BUILDER_BACKUP_RETENTION) || 5);

const BACKUPS_ROOT = path.join(ROOT, "website-builder-backups");

// Orphaned one-off snapshots found during the 2026-07-24 storage audit. Not written by any
// current code path (verified: zero references anywhere in the app). Only touched with
// --include-stray, and still gated behind the same per-project DB verification below.
const STRAY_FOLDERS = [
  { dir: "website-builder-sites-backup-stage1-20260606-101444", accountId: "35ab846e-0764-498b-b1f8-7d2cf27d85a5", projectId: "2208a52a-8175-477e-823c-fc6de7fe4afe" },
  { dir: "website-builder-sites-project-backup-recovery-20260607-064606", accountId: "35ab846e-0764-498b-b1f8-7d2cf27d85a5", projectId: "2208a52a-8175-477e-823c-fc6de7fe4afe" },
];

function loadEnvLocal() {
  try {
    const raw = readFileSync(path.join(ROOT, ".env.local"), "utf8");
    const get = (key) => (raw.match(new RegExp(`^${key}=(.*)$`, "m")) || [])[1]?.trim();
    return {
      url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || get("SUPABASE_URL") || get("NEXT_PUBLIC_SUPABASE_URL"),
      key: process.env.SUPABASE_SERVICE_ROLE_KEY || get("SUPABASE_SERVICE_ROLE_KEY"),
    };
  } catch {
    return { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  }
}

async function dirSize(dir) {
  let total = 0;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += await dirSize(full);
    else if (entry.isFile()) total += (await fs.stat(full)).size;
  }
  return total;
}

function formatMb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function listProjectSnapshots(accountId, projectId) {
  const dir = path.join(BACKUPS_ROOT, accountId, projectId);
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const snapshots = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  // Snapshot dir names are ISO-timestamp-prefixed, so lexical sort == chronological sort.
  snapshots.sort().reverse();
  return snapshots.map((name) => path.join(dir, name));
}

async function verifyProjectInSupabase(supabase, accountId, projectId) {
  if (!supabase) return { ok: false, reason: "Supabase client not configured (missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" };
  const { data, error } = await supabase
    .from("website_builder_pages")
    .select("page_id, blocks")
    .eq("user_id", accountId)
    .eq("site_id", projectId)
    .limit(1);
  if (error) return { ok: false, reason: error.message };
  if (!data?.length) return { ok: false, reason: "No rows found in website_builder_pages for this project" };
  return { ok: true };
}

async function main() {
  const { url, key } = loadEnvLocal();
  const supabase = url && key ? createClient(url, key) : null;
  if (!supabase) {
    console.warn("WARNING: could not build a Supabase client from env -- every project will fail read-back verification and be skipped.");
  }

  console.log(`Mode: ${APPLY ? "APPLY (will delete)" : "DRY RUN (nothing will be deleted)"}`);
  console.log(`Retention: keep newest ${RETAIN} snapshot(s) per project\n`);

  let totalCandidateBytes = 0;
  let totalRemovedBytes = 0;
  const report = [];

  let accountDirs = [];
  try {
    accountDirs = (await fs.readdir(BACKUPS_ROOT, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  for (const accountId of accountDirs) {
    let projectDirs = [];
    try {
      projectDirs = (await fs.readdir(path.join(BACKUPS_ROOT, accountId), { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      continue;
    }

    for (const projectId of projectDirs) {
      const snapshots = await listProjectSnapshots(accountId, projectId);
      if (!snapshots.length) continue;

      const verification = await verifyProjectInSupabase(supabase, accountId, projectId);
      const keep = snapshots.slice(0, RETAIN);
      const candidates = verification.ok ? snapshots.slice(Math.max(RETAIN, 1)) : [];

      let candidateBytes = 0;
      for (const dir of candidates) candidateBytes += await dirSize(dir);
      totalCandidateBytes += candidateBytes;

      report.push({
        accountId,
        projectId,
        totalSnapshots: snapshots.length,
        keeping: keep.length,
        candidates: candidates.length,
        candidateBytes,
        verification,
      });

      console.log(`Project ${accountId}/${projectId}`);
      console.log(`  snapshots on disk: ${snapshots.length}, keeping newest ${keep.length}`);
      if (!verification.ok) {
        console.log(`  SKIPPED -- Supabase read-back verification failed: ${verification.reason}. No deletions for this project.`);
      } else {
        console.log(`  candidates for removal: ${candidates.length} (${formatMb(candidateBytes)})`);
        if (APPLY && candidates.length) {
          for (const dir of candidates) {
            await fs.rm(dir, { recursive: true, force: true });
          }
          totalRemovedBytes += candidateBytes;
          console.log(`  removed ${candidates.length} snapshot(s), recovered ${formatMb(candidateBytes)}`);
        }
      }
      console.log("");
    }
  }

  if (INCLUDE_STRAY) {
    console.log("Stray orphaned backup folders:");
    for (const stray of STRAY_FOLDERS) {
      const dir = path.join(ROOT, stray.dir);
      let exists = true;
      try {
        await fs.access(dir);
      } catch {
        exists = false;
      }
      if (!exists) {
        console.log(`  ${stray.dir}: not present, skipping`);
        continue;
      }
      const verification = await verifyProjectInSupabase(supabase, stray.accountId, stray.projectId);
      const bytes = await dirSize(dir);
      totalCandidateBytes += bytes;
      if (!verification.ok) {
        console.log(`  ${stray.dir}: SKIPPED -- Supabase read-back verification failed: ${verification.reason}`);
        continue;
      }
      console.log(`  ${stray.dir}: candidate for removal (${formatMb(bytes)})`);
      if (APPLY) {
        await fs.rm(dir, { recursive: true, force: true });
        totalRemovedBytes += bytes;
        console.log(`    removed, recovered ${formatMb(bytes)}`);
      }
    }
    console.log("");
  } else {
    console.log("Stray orphaned backup folders: pass --include-stray to consider these for removal.\n");
  }

  console.log("---");
  console.log(`Total space ${APPLY ? "recovered" : "that would be recovered"}: ${formatMb(APPLY ? totalRemovedBytes : totalCandidateBytes)}`);
  if (!APPLY) {
    console.log("This was a dry run. Re-run with --apply to actually delete the candidates listed above.");
  }
}

main().catch((error) => {
  console.error("Cleanup script failed:", error);
  process.exit(1);
});
