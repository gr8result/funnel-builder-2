import { withWorkspace } from '../../../lib/withWorkspace';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { planUpgradeVariationTransition } from '../../../lib/standard-inclusions/upgradeVariation.mjs';

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  const { projectId, variationId, action } = req.body || {};
  if (!projectId || !variationId || !['approve', 'issue'].includes(action)) return res.status(400).json({ ok: false, error: 'Project, variation and a supported action are required.' });
  try {
    const { data: variation, error } = await supabaseAdmin.from('builder_variations').select('*')
      .eq('workspace_id', req.workspaceId).eq('project_id', projectId).eq('id', variationId).maybeSingle();
    if (error) throw error;
    if (!variation) return res.status(404).json({ ok: false, error: 'Variation not found in this workspace and job.' });
    let patch;
    try { patch = planUpgradeVariationTransition(variation, action, { userId: req.user.id, now: new Date().toISOString() }); }
    catch (transitionError) { return res.status(409).json({ ok: false, error: transitionError.message }); }
    let approval;
    if (action === 'issue') {
      const existing = await supabaseAdmin.from('client_portal_approvals').select('id,status')
        .eq('workspace_id', req.workspaceId).eq('project_id', projectId)
        .eq('related_table', 'builder_variations').eq('related_record_id', variation.id).eq('approval_type', 'variation').maybeSingle();
      if (existing.error) throw existing.error;
      approval = existing.data;
      if (approval && !['not_issued', 'awaiting_client', 'viewed'].includes(approval.status)) return res.status(409).json({ ok: false, error: 'The client has already responded to this variation.' });
      if (!approval) {
        const created = await supabaseAdmin.from('client_portal_approvals').upsert({
          workspace_id: req.workspaceId, project_id: projectId, related_table: 'builder_variations', related_record_id: variation.id,
          approval_type: 'variation', item_title: `${variation.variation_number}: ${variation.title}`, status: 'not_issued',
          allow_reject: true, requires_signature: false, created_by: req.user.id, updated_by: req.user.id,
          metadata: { source: 'standard_inclusion_upgrade', variationId: variation.id, total: variation.total, paymentStatus: 'outstanding' },
        }, { onConflict: 'workspace_id,project_id,related_table,related_record_id,approval_type', ignoreDuplicates: true });
        if (created.error) throw created.error;
      }
    }
    const updated = await supabaseAdmin.from('builder_variations').update({ ...patch, updated_by: req.user.id, updated_at: new Date().toISOString() })
      .eq('workspace_id', req.workspaceId).eq('project_id', projectId).eq('id', variation.id).eq('status', variation.status).select('*').maybeSingle();
    if (updated.error) throw updated.error;
    if (!updated.data) return res.status(409).json({ ok: false, error: 'This variation changed during review. Reload before continuing.' });
    if (action === 'issue' && !['awaiting_client', 'viewed'].includes(approval?.status)) {
      const issued = await supabaseAdmin.from('client_portal_approvals').update({ status: 'awaiting_client', date_issued: patch.submitted_at, updated_by: req.user.id })
        .eq('workspace_id', req.workspaceId).eq('project_id', projectId).eq('related_table', 'builder_variations')
        .eq('related_record_id', variation.id).eq('approval_type', 'variation').eq('status', 'not_issued');
      if (issued.error) throw issued.error;
    }
    return res.status(200).json({ ok: true, variation: updated.data });
  } catch (error) {
    console.error('[standard-inclusions/upgrade-variation]', error?.message);
    return res.status(503).json({ ok: false, error: 'The upgrade could not be reviewed or issued. Reload and retry; no payment has been recorded.' });
  }
}

export default withWorkspace(handler, { roles: ['owner', 'admin'], authTimeoutMs: 8000 });