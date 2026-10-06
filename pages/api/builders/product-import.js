import { withWorkspace } from '../../../lib/withWorkspace';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { previewBuilderCsv } from '../../../lib/product-library/builderCsvImport';

export const config = { api: { bodyParser: { sizeLimit: '3mb' } } };
export async function productImportHandler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }); }
  if (!['owner', 'admin'].includes(req.memberRole)) return res.status(403).json({ error: 'Builder administrator required.' });
  try {
    const { action, csv, mapping, slotMappings, batchId, rows, confirmed } = req.body || {};
    if (action === 'preview') {
      async function list(table) {
        const records = [];
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await supabaseAdmin.from(table).select('*').eq('workspace_id', req.workspaceId).order('id').range(offset, offset + 999);
          if (error) throw error;
          records.push(...data);
          if (data.length < 1000) return records;
        }
      }
      const [products, suppliers, aliases] = await Promise.all(['builder_products', 'builder_product_suppliers', 'builder_selection_aliases'].map(list));
      const plan = previewBuilderCsv({ workspaceId: req.workspaceId, csv, mapping, slotMappings, products, suppliers, aliases });
      const baseline = Object.fromEntries(Object.entries({ products, suppliers, aliases }).map(([key, records]) => [key, Object.fromEntries(records.map(record => [record.id, record]))]));
      const { data, error } = await supabaseAdmin.from('builder_product_imports').insert({ workspace_id: req.workspaceId, created_by: req.user.id, plan, baseline }).select('id').single();
      if (error) throw error;
      return res.status(200).json({ batchId: data.id, ...plan });
    }
    if (action === 'commit') {
      if (confirmed !== true || !Array.isArray(rows) || !rows.length || rows.length > 2000 || rows.some(row => !Number.isInteger(row))) return res.status(400).json({ error: 'Confirm the preview and select valid rows.' });
      const { data, error } = await supabaseAdmin.rpc('commit_builder_product_import', { p_workspace: req.workspaceId, p_user: req.user.id, p_batch: batchId, p_rows: rows });
      if (error) throw error;
      return res.status(200).json({ report: data });
    }
    return res.status(400).json({ error: 'Choose preview or commit.' });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Import failed.' });
  }
}
export default withWorkspace(productImportHandler, { roles: ['owner', 'admin'] });
