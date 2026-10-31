// GET  /api/landing-pages/campaigns            -> campaigns for the workspace, with pages and visit/lead stats
// POST /api/landing-pages/campaigns { name }   -> create a campaign (starts the AI interview)

import { withWorkspace } from '../../../../lib/withWorkspace';
import { createCampaign, listCampaigns, campaignBusinessDefaults } from '../../../../lib/landing-pages/repository';
import { sanitiseBrief } from '../../../../lib/landing-pages/interview';
import { aiAvailable, extractQuickBrief } from '../../../../lib/landing-pages/ai';
import { sendError } from '../../../../lib/landing-pages/http';

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const campaigns = await listCampaigns(req.workspaceId, { includeArchived: req.query.archived === '1' });
      return res.status(200).json({ ok: true, campaigns });
    }
    if (req.method === 'POST') {
      const defaults = await campaignBusinessDefaults(req.workspaceId, req.workspace?.name || '');
      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim().slice(0, 4000) : '';
      let brief = defaults;
      if (prompt) {
        let extracted = {};
        if (aiAvailable()) {
          try { extracted = await extractQuickBrief(prompt, defaults); }
          catch (error) { console.warn('[landing-pages] quick brief extraction unavailable; continuing to guided setup:', error.message); }
        }
        brief = { ...defaults, ...sanitiseBrief(extracted), campaignPrompt: prompt };
        if (!brief.offering && !aiAvailable()) brief.offering = prompt.slice(0, 300);
      }
      const name = req.body?.name || brief.campaignName || (prompt ? prompt.split(/[.!?\n]/)[0].slice(0, 120) : '');
      const campaign = await createCampaign(req.workspaceId, req.user.id, { name, brief });
      return res.status(201).json({ ok: true, campaign });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    return sendError(res, err);
  }
}

export { handler };
export default withWorkspace(handler);
