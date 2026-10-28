// Imports the two approved isolated-environment landing pages (exported by the funnel-dashboard task into
// artifacts/funnel-dashboard-import/source-pages.json) as NEW DRAFT campaigns in a real workspace.
// Never updates or deletes existing records. Images are re-uploaded from the isolated mock storage into the
// workspace's own landing-pages folder; fixture contact details in the briefs are replaced by the workspace's
// saved business defaults. Refuses to run twice for the same source page.
//
// node --input-type=module -e "...register loaders...; await import('scripts/import-landing-page-candidates.mjs')"
//   env: IMPORT_WORKSPACE_ID, IMPORT_USER_ID, IMPORT_CONFIRM=yes

import fs from 'node:fs';
import path from 'node:path';

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}

const WORKSPACE = process.env.IMPORT_WORKSPACE_ID;
const USER = process.env.IMPORT_USER_ID;
if (!WORKSPACE || !USER || process.env.IMPORT_CONFIRM !== 'yes') throw new Error('Set IMPORT_WORKSPACE_ID, IMPORT_USER_ID and IMPORT_CONFIRM=yes');

const repo = await import('../lib/landing-pages/repository.js');
const { storeImage } = await import('../lib/landing-pages/upload.js');
const { supabaseAdmin } = await import('../lib/supabaseAdmin.js');

const PLAN = {
  '2022a330-1ac0-4bff-a23f-7cdd40f580e0': { name: 'GR8 Result pre-launch (imported draft)', slugBase: 'gr8-result-prelaunch-draft' },
  '2c765539-2ae6-4d10-aabf-ca4c73f4590d': { name: 'Paperbark Creative demo template (imported draft)', slugBase: 'paperbark-creative-demo' },
};
const CONTACT_KEYS = ['email', 'phone', 'address', 'website', 'privacyUrl', 'logoUrl', 'contactEmail', 'contactPhone'];

const member = await supabaseAdmin.from('workspace_members').select('role, status').eq('workspace_id', WORKSPACE).eq('user_id', USER).eq('status', 'active').maybeSingle();
if (member.error || !member.data) throw new Error('User is not an active member of the target workspace');

const source = JSON.parse(fs.readFileSync('artifacts/funnel-dashboard-import/source-pages.json', 'utf8'));
const existing = await repo.listCampaigns(WORKSPACE, { includeArchived: true });
const defaults = await repo.campaignBusinessDefaults(WORKSPACE, '');
const report = [];

for (const [sourcePageId, plan] of Object.entries(PLAN)) {
  const src = source[sourcePageId];
  if (!src?.page?.document) throw new Error(`Missing exported source for ${sourcePageId}`);
  const already = existing.find((c) => c.brief?.importedFrom?.pageId === sourcePageId);
  if (already) { report.push({ sourcePageId, skipped: 'already imported', campaignId: already.id, pageId: already.pages[0]?.id }); continue; }

  const campaign = await repo.createCampaign(WORKSPACE, USER, { name: plan.name });

  let docText = JSON.stringify(src.page.document);
  const mockUrls = [...new Set(docText.match(/https?:\/\/(?:127\.0\.0\.1|localhost):54423\/[^"\\\s)]+/g) || [])];
  const uploaded = [];
  for (const url of mockUrls) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Could not read source image ${url}: HTTP ${r.status}`);
    const type = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
    const bytes = Buffer.from(await r.arrayBuffer());
    const fileName = path.basename(new URL(url).pathname).replace(/^\d+-/, '');
    const realUrl = await storeImage(WORKSPACE, `campaign-${campaign.id}`, { dataUrl: `data:${type};base64,${bytes.toString('base64')}`, fileName });
    docText = docText.split(url).join(realUrl);
    uploaded.push({ from: url, to: realUrl, bytes: bytes.length });
  }
  if (/127\.0\.0\.1|localhost:54423/.test(docText)) throw new Error('A mock storage URL survived the image import');
  const document = JSON.parse(docText);

  const brief = { ...src.campaign.brief };
  for (const key of CONTACT_KEYS) delete brief[key];
  Object.assign(brief, Object.fromEntries(CONTACT_KEYS.filter((k) => defaults[k]).map((k) => [k, defaults[k]])));
  if (Array.isArray(brief.media))  brief.media = brief.media.map((m) => ({ ...m, src: uploaded.find((u) => u.from === m.src)?.to || m.src })).filter((m) => !/127\.0\.0\.1|localhost/.test(m.src || ''));
  brief.campaignName = plan.name;
  brief.importedFrom = { pageId: sourcePageId, campaignId: src.campaign.id, environment: 'isolated-quality-3123', revision: src.page.revision, importedAt: new Date().toISOString() };
  await repo.updateCampaign(WORKSPACE, campaign.id, { brief, interview: src.campaign.interview || undefined }, USER);

  const page = await repo.createPage(WORKSPACE, USER, campaign.id, { title: src.page.title, document, slugBase: plan.slugBase, kind: 'generated', label: `Imported from approved candidate (revision ${src.page.revision})` });
  report.push({ sourcePageId, campaignId: campaign.id, pageId: page.id, slug: page.slug, status: page.status, images: uploaded.length, editor: `http://localhost:3000/modules/landing-pages/editor/${page.id}` });
}

fs.writeFileSync('artifacts/funnel-dashboard-import/import-report.json', JSON.stringify({ workspace: WORKSPACE, at: new Date().toISOString(), report }, null, 2));
console.log(JSON.stringify(report, null, 2));
