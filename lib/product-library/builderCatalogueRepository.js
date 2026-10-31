import { requireWorkspaceId } from '../builders/tenantScope.js';

export function createBuilderCatalogueRepository(db, workspaceId) {
  const owner = requireWorkspaceId(workspaceId);
  async function list(table) {
    const pageSize = 1000;
    const first = await db.from(table).select('*', { count: 'exact' }).eq('workspace_id', owner).order('id').range(0, pageSize - 1);
    if (first.error) throw first.error;
    const remainingOffsets = Array.from(
      { length: Math.max(0, Math.ceil(Number(first.count || 0) / pageSize) - 1) },
      (_, index) => (index + 1) * pageSize,
    );
    const remaining = await Promise.all(remainingOffsets.map((offset) =>
      db.from(table).select('*').eq('workspace_id', owner).order('id').range(offset, offset + pageSize - 1),
    ));
    const responses = [first, ...remaining];
    const rows = responses.flatMap(({ data, error }) => {
      if (error) throw error;
      return data || [];
    });
    if (rows.some(row => row.workspace_id !== owner)) throw new Error('Foreign workspace catalogue record.');
    return rows;
  }
  async function load() {
    const [products, overrides, suppliers, manufacturers] = await Promise.all([
      'builder_products', 'builder_product_configurations', 'builder_product_suppliers', 'builder_product_manufacturers',
    ].map(list));
    const supplierNames = new Map(suppliers.map((supplier) => [supplier.id, supplier.supplier_name]));
    const manufacturerNames = new Map(manufacturers.map((manufacturer) => [manufacturer.id, manufacturer.manufacturer_name]));
    return { products: products.map(row => ({ ...row, metadata: { ...row.metadata, productEntity: {
      ...row.metadata?.productEntity,
      supplier: supplierNames.get(row.supplier_id) || row.metadata?.productEntity?.supplier || '',
      brand: manufacturerNames.get(row.manufacturer_id) || row.metadata?.productEntity?.brand || '',
    } } })), overrides };
  }
  async function save(action, record) {
    if (record.organisationId !== owner) throw new Error('Cannot save another workspace catalogue.');
    let query;
    if (action === 'override') {
      if (!record.masterProductCode) throw new Error('Product identity required.');
      const { data: existing, error: lookupError } = await db.from('builder_product_configurations').select('*').eq('workspace_id', owner).eq('catalogue_product_id', record.masterProductCode).maybeSingle();
      if (lookupError) throw lookupError;
      if (existing?.metadata?.productLibraryOverride?.updatedAt > record.updatedAt) throw new Error('Override changed on another device; reload before saving.');
      query = db.from('builder_product_configurations').upsert({
        workspace_id: owner, catalogue_product_id: record.masterProductCode,
        metadata: { ...existing?.metadata, productLibraryOverride: record }, updated_at: new Date().toISOString(),
      }, { onConflict: 'workspace_id,catalogue_product_id' });
    } else if (action === 'product') {
      if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(record.productId || '') || !record.productName) throw new Error('Product UUID and name required.');
      const { data: existing, error: lookupError } = await db.from('builder_products').select('*').eq('workspace_id', owner).eq('id', record.productId).maybeSingle();
      if (lookupError) throw lookupError;
      const payload = {
        id: record.productId, workspace_id: owner, product_name: record.productName,
        sku: record.supplierSku || record.sku || record.productCode, model: record.model, description: record.description,
        primary_image_url: record.primaryImageUrl, product_url: record.officialProductUrl,
        unit: record.priceUnit || record.unit || existing?.unit || '',
        ...(record.clientPrice != null ? { upgrade_cost: record.clientPrice } : {}),
        ...(record.builderCost != null ? { base_allowance: record.builderCost } : {}),
        active: record.active !== false && record.archived !== true,
        metadata: { ...existing?.metadata, productEntity: { ...existing?.metadata?.productEntity, ...record } },
        updated_at: new Date().toISOString(),
      };
      query = existing ? db.from('builder_products').update(payload).eq('workspace_id', owner).eq('id', record.productId) : db.from('builder_products').insert(payload);
    } else throw new Error('Unknown catalogue write.');
    const { data, error } = await query.select('*').single();
    if (error) throw error;
    return data;
  }
  return { load, save };
}