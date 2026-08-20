import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { loadFullSplitWebsiteProject, saveSplitWebsiteProject } from "../lib/website-builder/supabaseSiteStorage.js";

dotenv.config({ path: process.env.WB_ENV_FILE || ".env.local", quiet: true });

const OUT_ROOT = path.join(process.cwd(), "diagnostics", `canonical-storage-migration-${new Date().toISOString().replace(/[:.]/g, "-")}`);

async function selectAll(table, columns = "*") {
  const { data, error } = await supabaseAdmin.from(table).select(columns);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

function pageBlockCount(project = {}) {
  const pageBlocks = project?.pageBlocks && typeof project.pageBlocks === "object" ? project.pageBlocks : {};
  return Object.fromEntries(Object.entries(pageBlocks).map(([name, blocks]) => [name, Array.isArray(blocks) ? blocks.length : 0]));
}

await fs.mkdir(OUT_ROOT, { recursive: true });

const [siteRows, pageRows, publishedRows] = await Promise.all([
  selectAll("website_builder_sites"),
  selectAll("website_builder_pages"),
  selectAll("published_websites"),
]);

await fs.writeFile(path.join(OUT_ROOT, "backup.json"), JSON.stringify({
  createdAt: new Date().toISOString(),
  tables: {
    website_builder_sites: siteRows,
    website_builder_pages: pageRows,
    published_websites: publishedRows,
  },
}, null, 2));

const results = [];
for (const row of siteRows) {
  const userId = row.user_id;
  const siteId = String(row.site_id || row.site_data?.id || "").replace(/^draft:/, "");
  if (!userId || !siteId) {
    results.push({ siteId, userId, ok: false, error: "Missing user_id or site_id" });
    continue;
  }

  const before = await loadFullSplitWebsiteProject(userId, siteId);
  if (!before) {
    results.push({ siteId, userId, ok: false, error: "Could not assemble draft" });
    continue;
  }

  const saved = await saveSplitWebsiteProject(userId, before, {
    siteId,
    backupSource: "canonical-storage-migration",
    backupReason: "Before canonical site document migration",
    baseRevision: before.revision ?? before.saveRevision ?? "",
  });

  results.push({
    siteId,
    userId,
    ok: true,
    revision: saved?.revision ?? saved?.saveRevision ?? null,
    storageVersion: saved?.storageVersion ?? null,
    canonicalStorage: saved?.canonicalStorage === true,
    pageCount: Array.isArray(saved?.pages) ? saved.pages.length : 0,
    blockCounts: pageBlockCount(saved),
  });
}

await fs.writeFile(path.join(OUT_ROOT, "migration-results.json"), JSON.stringify({ ok: results.every((entry) => entry.ok), results }, null, 2));
console.log(JSON.stringify({ ok: results.every((entry) => entry.ok), backupDir: OUT_ROOT, results }, null, 2));
