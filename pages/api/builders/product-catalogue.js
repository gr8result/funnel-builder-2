import { withWorkspace } from '../../../lib/withWorkspace';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { createBuilderCatalogueRepository } from '../../../lib/product-library/builderCatalogueRepository.js';
import { toBrowserCatalogueProduct } from '../../../lib/product-library/browserCatalogueContract.mjs';

export async function productCatalogueHandler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const repository = createBuilderCatalogueRepository(supabaseAdmin, req.workspaceId);
    if (req.method === 'GET') {
      const source = String(req.query?.source || 'effective');
      if (source === 'stored') {
        const stored = await repository.load();
        return res.status(200).json({ workspace_id: req.workspaceId, ...stored, source });
      }
      const { getEffectiveProductCatalogue } = await import('../../../lib/product-library/catalogueService.js');
      const effective = getEffectiveProductCatalogue({ organisationId: req.workspaceId }).canonicalProducts.map(toBrowserCatalogueProduct);
      if (source === 'canonical') {
        return res.status(200).json({ workspace_id: req.workspaceId, products: effective, effective_count: effective.length, source });
      }
      const stored = await repository.load();
      const products = [...new Map([...effective, ...(stored.products || [])].map((product) => [
        String(product.id || product.productId || product.stableProductId || product.productCode || ''),
        product,
      ]).filter(([id]) => id)).values()];
      return res.status(200).json({ workspace_id: req.workspaceId, ...stored, products, effective_count: effective.length });
    }
    if (req.method === 'POST') {
      if (!['owner', 'admin'].includes(req.memberRole)) return res.status(403).json({ error: 'Builder administrator required.' });
      return res.status(200).json({ record: await repository.save(req.body?.action, req.body?.record || {}) });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    const schemaMissing = ['42P01', 'PGRST205', 'PGRST204', '42703'].includes(error.code);
    return res.status(schemaMissing ? 503 : 400).json({ error: schemaMissing ? 'Product Library database schema is unavailable. Ask the database owner to review the existing Product Library migrations; no migration was applied.' : error.message });
  }
}

export default withWorkspace(productCatalogueHandler);