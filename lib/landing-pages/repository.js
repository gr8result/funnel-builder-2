// Data access for Landing Pages. Every function takes the workspace id it is acting for and filters by it, so a
// member of one builder can never read or change another builder's campaigns, pages or enquiries.
//
// Uses the service-role client after the API route has checked membership (lib/withWorkspace.js). Tests pass a
// different client through setLandingDb().

import { supabaseAdmin } from '../supabaseAdmin';
import { normaliseDocument, slugify } from './pageModel.js';
import { emptyInterview, businessProfileDefaults } from './interview.js';
import { brandingAssetReference, resolveBusinessBrandingAsset } from '../businessBranding.js';

let override = null;
export function setLandingDb(client) { override = client; }
const db = () => override || supabaseAdmin;

export class NotFound extends Error { constructor(what = 'Not found') { super(what); this.status = 404; } }
export class Conflict extends Error { constructor(msg, extra = {}) { super(msg); this.status = 409; Object.assign(this, extra); } }

function must({ data, error }, what = 'query') {
  if (error) { const e = new Error(`${what} failed: ${error.message || error}`); e.cause = error; throw e; }
  return data;
}

const CAMPAIGN_COLS = 'id, workspace_id, created_by, name, status, brief, interview, starts_on, ends_on, archived_at, duplicated_from, created_at, updated_at';
const PAGE_COLS = 'id, workspace_id, campaign_id, created_by, title, slug, status, revision, published_version_id, published_at, unpublished_at, created_at, updated_at';

export async function audit(workspaceId, entity, entityId, action, detail = {}, actor = null) {
  try {
    await db().from('landing_audit_log').insert({ workspace_id: workspaceId, entity, entity_id: entityId, action, detail, actor });
  } catch { /* audit is best effort; never fail the user action on it */ }
}

// ---- campaigns ------------------------------------------------------------------------------------------------------

export async function listCampaigns(workspaceId, { includeArchived = false } = {}) {
  let q = db().from('landing_campaigns').select(CAMPAIGN_COLS).eq('workspace_id', workspaceId).order('updated_at', { ascending: false });
  if (!includeArchived) q = q.neq('status', 'archived');
  const campaigns = must(await q, 'list campaigns') || [];
  if (!campaigns.length) return [];
  const ids = campaigns.map((c) => c.id);
  const rows = must(await db().from('landing_pages').select(`${PAGE_COLS}, document`).eq('workspace_id', workspaceId).in('campaign_id', ids), 'list pages') || [];
  const pages = rows.map(({ document, ...page }) => ({ ...page, thumbnail: pageThumbnail(document) }));
  const stats = await campaignStats(workspaceId, ids);
  return campaigns.map((c) => ({ ...c, pages: pages.filter((p) => p.campaign_id === c.id), stats: stats[c.id] || { visits: 0, leads: 0, failed: 0, conversionRate: 0 } }));
}

export function pageThumbnail(document) {
  const sections = Array.isArray(document?.sections) ? document.sections : [];
  const visible = sections.filter((s) => !s?.hidden);
  const hero = visible.find((s) => s?.type === 'hero');
  const candidates = [hero?.props?.image?.src, document?.seo?.ogImage, ...visible.map((s) => s?.props?.image?.src)];
  return candidates.map((src) => String(src || '').trim()).find((src) => /^https?:\/\//i.test(src) || src.startsWith('/')) || '';
}

export async function campaignStats(workspaceId, campaignIds) {
  const out = Object.fromEntries(campaignIds.map((id) => [id, { visits: 0, leads: 0, failed: 0, conversionRate: 0 }]));
  if (!campaignIds.length) return out;
  const events = must(await db().from('landing_page_events').select('campaign_id, type').eq('workspace_id', workspaceId).in('campaign_id', campaignIds).eq('type', 'visit'), 'events') || [];
  const subs = must(await db().from('landing_page_submissions').select('campaign_id, status').eq('workspace_id', workspaceId).in('campaign_id', campaignIds), 'submissions') || [];
  for (const e of events) out[e.campaign_id].visits += 1;
  for (const s of subs) { out[s.campaign_id].leads += 1; if (s.status !== 'synced') out[s.campaign_id].failed += 1; }
  for (const id of campaignIds) { const s = out[id]; s.conversionRate = s.visits ? Math.round((s.leads / s.visits) * 1000) / 10 : 0; }
  return out;
}

export async function getCampaign(workspaceId, id) {
  const c = must(await db().from('landing_campaigns').select(CAMPAIGN_COLS).eq('workspace_id', workspaceId).eq('id', id).maybeSingle(), 'get campaign');
  if (!c) throw new NotFound('Campaign not found');
  return c;
}

export async function campaignBusinessDefaults(workspaceId, fallbackName = '') {
  const workspace = must(await db().from('workspaces').select('*').eq('id', workspaceId).maybeSingle(), 'business workspace');
  if (!workspace) throw new NotFound('Workspace not found');
  let profile = {};
  let logo = '';
  if (workspace.owner_id) {
    const result = await db().from('business_profile_vaults').select('data->business_information,data->branding_assets').eq('user_id', workspace.owner_id).maybeSingle();
    if (result.error) console.warn('[landing-pages] optional business profile unavailable:', result.error.code || 'lookup failed');
    else {
      profile = result.data?.business_information || {};
      logo = result.data?.branding_assets?.companyLogoUpload || '';
    }
    if (!logo) {
      const account = await db().from('accounts').select('business_logo,business_logo_url').eq('user_id', workspace.owner_id).maybeSingle();
      if (!account.error) logo = account.data?.business_logo || account.data?.business_logo_url || '';
    }
  }
  const defaults = businessProfileDefaults(profile, workspace.name || fallbackName);
  if (brandingAssetReference(logo)?.public) defaults.logoUrl = await resolveBusinessBrandingAsset(db().storage, logo);
  return defaults;
}

export async function createCampaign(workspaceId, userId, { name, brief = {} }) {
  const clean = String(name || '').trim().slice(0, 160);
  if (!clean) throw Object.assign(new Error('Campaign name is required'), { status: 400 });
  const row = must(await db().from('landing_campaigns').insert({
    workspace_id: workspaceId, created_by: userId, name: clean, status: 'draft',
    brief: { ...brief, campaignName: clean }, interview: { ...emptyInterview(), answered: ['campaignName'] },
  }).select(CAMPAIGN_COLS).single(), 'create campaign');
  await audit(workspaceId, 'campaign', row.id, 'created', { name: clean }, userId);
  return row;
}

export async function updateCampaign(workspaceId, id, patch, userId) {
  const allowed = {};
  if (patch.name != null) { const n = String(patch.name).trim().slice(0, 160); if (!n) throw Object.assign(new Error('Campaign name is required'), { status: 400 }); allowed.name = n; }
  if (patch.status != null) { if (!['draft', 'active', 'paused', 'archived'].includes(patch.status)) throw Object.assign(new Error('Invalid status'), { status: 400 }); allowed.status = patch.status; allowed.archived_at = patch.status === 'archived' ? new Date().toISOString() : null; }
  if (patch.brief) allowed.brief = patch.brief;
  if (patch.interview) allowed.interview = patch.interview;
  if ('starts_on' in patch) allowed.starts_on = patch.starts_on || null;
  if ('ends_on' in patch) allowed.ends_on = patch.ends_on || null;
  const row = must(await db().from('landing_campaigns').update(allowed).eq('workspace_id', workspaceId).eq('id', id).select(CAMPAIGN_COLS).maybeSingle(), 'update campaign');
  if (!row) throw new NotFound('Campaign not found');
  if (patch.status) await audit(workspaceId, 'campaign', id, `status:${patch.status}`, {}, userId);
  return row;
}

export async function duplicateCampaign(workspaceId, id, userId) {
  const src = await getCampaign(workspaceId, id);
  const name = `${src.name} (copy)`.slice(0, 160);
  const copy = must(await db().from('landing_campaigns').insert({
    workspace_id: workspaceId, created_by: userId, name, status: 'draft', brief: { ...src.brief, campaignName: name },
    interview: src.interview, starts_on: src.starts_on, ends_on: src.ends_on, duplicated_from: src.id,
  }).select(CAMPAIGN_COLS).single(), 'duplicate campaign');
  const pages = must(await db().from('landing_pages').select('id, title, document').eq('workspace_id', workspaceId).eq('campaign_id', id), 'source pages') || [];
  for (const p of pages) {
    await createPage(workspaceId, userId, copy.id, { title: p.title, document: p.document, slugBase: name, kind: 'generated', label: `Copied from “${src.name}”` });
  }
  await audit(workspaceId, 'campaign', copy.id, 'duplicated', { from: id }, userId);
  return copy;
}

// ---- pages ----------------------------------------------------------------------------------------------------------

async function uniqueSlug(base) {
  const root = slugify(base, 'campaign').slice(0, 60);
  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const hit = must(await db().from('landing_pages').select('id').eq('slug', candidate).maybeSingle(), 'slug check');
    if (!hit) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function createPage(workspaceId, userId, campaignId, { title, document, slugBase, kind = 'generated', label = 'First generation' }) {
  await getCampaign(workspaceId, campaignId);
  const doc = normaliseDocument(document);
  let page = null;
  for (let attempt = 0; attempt < 3 && !page; attempt += 1) {
    const slug = await uniqueSlug(slugBase || title);
    const res = await db().from('landing_pages').insert({ workspace_id: workspaceId, campaign_id: campaignId, created_by: userId, title: String(title || 'Landing page').slice(0, 160), slug, document: doc, revision: 1 }).select(PAGE_COLS).single();
    if (res.error && /duplicate|unique/i.test(res.error.message || '')) continue;
    page = must(res, 'create page');
  }
  if (!page) throw new Error('Could not reserve a page address');
  await addVersion(workspaceId, page.id, doc, kind, label, userId);
  return page;
}

export async function getPage(workspaceId, id, { withDocument = true } = {}) {
  const cols = withDocument ? `${PAGE_COLS}, document` : PAGE_COLS;
  const p = must(await db().from('landing_pages').select(cols).eq('workspace_id', workspaceId).eq('id', id).maybeSingle(), 'get page');
  if (!p) throw new NotFound('Page not found');
  if (withDocument) p.document = normaliseDocument(p.document);
  return p;
}

async function nextVersionNo(pageId) {
  const last = must(await db().from('landing_page_versions').select('version_no').eq('page_id', pageId).order('version_no', { ascending: false }).limit(1).maybeSingle(), 'last version');
  return (last?.version_no || 0) + 1;
}

export async function addVersion(workspaceId, pageId, document, kind, label, userId) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const version_no = await nextVersionNo(pageId);
    const res = await db().from('landing_page_versions').insert({ workspace_id: workspaceId, page_id: pageId, version_no, kind, label: label ? String(label).slice(0, 200) : null, document, created_by: userId }).select('id, version_no, kind, label, created_at').single();
    if (res.error && /duplicate|unique/i.test(res.error.message || '')) continue;
    return must(res, 'add version');
  }
  throw new Error('Could not record a version');
}

const AUTOSAVE_VERSION_EVERY_MS = 10 * 60 * 1000;

// Optimistic concurrency: a save names the revision it was based on; if someone else saved in between, it is refused
// and the caller gets the newer page instead of silently overwriting it.
export async function saveDraft(workspaceId, id, { document, baseRevision, kind = 'save', label = null, title = null }, userId) {
  const doc = normaliseDocument(document);
  const current = await getPage(workspaceId, id, { withDocument: false });
  if (Number(baseRevision) !== Number(current.revision)) {
    throw new Conflict('This page was changed somewhere else since you opened it.', { currentRevision: current.revision });
  }
  const patch = { document: doc, revision: current.revision + 1 };
  if (title) patch.title = String(title).slice(0, 160);
  const updated = must(await db().from('landing_pages').update(patch).eq('workspace_id', workspaceId).eq('id', id).eq('revision', current.revision).select(PAGE_COLS).maybeSingle(), 'save draft');
  if (!updated) throw new Conflict('This page was changed somewhere else since you opened it.', { currentRevision: current.revision + 1 });
  let version = null;
  if (kind === 'autosave') {
    const last = must(await db().from('landing_page_versions').select('created_at').eq('page_id', id).order('version_no', { ascending: false }).limit(1).maybeSingle(), 'last version');
    if (!last || Date.now() - new Date(last.created_at).getTime() > AUTOSAVE_VERSION_EVERY_MS) version = await addVersion(workspaceId, id, doc, 'autosave', 'Autosave', userId);
  } else {
    version = await addVersion(workspaceId, id, doc, kind, label, userId);
  }
  return { page: { ...updated, document: doc }, version };
}

export async function listVersions(workspaceId, pageId) {
  await getPage(workspaceId, pageId, { withDocument: false });
  return must(await db().from('landing_page_versions').select('id, version_no, kind, label, created_at, created_by').eq('workspace_id', workspaceId).eq('page_id', pageId).order('version_no', { ascending: false }).limit(100), 'list versions') || [];
}

export async function getVersion(workspaceId, pageId, versionId) {
  const v = must(await db().from('landing_page_versions').select('id, version_no, kind, label, document, created_at').eq('workspace_id', workspaceId).eq('page_id', pageId).eq('id', versionId).maybeSingle(), 'get version');
  if (!v) throw new NotFound('Version not found');
  return v;
}

export async function restoreVersion(workspaceId, pageId, versionId, baseRevision, userId) {
  const v = await getVersion(workspaceId, pageId, versionId);
  return saveDraft(workspaceId, pageId, { document: v.document, baseRevision, kind: 'restore', label: `Restored version ${v.version_no}` }, userId);
}

export async function publishPage(workspaceId, id, userId, { check }) {
  const page = await getPage(workspaceId, id);
  const result = check(page.document);
  if (!result.ok) return { ok: false, check: result };
  const campaign = await getCampaign(workspaceId, page.campaign_id);
  if (campaign.status === 'archived') throw Object.assign(new Error('Restore the campaign before publishing'), { status: 400 });
  const version = await addVersion(workspaceId, id, page.document, 'publish', 'Published', userId);
  const updated = must(await db().from('landing_pages').update({ status: 'published', published_version_id: version.id, published_at: new Date().toISOString(), unpublished_at: null }).eq('workspace_id', workspaceId).eq('id', id).select(PAGE_COLS).single(), 'publish');
  if (campaign.status === 'draft') await updateCampaign(workspaceId, campaign.id, { status: 'active' }, userId);
  await audit(workspaceId, 'page', id, 'published', { version_id: version.id, version_no: version.version_no }, userId);
  return { ok: true, page: updated, version, check: result };
}

export async function unpublishPage(workspaceId, id, userId) {
  await getPage(workspaceId, id, { withDocument: false });
  const updated = must(await db().from('landing_pages').update({ status: 'unpublished', unpublished_at: new Date().toISOString() }).eq('workspace_id', workspaceId).eq('id', id).select(PAGE_COLS).single(), 'unpublish');
  await audit(workspaceId, 'page', id, 'unpublished', {}, userId);
  return updated;
}

// ---- public -----------------------------------------------------------------------------------------------------------

export async function getPublishedBySlug(slug) {
  if (!/^[a-z0-9-]{1,80}$/.test(String(slug || ''))) return null;
  const page = must(await db().from('landing_pages').select(`${PAGE_COLS}`).eq('slug', slug).eq('status', 'published').maybeSingle(), 'public page');
  if (!page?.published_version_id) return null;
  const campaign = must(await db().from('landing_campaigns').select('id, name, status').eq('id', page.campaign_id).eq('workspace_id', page.workspace_id).maybeSingle(), 'public campaign');
  if (!campaign || campaign.status === 'archived' || campaign.status === 'paused') return null;
  const version = must(await db().from('landing_page_versions').select('id, version_no, document').eq('id', page.published_version_id).eq('page_id', page.id).maybeSingle(), 'public version');
  if (!version) return null;
  return { page, campaign, version: { id: version.id, version_no: version.version_no }, document: normaliseDocument(version.document) };
}

export async function getPublishedById(pageId) {
  const page = must(await db().from('landing_pages').select(PAGE_COLS).eq('id', pageId).eq('status', 'published').maybeSingle(), 'submit page');
  if (!page?.published_version_id) return null;
  const campaign = must(await db().from('landing_campaigns').select('id, name, status').eq('id', page.campaign_id).eq('workspace_id', page.workspace_id).maybeSingle(), 'submit campaign');
  if (!campaign || campaign.status === 'archived' || campaign.status === 'paused') return null;
  const version = must(await db().from('landing_page_versions').select('id, document').eq('id', page.published_version_id).maybeSingle(), 'submit version');
  if (!version) return null;
  return { page, campaign, version, document: normaliseDocument(version.document) };
}

export async function recordEvent({ page, type, visitorHash, attribution }) {
  const res = await db().from('landing_page_events').insert({ workspace_id: page.workspace_id, campaign_id: page.campaign_id, page_id: page.id, type, visitor_hash: visitorHash, attribution: attribution || {} });
  if (res.error) throw new Error(res.error.message);
}

// Records the enquiry durably. A repeat with the same idempotency key returns the original record.
export async function recordSubmission(row) {
  const res = await db().from('landing_page_submissions').insert(row).select('id, status, lead_id').single();
  if (!res.error) return { submission: res.data, duplicate: false };
  if (/duplicate|unique/i.test(res.error.message || '')) {
    const existing = must(await db().from('landing_page_submissions').select('id, status, lead_id').eq('page_id', row.page_id).eq('idempotency_key', row.idempotency_key).maybeSingle(), 'existing submission');
    if (existing) return { submission: existing, duplicate: true };
  }
  throw new Error(`record submission failed: ${res.error.message}`);
}

export async function syncSubmission(submissionId) {
  const res = await db().rpc('lp_sync_submission', { p_submission_id: submissionId });
  if (res.error) {
    const msg = String(res.error.message || res.error).slice(0, 500);
    const cur = await db().from('landing_page_submissions').select('attempts').eq('id', submissionId).maybeSingle();
    await db().from('landing_page_submissions').update({ status: 'failed', last_error: msg, attempts: (cur.data?.attempts || 0) + 1 }).eq('id', submissionId);
    return { ok: false, error: msg };
  }
  return { ok: true, leadId: res.data };
}

export async function retryPendingSubmissions({ workspaceId = null, limit = 25 } = {}) {
  let q = db().from('landing_page_submissions').select('id, attempts').neq('status', 'synced').lt('attempts', 10).order('created_at', { ascending: true }).limit(limit);
  if (workspaceId) q = q.eq('workspace_id', workspaceId);
  const rows = must(await q, 'pending submissions') || [];
  const results = [];
  for (const r of rows) results.push({ id: r.id, ...(await syncSubmission(r.id)) });
  return results;
}

export async function listSubmissions(workspaceId, campaignId, { limit = 50 } = {}) {
  return must(await db().from('landing_page_submissions').select('id, page_id, name, email, phone, fields, consent, attribution, status, attempts, last_error, lead_id, created_at, synced_at').eq('workspace_id', workspaceId).eq('campaign_id', campaignId).order('created_at', { ascending: false }).limit(limit), 'list submissions') || [];
}
