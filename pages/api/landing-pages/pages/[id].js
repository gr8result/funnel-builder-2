// GET  /api/landing-pages/pages/:id                      -> page draft, campaign brief, publish status, public URL
// GET  /api/landing-pages/pages/:id?versions=1           -> version history
// GET  /api/landing-pages/pages/:id?version=<id>         -> one version's document (for preview before restoring)
// PUT  /api/landing-pages/pages/:id { document, baseRevision, kind, label }  -> save (autosave | save | ai)
// POST /api/landing-pages/pages/:id { action }           -> publish | unpublish | restore | assistant | check | marketing | upload

import { withWorkspace } from '../../../../lib/withWorkspace';
import { checkRateLimit } from '../../../../lib/rateLimit';
import { storeImage } from '../../../../lib/landing-pages/upload';
import * as repo from '../../../../lib/landing-pages/repository';
import { checkForPublish } from '../../../../lib/landing-pages/publishCheck';
import { normaliseDocument } from '../../../../lib/landing-pages/pageModel';
import { finaliseBatchEdit, guardProposal, interpretInstruction } from '../../../../lib/landing-pages/aiEdit';
import { aiAvailable, proposeBatchEdit, writeSocialPosts } from '../../../../lib/landing-pages/ai';
import { trackedLinks, publicPageUrl, fallbackSocialPosts } from '../../../../lib/landing-pages/marketing';
import { badRequest, publicBaseUrl, sendError } from '../../../../lib/landing-pages/http';

export const config = { api: { bodyParser: { sizeLimit: '12mb' } }, maxDuration: 300 };

async function pagePayload(req, page) {
  const campaign = await repo.getCampaign(req.workspaceId, page.campaign_id);
  const base = publicBaseUrl(req);
  return { page, campaign: { id: campaign.id, name: campaign.name, status: campaign.status, brief: campaign.brief }, publicUrl: publicPageUrl(base, page.slug) };
}

function documentImages(document) {
  const images = [];
  const visit = (value, sectionType) => {
    if (Array.isArray(value)) return value.forEach((item) => visit(item, sectionType));
    if (!value || typeof value !== 'object') return;
    if (typeof value.src === 'string' && value.src) images.push({ ...value, sectionType });
    Object.values(value).forEach((item) => visit(item, sectionType));
  };
  (document?.sections || []).forEach((section) => visit(section.props, section.type));
  return images;
}

async function assistantAssets(req, campaign, document) {
  const campaignMedia = (campaign.brief?.media || []).filter((item) => item?.src && item.kind !== 'video');
  let workspaceMedia = [];
  try {
    const campaigns = await repo.listCampaigns(req.workspaceId);
    workspaceMedia = campaigns.flatMap((item) => [
      ...(item.brief?.media || [])
        .filter((media) => media?.src && media.kind !== 'video')
        .map((media) => ({
          ...media,
          description: [media.description, media.alt, item.name, item.brief?.industry, item.brief?.offering].filter(Boolean).join(' · '),
          tags: [...(media.tags || []), item.brief?.industry, item.brief?.offering].filter(Boolean),
        })),
      ...(item.pages || []).map((page) => ({
        src: page.thumbnail,
        alt: `${item.name} campaign image`,
        description: [item.name, item.brief?.industry, item.brief?.offering].filter(Boolean).join(' · '),
      })).filter((media) => media.src),
    ]);
    const pageContexts = campaigns.flatMap((item) => (item.pages || []).map((page) => ({ pageId: page.id, campaign: item }))).slice(0, 30);
    const documents = await Promise.all(pageContexts.map(async ({ pageId, campaign: item }) => {
      try {
        const page = await repo.getPage(req.workspaceId, pageId);
        return documentImages(page.document).map((media) => ({
          ...media,
          description: [media.alt, item.name, item.brief?.industry, item.brief?.offering].filter(Boolean).join(' · '),
          tags: [...(media.tags || []), media.sectionType === 'gallery' ? 'landing-gallery' : '', item.brief?.industry, item.brief?.offering].filter(Boolean),
        }));
      } catch {
        return [];
      }
    }));
    workspaceMedia.push(...documents.flat());
  } catch (error) {
    console.warn('[landing-pages] assistant campaign imagery unavailable:', error.message);
  }
  let library = [];
  try {
    const [{ listMergedSharedMediaLibrary }, { supabaseAdmin }] = await Promise.all([
      import('../../../../lib/sharedMediaLibrary'),
      import('../../../../lib/supabaseAdmin'),
    ]);
    library = await listMergedSharedMediaLibrary({
      admin: supabaseAdmin,
      userId: req.user.id,
      limit: 500,
      includeEmailTemplateImages: false,
    });
  } catch (error) {
    console.warn('[landing-pages] assistant Media Library unavailable:', error.message);
  }
  const owned = [...campaignMedia, ...documentImages(document), ...workspaceMedia];
  const reachableOwned = (await Promise.all(owned.map(async (item) => {
    try {
      const response = await fetch(item.src, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
      const contentType = response.headers.get('content-type') || '';
      return response.ok && (!contentType || contentType.startsWith('image/')) ? item : null;
    } catch {
      return null;
    }
  }))).filter(Boolean);
  const all = [...reachableOwned, ...library.map((item) => ({ ...item, src: item.src || item.url }))];
  const seen = new Set();
  return all.filter((item) => item.src && !seen.has(item.src) && seen.add(item.src));
}

async function handler(req, res) {
  const { workspaceId } = req;
  const id = String(req.query.id || '');
  try {
    if (req.method === 'GET') {
      if (req.query.versions === '1') return res.status(200).json({ ok: true, versions: await repo.listVersions(workspaceId, id) });
      if (req.query.version) return res.status(200).json({ ok: true, version: await repo.getVersion(workspaceId, id, String(req.query.version)) });
      const page = await repo.getPage(workspaceId, id);
      return res.status(200).json({ ok: true, ...(await pagePayload(req, page)), check: checkForPublish(page.document) });
    }

    if (req.method === 'PUT') {
      const { document, baseRevision, kind = 'save', label = null, title = null } = req.body || {};
      if (!document || typeof document !== 'object') throw badRequest('document is required');
      if (!['save', 'autosave', 'ai'].includes(kind)) throw badRequest('Invalid save kind');
      if (JSON.stringify(document).length > 900_000) throw badRequest('This page is too large to save');
      const { page, version } = await repo.saveDraft(workspaceId, id, { document, baseRevision, kind, label, title }, req.user.id);
      return res.status(200).json({ ok: true, revision: page.revision, version, savedAt: page.updated_at, check: checkForPublish(page.document) });
    }

    if (req.method === 'POST') {
      const action = String(req.body?.action || '');
      if (action === 'check') {
        const page = await repo.getPage(workspaceId, id);
        return res.status(200).json({ ok: true, check: checkForPublish(page.document) });
      }
      if (action === 'publish') {
        const result = await repo.publishPage(workspaceId, id, req.user.id, { check: checkForPublish });
        if (!result.ok) return res.status(422).json({ ok: false, error: 'Fix these issues before publishing', check: result.check });
        return res.status(200).json({ ok: true, page: result.page, version: result.version, check: result.check, publicUrl: publicPageUrl(publicBaseUrl(req), result.page.slug) });
      }
      if (action === 'unpublish') {
        return res.status(200).json({ ok: true, page: await repo.unpublishPage(workspaceId, id, req.user.id) });
      }
      if (action === 'restore') {
        const { versionId, baseRevision } = req.body;
        const { page, version } = await repo.restoreVersion(workspaceId, id, String(versionId || ''), baseRevision, req.user.id);
        return res.status(200).json({ ok: true, document: page.document, revision: page.revision, version });
      }
      if (action === 'assistant') {
        const instruction = String(req.body.instruction || '').trim().slice(0, 4000);
        if (!instruction) throw badRequest('Tell the assistant what to change');
        if (!checkRateLimit(`lp-assist:${workspaceId}`, 30, 60_000).ok) return res.status(429).json({ ok: false, error: 'Too many requests — try again in a minute.' });
        const page = await repo.getPage(workspaceId, id);
        // The editor may hold unsaved edits; the proposal is made against what the builder is looking at.
        const doc = req.body.document && typeof req.body.document === 'object' ? normaliseDocument(req.body.document) : page.document;
        const campaign = await repo.getCampaign(workspaceId, page.campaign_id);
        const selectedSectionId = req.body.selectedSectionId || null;
        let proposal = interpretInstruction(doc, instruction, { brief: campaign.brief, selectedSectionId });
        let source = 'built-in';
        let ai = null;
        if (aiAvailable()) {
          try { proposal = await proposeBatchEdit(doc, instruction, { brief: campaign.brief, selectedSectionId, onResult: (result) => { ai = result; } }); source = 'ai'; } catch (e) { console.warn('[landing-pages] batch assistant AI unavailable:', e.message); }
        }
        const baseProposal = proposal || { summary: 'Applied safe page improvements.', ops: [] };
        let edited = doc;
        let guarded = { ok: true, summary: baseProposal.summary, ops: [], issues: [], document: doc };
        if (baseProposal.ops?.length) {
          guarded = guardProposal(doc, baseProposal, { brief: campaign.brief, instruction });
          if (!guarded.ok) return res.status(200).json({ ok: true, ai, proposal: null, message: guarded.error || 'That batch could not be applied safely.', issues: guarded.issues });
          edited = guarded.document;
        }
        const batch = finaliseBatchEdit(doc, edited, {
          brief: campaign.brief,
          instruction,
          assets: await assistantAssets(req, campaign, edited),
        });
        if (!batch.changes.length) return res.status(200).json({ ok: true, ai, proposal: null, message: 'No safe page changes could be produced from that instruction.', issues: batch.failures });
        const completed = batch.outcomes.filter((item) => item.complete).length;
        const summary = batch.failures.length
          ? `${completed} requested changes completed. ${batch.failures.length} item${batch.failures.length === 1 ? '' : 's'} need attention.`
          : `${Math.max(completed, batch.changes.length)} changes completed. Your updated page is ready.`;
        return res.status(200).json({
          ok: true,
          source,
          ai,
          proposal: {
            summary,
            ops: guarded.ops,
            issues: batch.failures,
            warnings: batch.warnings,
            outcomes: batch.outcomes,
            changes: batch.changes.map(({ before, after, ...change }) => change),
            document: batch.document,
            complete: batch.complete,
          },
        });
      }
      if (action === 'marketing') {
        const page = await repo.getPage(workspaceId, id);
        const campaign = await repo.getCampaign(workspaceId, page.campaign_id);
        const base = publicBaseUrl(req);
        const url = publicPageUrl(base, page.slug);
        const headline = page.document.sections.find((s) => s.type === 'hero')?.props?.headline || campaign.name;
        const links = trackedLinks(base, page.slug, campaign.name);
        let posts = null; let usedAi = false;
        if (req.body.writePosts && aiAvailable() && checkRateLimit(`lp-ai:${workspaceId}`, 60, 60_000).ok) {
          try { posts = await writeSocialPosts(campaign.brief, { url: links[0].url, headline }); usedAi = true; } catch (e) { console.warn('[landing-pages] social AI unavailable:', e.message); }
        }
        if (!posts) posts = fallbackSocialPosts(campaign.brief, { url: links[0].url, headline });
        return res.status(200).json({ ok: true, published: page.status === 'published', url, links, posts, usedAi, preview: { title: page.document.seo.title, description: page.document.seo.description, image: page.document.seo.ogImage } });
      }
      if (action === 'upload') {
        await repo.getPage(workspaceId, id, { withDocument: false });
        return res.status(200).json({ ok: true, url: await storeImage(workspaceId, id, req.body) });
      }
      throw badRequest('Unknown action');
    }
    res.setHeader('Allow', 'GET, PUT, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    return sendError(res, err);
  }
}

export { handler };
export default withWorkspace(handler);
