import { withWorkspace, INTERNAL_COMMERCIAL_ROLES } from '../../../lib/withWorkspace';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { createSelectionRepository, SELECTION_RESOURCES } from '../../../lib/builders/selectionRepository';
import { SELECTION_SLOTS } from '../../../lib/builders/selectionRegistry';

function isMissingRequirementMappingsTable(resource, error) {
  return resource === 'requirementMappings'
    && ['42P01', 'PGRST205'].includes(error?.code)
    && /builder_requirement_quote_mappings/.test(String(error?.message || ''));
}

export async function selectionFoundationHandler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const repository = createSelectionRepository(supabaseAdmin, req.workspaceId);
  try {
    if (req.method === 'GET') {
      const resource = req.query.resource;
      if (resource) {
        if (!SELECTION_RESOURCES[resource]) return res.status(400).json({ error: 'Unknown resource.' });
        try {
          return res.status(200).json({ records: await repository.list(resource) });
        } catch (error) {
          if (!isMissingRequirementMappingsTable(resource, error)) throw error;
          return res.status(503).json({
            error: 'Requirement mappings are unavailable. Apply the builder requirement mappings migration, then retry.',
            code: 'REQUIREMENT_MAPPINGS_MIGRATION_REQUIRED',
          });
        }
      }
      const resources = ['configurations', 'aliases', 'schedules', 'mappings', 'requirementMappings'];
      const unavailableResources = [];
      const values = await Promise.all(resources.map(async resourceName => {
        try { return await repository.list(resourceName); }
        catch (error) {
          if (!isMissingRequirementMappingsTable(resourceName, error)) throw error;
          unavailableResources.push(resourceName);
          return [];
        }
      }));
      return res.status(200).json({
        workspace_id: req.workspaceId,
        slots: SELECTION_SLOTS,
        ...Object.fromEntries(resources.map((name, index) => [name, values[index]])),
        ...(unavailableResources.length ? { unavailableResources } : {}),
      });
    }
    if (req.method === 'POST') {
      if (!['owner', 'admin'].includes(req.memberRole)) return res.status(403).json({ error: 'Builder configuration requires an owner or admin.' });
      const record = await repository.save(req.body?.resource, req.body?.resource === 'requirementMappings'
        ? { ...(req.body?.record || {}), verified_by: req.user?.id ?? null, verified_at: new Date().toISOString() }
        : req.body?.record || {});
      return res.status(200).json({ record });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    if (isMissingRequirementMappingsTable(req.body?.resource, error)) {
      return res.status(503).json({
        error: 'Requirement mappings are unavailable. Apply the builder requirement mappings migration, then retry.',
        code: 'REQUIREMENT_MAPPINGS_MIGRATION_REQUIRED',
      });
    }
    return res.status(error.statusCode || (error.code === '23503' || error.code === '23514' ? 400 : 500)).json({ error: error.message });
  }
}

export default withWorkspace(selectionFoundationHandler, { roles: INTERNAL_COMMERCIAL_ROLES });
