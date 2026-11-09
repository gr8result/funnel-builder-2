import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const WORKSPACE = '846885cd-25b9-4eca-b9f9-3fd02f5882d8';
const PAGE_IDS = [
  'fb1ada85-b9ea-4a43-a163-c34c72115546',
  '06a812a4-1b4a-4751-96c1-b226a106985d',
  'e0291644-ea05-43b4-b81e-3304a83f0518',
  '6c8e4e52-a20b-4ab3-b51b-6729e625bdec',
  '76ddafb7-77e4-4624-9396-434ead9929a4',
  '2a444d97-551c-4f29-88cf-533dfa1bfee2',
  'cc1d671f-01cd-4030-bb74-9d58e6af84a8',
  'ab8967bb-7282-4e1f-82a8-bf1072316d03',
  '202093a1-abdd-46fd-82c0-df92ac66a76d',
];

dotenv.config({ path: '.env.local', quiet: true });
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
assert(url && key, 'A configured Supabase service-role client is required for this read-only inventory.');
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function read(query, label) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.code || 'database request failed'}`);
  return data || [];
}
const fingerprint = (document) => {
  const serialised = JSON.stringify(document);
  return {
    bytes: Buffer.byteLength(serialised),
    sha256: createHash('sha256').update(serialised).digest('hex'),
    sections: Array.isArray(document?.sections) ? document.sections.length : 0,
  };
};

try {
  const pages = await read(db.from('landing_pages')
    .select('id,workspace_id,campaign_id,title,slug,status,revision,published_version_id,created_at,updated_at,document')
    .eq('workspace_id', WORKSPACE).in('id', PAGE_IDS).limit(PAGE_IDS.length), 'Recovered pages');
  const campaignIds = [...new Set(pages.map((page) => page.campaign_id))];
  const campaigns = campaignIds.length ? await read(db.from('landing_campaigns')
    .select('id,workspace_id,name,status,archived_at').eq('workspace_id', WORKSPACE)
    .in('id', campaignIds).limit(campaignIds.length), 'Recovered campaigns') : [];
  const versionIds = [...new Set(pages.map((page) => page.published_version_id).filter(Boolean))];
  const versions = versionIds.length ? await read(db.from('landing_page_versions')
    .select('id,workspace_id,page_id,version_no,kind,document').eq('workspace_id', WORKSPACE)
    .in('id', versionIds).limit(versionIds.length), 'Referenced published versions') : [];
  const imports = JSON.parse(fs.readFileSync(path.join('artifacts', 'funnel-dashboard-import', 'import-report.json'), 'utf8'));
  const sourcePages = JSON.parse(fs.readFileSync(path.join('artifacts', 'funnel-dashboard-import', 'source-pages.json'), 'utf8'));
  const entries = pages.map((page) => {
    const campaign = campaigns.find((row) => row.id === page.campaign_id);
    const publishedVersion = versions.find((row) => row.id === page.published_version_id && row.page_id === page.id) || null;
    const imported = imports.workspace === WORKSPACE ? imports.report.find((row) => row.pageId === page.id && row.campaignId === page.campaign_id) : null;
    const source = imported ? sourcePages[imported.sourcePageId]?.page : null;
    const complete = !!campaign && Array.isArray(page.document?.sections) && page.document.sections.length > 0
      && (!page.published_version_id || !!publishedVersion);
    return {
      campaign: campaign || null,
      page,
      fingerprint: fingerprint(page.document),
      publishedVersion,
      publishedFingerprint: publishedVersion ? fingerprint(publishedVersion.document) : null,
      importedFrom: source ? { pageId: imported.sourcePageId, fingerprint: fingerprint(source.document) } : null,
      archived: campaign?.status === 'archived',
      complete,
    };
  });
  const missingPageIds = PAGE_IDS.filter((id) => !pages.some((page) => page.id === id));
  const report = {
    fetchedAt: new Date().toISOString(), workspaceId: WORKSPACE, readOnly: true,
    designationConfirmed: false,
    designationNote: 'Existing campaign-page candidates, not confirmed original masters or registered classic funnel templates.',
    missingPageIds, entries,
  };
  const dir = path.join('artifacts', 'funnel-recovery');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `landing-page-inventory-${report.fetchedAt.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2), { flag: 'wx' });
  for (const entry of entries) {
    console.log(`${entry.archived ? 'ARCHIVED' : 'LOCATED'} ${entry.page.id} | ${entry.page.title} | ${entry.fingerprint.sections} sections | ${entry.complete ? 'complete' : 'incomplete'}`);
  }
  console.log(`Read-only content inventory saved: ${file}`);
  if (missingPageIds.length || entries.some((entry) => !entry.complete)) {
    throw new Error(`Recovery is incomplete: ${missingPageIds.length} missing pages; ${entries.filter((entry) => !entry.complete).length} incomplete records. See inventory.`);
  }
} catch (error) {
  console.error(`[funnel-recovery] ${error.message}`);
  process.exitCode = 1;
}
