// GET   /api/landing-pages/campaigns/:id                 -> campaign, pages, stats, recent enquiries, interview state
// PATCH /api/landing-pages/campaigns/:id                 -> edit name, status, dates or brief fields
// POST  /api/landing-pages/campaigns/:id { action }      -> interview | generate | duplicate | archive | restore | retry-sync

import { withWorkspace } from '../../../../lib/withWorkspace';
import { checkRateLimit } from '../../../../lib/rateLimit';
import * as repo from '../../../../lib/landing-pages/repository';
import { applyAnswer, nextStep, progress, sanitiseBrief, emptyInterview, missingEssentials } from '../../../../lib/landing-pages/interview';
import { composeDocument, recommendStructure, validateStructure, copyQualityIssues } from '../../../../lib/landing-pages/generator';
import { aiAvailable, correctBriefForCopy, extractInterviewFields, generateHeroImage, planCampaign, writePageCopy } from '../../../../lib/landing-pages/ai';
import { badRequest, sendError } from '../../../../lib/landing-pages/http';
import { storeImage } from '../../../../lib/landing-pages/upload';
import { applyImageAssignments, buildImagePlan, inspectDesignQuality, matchImagesToPlan, repairDocumentDesign } from '../../../../lib/landing-pages/imagery';
import { budgetStatus, imagePriceUsd } from '../../../../lib/landing-pages/imageBudget';
import { dropSimilarAssignments } from '../../../../lib/landing-pages/imageSimilarity';
import { getAt, safeUrl } from '../../../../lib/landing-pages/pageModel';

export const config = { api: { bodyParser: { sizeLimit: '12mb' } }, maxDuration: 300 };

async function detail(workspaceId, id) {
  const campaign = await repo.getCampaign(workspaceId, id);
  const [all] = await Promise.all([repo.listCampaigns(workspaceId, { includeArchived: true })]);
  const withPages = all.find((c) => c.id === id) || { ...campaign, pages: [], stats: {} };
  const submissions = await repo.listSubmissions(workspaceId, id, { limit: 50 });
  const interview = campaign.interview && Object.keys(campaign.interview).length ? campaign.interview : emptyInterview();
  return {
    campaign: { ...campaign, interview },
    pages: withPages.pages,
    stats: withPages.stats,
    submissions,
    interview: { next: nextStep(campaign.brief, interview), progress: progress(campaign.brief, interview), structure: recommendStructure(campaign.brief) },
    aiAvailable: aiAvailable(),
  };
}

async function handler(req, res) {
  const { workspaceId } = req;
  const id = String(req.query.id || '');
  try {
    if (req.method === 'GET') return res.status(200).json({ ok: true, ...(await detail(workspaceId, id)) });

    if (req.method === 'PATCH') {
      const body = req.body || {};
      const current = await repo.getCampaign(workspaceId, id);
      const patch = {};
      if (body.name != null) patch.name = body.name;
      if (body.status != null) patch.status = body.status;
      if ('starts_on' in body) patch.starts_on = body.starts_on;
      if ('ends_on' in body) patch.ends_on = body.ends_on;
      if (body.brief) patch.brief = { ...current.brief, ...sanitiseBrief(body.brief), ...(body.name ? { campaignName: String(body.name).trim() } : {}) };
      else if (body.name) patch.brief = { ...current.brief, campaignName: String(body.name).trim() };
      await repo.updateCampaign(workspaceId, id, patch, req.user.id);
      return res.status(200).json({ ok: true, ...(await detail(workspaceId, id)) });
    }

    if (req.method === 'POST') {
      const action = String(req.body?.action || '');
      if (action === 'interview') {
        const { stepKey, answer, skip = false } = req.body;
        const campaign = await repo.getCampaign(workspaceId, id);
        let extracted = {}; let followUp = null; let ai = null;
        if (!skip && aiAvailable() && typeof answer === 'string' && answer.trim().length > 3 && checkRateLimit(`lp-ai:${workspaceId}`, 60, 60_000).ok) {
          try { ({ extracted, followUp } = await extractInterviewFields(stepKey, answer, campaign.brief, { onResult: (result) => { ai = result; } })); } catch (e) { console.warn('[landing-pages] interview AI unavailable:', e.message); }
        }
        let result;
        try {
          result = applyAnswer({ brief: campaign.brief, interview: campaign.interview || emptyInterview(), stepKey, answer, extracted: sanitiseBrief(extracted), skip });
        } catch (e) { throw badRequest(e.message); }
        const patch = { brief: result.brief, interview: result.interview };
        if (result.brief.startDate) patch.starts_on = result.brief.startDate;
        if (result.brief.endDate) patch.ends_on = result.brief.endDate;
        await repo.updateCampaign(workspaceId, id, patch, req.user.id);
        return res.status(200).json({ ok: true, followUp, ai, ...(await detail(workspaceId, id)) });
      }

      if (action === 'generate') {
        const campaign = await repo.getCampaign(workspaceId, id);
        const missing = missingEssentials(campaign.brief);
        if (missing.length) throw badRequest(`A few answers are still needed first: ${missing.join(', ')}`);
        const existing = (await repo.listCampaigns(workspaceId, { includeArchived: true })).find((c) => c.id === id)?.pages?.[0];
        if (existing && req.body.replace !== true) throw Object.assign(new Error('This campaign already has a page. Open it in the editor, or regenerate it.'), { status: 409, pageId: existing.id });
        const imageryRequested = req.body.generateImage === true;
        const generationBrief = { ...campaign.brief, imagePlanningEnabled: imageryRequested };
        const fallbackStructure = recommendStructure(generationBrief);
        const hasManualStructure = Array.isArray(req.body.structure) && req.body.structure.length > 0;
        let structure = hasManualStructure ? validateStructure(req.body.structure, generationBrief, fallbackStructure) : fallbackStructure;
        let aiCopy = null; let strategy = null; let ai = null; let qualityAi = null; let architectureAi = null; let architectureUsedAi = false; let copyBrief = campaign.brief; let correctionAi = null; let correctionUsedAi = false;
        if (aiAvailable() && req.body.useAi !== false && checkRateLimit(`lp-gen:${workspaceId}`, 10, 60_000).ok) {
          try {
            copyBrief = await correctBriefForCopy(campaign.brief, { onResult: (result) => { correctionAi = result; } });
            correctionUsedAi = true;
          } catch (e) { console.warn('[landing-pages] copy proofreading unavailable, using original brief:', e.message); }
          {
            try {
              const proposal = await planCampaign(copyBrief, { onResult: (result) => { architectureAi = result; } });
              strategy = proposal.strategy;
              if (!hasManualStructure) structure = validateStructure(proposal.sections, { ...copyBrief, imagePlanningEnabled: imageryRequested }, fallbackStructure);
              architectureUsedAi = true;
            } catch (e) { console.warn('[landing-pages] structure AI unavailable, using brief-based plan:', e.message); }
          }
          try { aiCopy = await writePageCopy(copyBrief, structure, { strategy, onResult: (result) => { ai = result; } }); } catch (e) { console.warn('[landing-pages] generation AI unavailable, using built-in copy:', e.message); }
          const issues = aiCopy ? copyQualityIssues(aiCopy, copyBrief) : [];
          if (issues.length) {
            try { aiCopy = await writePageCopy(copyBrief, structure, { strategy, previousCopy: aiCopy, qualityIssues: issues, onResult: (result) => { qualityAi = result; } }); }
            catch (e) { console.warn('[landing-pages] copy quality revision unavailable:', e.message); }
          }
        }
        const composed = composeDocument({ ...copyBrief, imagePlanningEnabled: imageryRequested }, { aiCopy, structure, strategy });
        let document = composed.document;
        const { removedClaims } = composed;
        const qualityIssues = aiCopy ? copyQualityIssues(aiCopy, copyBrief) : ['AI copy unavailable; review the built-in copy before publishing.'];
        document.generation = { ...(document.generation || {}), qualityIssues };
        if (imageryRequested) {
          const plan = buildImagePlan(document, copyBrief, strategy);
          const suppliedMedia = (copyBrief.media || [])
            .filter((item) => item.kind !== 'video' && safeUrl(item.src))
            .map((item, index) => ({ ...item, id: `campaign-media-${index + 1}`, owner_scope: 'user', kind: 'upload' }));
          let library = [];
          try {
            const [{ supabaseAdmin }, { listMergedSharedMediaLibrary }] = await Promise.all([
              import('../../../../lib/supabaseAdmin'),
              import('../../../../lib/sharedMediaLibrary'),
            ]);
            library = await listMergedSharedMediaLibrary({ admin: supabaseAdmin, userId: req.user.id, limit: 500, includeEmailTemplateImages: false });
          } catch (error) {
            console.warn('[landing-pages] Media Library unavailable during generation:', error.message);
          }
          let assignments = matchImagesToPlan(plan, [...suppliedMedia, ...library], copyBrief);
          const similarity = await dropSimilarAssignments(assignments, { baseUrl: `http://${req.headers.host || 'localhost:3000'}`, threshold: 6 });
          assignments = similarity.kept;
          document = applyImageAssignments(document, assignments);

          const configuredLimit = Math.max(0, Math.min(14, Number.parseInt(process.env.LANDING_PAGE_MAX_GENERATED_IMAGES || '0', 10) || 0));
          const approvedLimit = Number.isInteger(req.body.maxGeneratedImages) ? req.body.maxGeneratedImages : configuredLimit;
          const maxPaidRequests = Math.max(0, Math.min(configuredLimit, approvedLimit));
          const generatedAssignments = [];
          const providerRequests = [];
          const generatedImageData = new Set();
          const unfilled = plan.filter((slot) => !safeUrl(getAt(document.sections.find((section) => section.id === slot.sectionId)?.props || {}, slot.path)?.src));
          if (unfilled.length && aiAvailable() && maxPaidRequests > 0) {
            for (const slot of unfilled.slice(0, maxPaidRequests)) {
              if (!checkRateLimit(`lp-image:${workspaceId}`, 14, 10 * 60_000).ok) break;
              try {
                const generated = await generateHeroImage(copyBrief, { ...(strategy?.visual || {}), ...slot, workspaceId });
                if (!generated.dataUrl || generatedImageData.has(generated.dataUrl)) {
                  providerRequests.push({ outcome: 'duplicate', purpose: slot.purpose });
                  break;
                }
                generatedImageData.add(generated.dataUrl);
                const url = await storeImage(workspaceId, `campaign-${id}`, { dataUrl: generated.dataUrl, fileName: `ai-${slot.purpose}` });
                generatedAssignments.push({
                  slot,
                  source: 'openai',
                  image: {
                    src: url,
                    alt: generated.alt,
                    crop: { aspectRatio: slot.aspectRatio, focalPoint: slot.focalPoint },
                    provenance: { kind: 'ai-illustration', evidence: false },
                  },
                });
                providerRequests.push(generated.provider || { outcome: 'success' });
              } catch (error) {
                console.warn(`[landing-pages] ${slot.purpose} image generation failed:`, error.message);
                providerRequests.push({ outcome: 'error', purpose: slot.purpose, message: error.message });
                break;
              }
            }
          }
          assignments = [...assignments, ...generatedAssignments];
          document = applyImageAssignments(document, generatedAssignments);
          document.generation.imagery = {
            requested: true,
            plan,
            assignments: assignments.map(({ slot, source, score }) => ({ slotId: slot.id, purpose: slot.purpose, source, ...(Number.isFinite(score) ? { matchScore: score } : {}) })),
            providerRequests,
            similarImagesRemoved: similarity.dropped,
            generatedRequestCount: providerRequests.filter((request) => request.outcome === 'success').length,
            maxGeneratedRequests: maxPaidRequests,
            costUsd: Math.round(providerRequests.filter((request) => request.outcome === 'success').length * (imagePriceUsd(process.env.LANDING_PAGE_IMAGE_MODEL || 'gpt-image-1.5', 'medium') || 0) * 1000) / 1000,
            budget: budgetStatus(),
          };
        }
        document.generation.imageryRequested = imageryRequested;
        document = repairDocumentDesign(document);
        const designQuality = inspectDesignQuality(document);
        document.generation.designQuality = designQuality;
        if (imageryRequested && !designQuality.ok) document.generation.imageWarning = 'Suitable imagery could not be obtained for every essential visual slot. This editable draft is saved but is not visually complete; replace the flagged images before publishing.';
        let page;
        if (existing && req.body.replace === true) {
          // Regenerating keeps the old draft in version history; nothing is lost.
          const { page: saved } = await repo.saveDraft(workspaceId, existing.id, { document, baseRevision: existing.revision, kind: 'generated', label: 'Regenerated from campaign brief' }, req.user.id);
          page = saved;
        } else if (existing) {
          throw Object.assign(new Error('This campaign already has a page. Open it in the editor, or regenerate it.'), { status: 409, pageId: existing.id });
        } else {
          page = await repo.createPage(workspaceId, req.user.id, id, { title: campaign.name, document, slugBase: campaign.name });
        }
        return res.status(200).json({ ok: true, pageId: page.id, usedAi: Boolean(aiCopy), ai, architectureAi, correctionAi, qualityAi, qualityIssues, designQuality, imagery: document.generation.imagery || null, imageWarning: document.generation.imageWarning || null, aiStatus: { correction: correctionUsedAi ? 'ai' : aiAvailable() && req.body.useAi !== false ? 'fallback' : 'skipped', architecture: hasManualStructure ? 'manual' : architectureUsedAi ? 'ai' : 'fallback', copy: aiCopy ? 'ai' : 'fallback' }, structure, removedClaims });
      }

      if (action === 'duplicate') {
        const copy = await repo.duplicateCampaign(workspaceId, id, req.user.id);
        return res.status(201).json({ ok: true, campaign: copy });
      }
      if (action === 'archive' || action === 'restore') {
        const pages = (await repo.listCampaigns(workspaceId, { includeArchived: true })).find((c) => c.id === id)?.pages || [];
        if (action === 'archive') for (const p of pages) if (p.status === 'published') await repo.unpublishPage(workspaceId, p.id, req.user.id);
        await repo.updateCampaign(workspaceId, id, { status: action === 'archive' ? 'archived' : 'draft' }, req.user.id);
        return res.status(200).json({ ok: true, ...(await detail(workspaceId, id)) });
      }
      if (action === 'upload') {
        await repo.getCampaign(workspaceId, id);
        return res.status(200).json({ ok: true, url: await storeImage(workspaceId, `campaign-${id}`, req.body) });
      }
      if (action === 'generate-image') {
        const campaign = await repo.getCampaign(workspaceId, id);
        const pages = (await repo.listCampaigns(workspaceId, { includeArchived: true })).find((item) => item.id === id)?.pages || [];
        const page = pages[0] ? await repo.getPage(workspaceId, pages[0].id) : null;
        if (!checkRateLimit(`lp-image:${workspaceId}`, 4, 10 * 60_000).ok) throw Object.assign(new Error('Image generation limit reached. Try again in a few minutes.'), { status: 429 });
        const generated = process.env.LP_E2E_IMAGE_FIXTURE === '1'
          ? { dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5ZkAAAAASUVORK5CYII=', alt: 'Generated campaign image', fixture: true }
          : await generateHeroImage(campaign.brief, {
            ...(page?.document?.generation?.strategy?.visual || {}),
            purpose: String(req.body?.purpose || 'replacement').slice(0, 80),
            subject: String(req.body?.subject || '').slice(0, 500),
            aspectRatio: String(req.body?.aspectRatio || '3:2').slice(0, 20),
          });
        const url = await storeImage(workspaceId, `campaign-${id}`, { dataUrl: generated.dataUrl, fileName: `ai-${String(req.body?.purpose || 'campaign-image').slice(0, 40)}` });
        return res.status(200).json({ ok: true, url, alt: generated.alt || 'AI-generated campaign image', provenance: { kind: 'ai-illustration', evidence: false }, stored: true, source: generated.fixture ? 'fixture' : 'openai', provider: generated.provider || null });
      }
      if (action === 'retry-sync') {
        await repo.getCampaign(workspaceId, id);
        const results = await repo.retryPendingSubmissions({ workspaceId });
        return res.status(200).json({ ok: true, results, ...(await detail(workspaceId, id)) });
      }
      throw badRequest('Unknown action');
    }
    res.setHeader('Allow', 'GET, PATCH, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    if (err.pageId) return res.status(409).json({ ok: false, error: err.message, pageId: err.pageId });
    if (req.method === 'POST' && req.body?.action === 'generate') {
      // Leave a trace when generation fails so a campaign without a page is explainable from its audit history.
      await repo.audit(workspaceId, 'campaign', id, 'generation_failed', { status: err.status || 500, message: String(err.message || '').slice(0, 300) }, req.user?.id || null);
    }
    if (req.body?.action === 'generate-image' && err.status >= 500) {
      console.warn('[landing-pages] image generation unavailable:', err.message);
      return res.status(err.status).json({ ok: false, error: 'Image generation is unavailable. No replacement was applied. Upload an image or check the image-provider configuration before explicitly retrying.' });
    }
    return sendError(res, err);
  }
}

export { handler };
export default withWorkspace(handler);
