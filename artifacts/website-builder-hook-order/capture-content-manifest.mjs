import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local', quiet: true });
const projectId = '2208a52a-8175-477e-823c-fc6de7fe4afe';
const userId = '35ab846e-0764-498b-b1f8-7d2cf27d85a5';
const outputName = process.argv[2] || 'content-before.json';
if (!/^content-(before|after)\.json$/.test(outputName)) throw new Error('Use content-before.json or content-after.json');
const artifactDir = path.resolve('artifacts/website-builder-hook-order');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const stable = (value) => Array.isArray(value) ? `[${value.map(stable).join(',')}]`
  : value && typeof value === 'object' ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
  : JSON.stringify(value);
async function fileHash(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function treeManifest(root) {
  const files = [];
  if (!fs.existsSync(root)) return { exists: false, files, hash: sha256(stable(files)) };
  const walk = async (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) files.push({ path: path.relative(root, full).replaceAll('\\', '/'), bytes: fs.statSync(full).size, sha256: await fileHash(full) });
    }
  };
  await walk(root);
  return { exists: true, fileCount: files.length, bytes: files.reduce((total, item) => total + item.bytes, 0), hash: sha256(stable(files)), files };
}
const client = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
async function remoteManifest(table, filterColumn, filterValues, select = '*') {
  const rows = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await client.from(table).select(select).eq('user_id', userId).in(filterColumn, filterValues).order('id').range(start, start + 499);
    if (error) return { error: { code: error.code, message: error.message } };
    rows.push(...data);
    if (data.length < 500) break;
  }
  const hashes = rows.map((row) => ({ id: row.id, pageId: row.page_id || null, slug: row.slug || row.page_slug || null, updatedAt: row.updated_at || null, sha256: sha256(stable(row)) }));
  return { rowCount: rows.length, selectedColumns: select, hash: sha256(stable(hashes)), rows: hashes };
}
const localRoot = path.resolve(process.env.WEBSITE_BUILDER_SITES_DIR || 'website-builder-sites', userId, projectId);
const [projectTree, templateDefaults, sites, pages, published, versions] = await Promise.all([
  treeManifest(localRoot),
  treeManifest(path.resolve('data/website-builder-defaults')),
  remoteManifest('website_builder_sites', 'site_id', [projectId]),
  remoteManifest('website_builder_pages', 'site_id', [projectId]),
  remoteManifest('published_websites', 'project_id', [projectId, `draft:${projectId}`]),
  remoteManifest('website_builder_page_versions', 'site_id', [projectId], 'id,user_id,site_id,page_id,page_name,page_slug,source,reason,created_at'),
]);
const manifest = {
  capturedAt: new Date().toISOString(), projectId, userId,
  method: 'Read-only byte SHA256 of complete saved local project tree (including images, templates and backups) and all template defaults; canonical stable JSON SHA256 of raw full Supabase site/page/publication rows. Version history hashes cover identity/metadata only. No storage helpers, migrations, RPCs, or writes were called; remote image bytes were not downloaded.',
  local: { projectRoot: path.relative(process.cwd(), localRoot).replaceAll('\\', '/'), projectTree, templateDefaults },
  remote: { website_builder_sites: sites, website_builder_pages: pages, published_websites: published, website_builder_page_versions: versions },
};
fs.mkdirSync(artifactDir, { recursive: true });
fs.writeFileSync(path.join(artifactDir, outputName), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ path: path.join(artifactDir, outputName), localFiles: projectTree.fileCount, localBytes: projectTree.bytes, defaultsFiles: templateDefaults.fileCount, remote: Object.fromEntries(Object.entries(manifest.remote).map(([table, result]) => [table, { rowCount: result.rowCount, hash: result.hash, error: result.error }])) }, null, 2));
