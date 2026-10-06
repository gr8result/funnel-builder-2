// Public HNC catalogue API used by the existing appliance and plumbing importers.
// Complete pagination and evidence caching are shared; no per-brand/model/finish caps.
import fs from 'node:fs';
import path from 'node:path';
export const HNC_BASE = 'https://www.harveynormancommercial.com.au';
export const HNC_SOURCE = 'Harvey Norman Commercial';
export const HNC_ENDPOINT = `${HNC_BASE}/api/magento-proxy`;
export async function fetchHnc(url, options = {}) {
  let error;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      return response;
    } catch (cause) { error = cause; }
  }
  throw error;
}
export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
export function createHncCatalogueClient({ evidenceDirectory, refresh = false, sanitize = (result) => result }) {
  async function query(query, variables, file) {
    const target = path.join(evidenceDirectory, file);
    if (!refresh && fs.existsSync(target)) return JSON.parse(fs.readFileSync(target, 'utf8'));
    const response = await fetchHnc(HNC_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) });
    const result = await response.json();
    if (result.errors?.length || !result.data) throw new Error(`HNC query failed: ${JSON.stringify(result.errors)}`);
    const evidence = sanitize(result);
    writeJson(target, evidence);
    return evidence;
  }
  async function allProducts({ filter, fields, evidenceKey, pageSize = 100 }) {
    const rows = [], identities = new Set(), pages = [];
    let totalPages = 1, expectedTotal;
    for (let page = 1; page <= totalPages; page++) {
      // HNC's name sort has unstable ties between finish variants; use its default
      // catalogue order and fail closed if any pages overlap or omit records.
      const result = await query(`query Range($page:Int!){products(filter:${filter},pageSize:${pageSize},currentPage:$page){total_count page_info{total_pages current_page page_size} items{${fields}}}}`, { page }, `${evidenceKey}/page-${page}.json`);
      const batch = result.data.products;
      if (expectedTotal !== undefined && expectedTotal !== batch.total_count) throw new Error('Supplier range changed during pagination; refresh the census.');
      expectedTotal = batch.total_count;
      totalPages = batch.page_info.total_pages;
      for (const item of batch.items) {
        if (identities.has(item.sku)) throw new Error(`Duplicate HNC SKU across pages: ${item.sku}`);
        identities.add(item.sku); rows.push(item);
      }
      pages.push({ page, count: batch.items.length, total: expectedTotal, totalPages });
      console.log(`[${evidenceKey}] page ${page}/${totalPages}: ${rows.length}/${expectedTotal}`);
    }
    if (rows.length !== expectedTotal) throw new Error(`Incomplete HNC range: ${rows.length}/${expectedTotal}`);
    return { rows, pages, total: expectedTotal };
  }
  return { query, allProducts };
}
