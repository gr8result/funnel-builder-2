import { withWorkspace } from '../../../lib/withWorkspace';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { createSelectionRepository, SELECTION_RESOURCES } from '../../../lib/builders/selectionRepository';
import { SELECTION_SLOTS } from '../../../lib/builders/selectionRegistry';

export async function selectionFoundationHandler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const repository = createSelectionRepository(supabaseAdmin, req.workspaceId);
  try {
    if (req.method === 'GET') {
      const resource = req.query.resource;
      if (resource) {
        if (!SELECTION_RESOURCES[resource]) return res.status(400).json({ error: 'Unknown resource.' });
        return res.status(200).json({ records: await repository.list(resource) });
      }
      const resources = ['configurations', 'aliases', 'schedules', 'mappings'];
      const values = await Promise.all(resources.map(resourceName => repository.list(resourceName)));
      return res.status(200).json({ workspace_id: req.workspaceId, slots: SELECTION_SLOTS, ...Object.fromEntries(resources.map((name, index) => [name, values[index]])) });
    }
    if (req.method === 'POST') {
      if (!['owner', 'admin'].includes(req.memberRole)) return res.status(403).json({ error: 'Builder configuration requires an owner or admin.' });
      const record = await repository.save(req.body?.resource, req.body?.record || {});
      return res.status(200).json({ record });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    return res.status(error.statusCode || (error.code === '23503' || error.code === '23514' ? 400 : 500)).json({ error: error.message });
  }
}

export default withWorkspace(selectionFoundationHandler);
