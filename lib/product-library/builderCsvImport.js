import Papa from 'papaparse';
import { isInternalPaintColourCategory } from './paintCategoryCompatibility.js';
import { SELECTION_SLOT_IDS } from '../builders/selectionRegistry.js';
import { classifyProductRequirements, requirementKeysForSelectionSlot } from '../builders/selectionRequirementTaxonomy.js';
import { requireWorkspaceId, assertWorkspaceRecord } from '../builders/tenantScope.js';

export const IMPORT_FIELDS = ['supplier', 'brand', 'range', 'model', 'supplierSku', 'supplierProductRef', 'importKey', 'name', 'description', 'category', 'subcategory', 'productType', 'requirementType', 'requirementKeys', 'price', 'cost', 'gstIncluded', 'priceStatus', 'availability', 'unit', 'colour', 'finish', 'selectionCategory', 'selectionSlot', 'imageUrl', 'active'];
const norm = value => String(value ?? '').trim().toLowerCase();
const booleanValue = value => {
  const normalized = norm(value).replace(/[ _-]+/g, '');
  if (['true', 'yes', '1', 'included', 'inclusive', 'inc', 'incgst'].includes(normalized)) return true;
  if (['false', 'no', '0', 'excluded', 'exclusive', 'ex', 'exgst'].includes(normalized)) return false;
  return null;
};
const headerKey = value => norm(value).replace(/[^a-z0-9]/g, '');
const sameJsonValue = (left, right) => {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object' || Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left)) return left.length === right.length && left.every((value, index) => sameJsonValue(value, right[index]));
  const leftKeys = Object.keys(left);
  return leftKeys.length === Object.keys(right).length && leftKeys.every(key => Object.hasOwn(right, key) && sameJsonValue(left[key], right[key]));
};
const headers = {
  supplier: ['supplier', 'vendor'], brand: ['brand', 'manufacturer'], range: ['range', 'productrange'], model: ['model', 'modelnumber'], supplierSku: ['suppliersku', 'sku', 'itemcode', 'productcode'],
  importKey: ['importkey', 'externalid', 'stableid'], name: ['productname', 'name', 'product'],
  description: ['description', 'productdescription'], category: ['category'], subcategory: ['subcategory'],
  price: ['price', 'sellprice', 'clientprice'], cost: ['cost', 'tradeprice', 'suppliercost', 'buildercost'],
  unit: ['unit', 'uom'], colour: ['colour', 'color'], finish: ['finish'], productType: ['producttype', 'type'], requirementType: ['requirementtype', 'requirement'], requirementKeys: ['requirementkeys', 'requirements'], selectionCategory: ['selectioncategory'], selectionSlot: ['selectionslot'],
  supplierProductRef: ['supplierproductref', 'supplierproductreference', 'supplieritemreference'],
  gstIncluded: ['gstincluded', 'gstbasis', 'pricegstbasis'], priceStatus: ['pricestatus', 'priceverificationstatus'],
  availability: ['availability', 'availabilitystatus', 'stockstatus'],
  imageUrl: ['imageurl', 'image'], active: ['active', 'enabled'],
};
export function parseBuilderCsv(csv) {
  if (typeof csv !== 'string' || csv.length > 2000000) throw Error('CSV must be text smaller than 2 MB.');
  const result = Papa.parse(csv.replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy' });
  if (result.errors.length) throw Error(`CSV parse error: ${result.errors[0].message}`);
  const [columns, ...data] = result.data;
  if (!columns?.length || !data.length || data.length > 2000) throw Error('Supply a header and 1–2,000 product rows.');
  if (new Set(columns.map(headerKey)).size !== columns.length) throw Error('CSV headers must be unique.');
  return { columns, data, mapping: Object.fromEntries(columns.map((column, index) => [index, Object.keys(headers).find(field => headers[field].includes(headerKey(column))) || ''])) };
}
export function productImportKey(product, suppliers = []) {
  const supplier = suppliers.find(item => item.id === product.supplier_id)?.supplier_name || product.metadata?.productEntity?.supplier;
  if (supplier && product.sku) return JSON.stringify(['sku', norm(supplier), norm(product.sku)]);
  return product.metadata?.builderCsvKey || null;
}
export function previewBuilderCsv({ workspaceId, csv, mapping, slotMappings = {}, requirementMappings = {}, products = [], suppliers = [], aliases = [] }) {
  requireWorkspaceId(workspaceId);
  [products, suppliers, aliases].forEach(records => records.forEach(record => assertWorkspaceRecord(workspaceId, record)));
  const parsed = parseBuilderCsv(csv);
  mapping = mapping || parsed.mapping;
  const fields = Object.values(mapping).filter(Boolean);
  if (fields.some(field => !IMPORT_FIELDS.includes(field)) || new Set(fields).size !== fields.length || Object.keys(mapping).some(index => !/^\d+$/.test(index) || +index >= parsed.columns.length)) throw Error('Each supported field may be mapped once.');
  const rows = parsed.data.map((cells, index) => {
    const value = Object.fromEntries(Object.entries(mapping).filter(([, field]) => field).map(([column, field]) => [field, String(cells[column] ?? '').trim()]));
    const errors = [];
    if ([value.category, value.subcategory, value.selectionCategory].some(isInternalPaintColourCategory)) errors.push('Internal paint colours are client job specifications, not Product Library products.');
    if (cells.length !== parsed.columns.length) errors.push('Column count does not match headers.');
    if (!value.name && !value.description) errors.push('Product name or description is required.');
    const key = value.supplier && value.supplierSku ? JSON.stringify(['sku', norm(value.supplier), norm(value.supplierSku)]) : value.importKey ? JSON.stringify(['external', value.importKey]) : null;
    if (!key) errors.push('Supplier + SKU or a stable Import Key is required; descriptions are never matching keys.');
    for (const field of ['price', 'cost']) {
      if (value[field]) {
        const money = value[field].replace(/^\$\s*/, '');
        if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(money) || Number(money.replaceAll(',', '')) >= 1e12) errors.push(`Invalid ${field}. Use a non-negative amount with at most two decimals.`);
        else value[field] = Number(money.replaceAll(',', ''));
      }
    }
    if (value.active && !['true', 'false', 'yes', 'no', '1', '0', 'active', 'inactive'].includes(norm(value.active))) errors.push('Invalid Active value.');
    if (value.gstIncluded && booleanValue(value.gstIncluded) === null) errors.push('Invalid GST basis. Use included/inclusive or excluded/exclusive.');
    if (value.priceStatus && !['current', 'verified', 'price_pending', 'quote_required', 'expired', 'estimate_only'].includes(norm(value.priceStatus).replace(/[ -]+/g, '_'))) errors.push('Invalid price status.');
    if (value.availability && !['available', 'in_stock', 'limited', 'backorder', 'quote_required', 'unavailable', 'discontinued'].includes(norm(value.availability).replace(/[ -]+/g, '_'))) errors.push('Invalid availability status.');
    if (value.imageUrl) { try { if (!['https:', 'http:'].includes(new URL(value.imageUrl).protocol)) throw Error(); } catch { errors.push('Image URL must be HTTP or HTTPS.'); } }
    const slotSource = value.selectionSlot || value.selectionCategory || value.subcategory || value.category || '';
    const savedSlots = [...new Set(aliases.filter(alias => norm(alias.alias) === norm(slotSource)).map(alias => alias.selection_slot_id))];
    const requested = Object.hasOwn(slotMappings, slotSource) ? slotMappings[slotSource] : undefined;
    const explicitSlot = requested !== undefined ? requested : SELECTION_SLOT_IDS.includes(value.selectionSlot) ? value.selectionSlot : savedSlots.length === 1 ? savedSlots[0] : '';
    const declaredRequirements = String(value.requirementKeys || '').split(/[;,|]/).map(key => key.trim()).filter(Boolean);
    const requestedRequirement = requirementMappings[slotSource] || '';
    const baseClassification = classifyProductRequirements({
      productName: value.name || value.description,
      category: value.category,
      subcategory: value.subcategory,
      productType: value.productType,
      requirementType: value.requirementType,
      requirementKeys: declaredRequirements,
    });
    const slotRequirements = requirementKeysForSelectionSlot(explicitSlot);
    const slotConflict = Boolean(explicitSlot && baseClassification.requirementKeys.length
      && baseClassification.status === 'CLASSIFIED'
      && !slotRequirements.some(key => baseClassification.requirementKeys.includes(key)));
    const chosenRequirement = requestedRequirement || '';
    const requirementConflict = Boolean(chosenRequirement && baseClassification.status === 'CLASSIFIED'
      && !baseClassification.requirementKeys.includes(chosenRequirement));
    const classification = chosenRequirement
      ? classifyProductRequirements({ requirementKeys: [...declaredRequirements, chosenRequirement] })
      : baseClassification.status === 'UNCLASSIFIED' && explicitSlot
        ? classifyProductRequirements({ selectionSlotIds: [explicitSlot] })
        : baseClassification.status === 'REVIEW_REQUIRED' && explicitSlot && slotRequirements.some(key => baseClassification.requirementKeys.includes(key))
          ? classifyProductRequirements({ requirementKeys: slotRequirements.filter(key => baseClassification.requirementKeys.includes(key)) })
          : baseClassification;
    const inferredSlots = classification.selectionSlotIds;
    const slot = explicitSlot || (inferredSlots.length === 1 ? inferredSlots[0] : '');
    const matches = products.filter(product => key && productImportKey(product, suppliers) === key);
    const old = matches.length === 1 ? matches[0] : null;
    const entity = { ...(old?.metadata?.productEntity || {}) };
    for (const field of ['supplier', 'brand', 'range', 'model', 'category', 'subcategory', 'productType', 'colour', 'finish']) if (value[field]) entity[field] = value[field];
    if (value.supplierProductRef) entity.supplierProductRef = value.supplierProductRef;
    if (classification.requirementKeys.length) entity.requirementKeys = [...new Set([...(entity.requirementKeys || []), ...classification.requirementKeys])];
    if (typeof value.price === 'number') entity.clientPrice = value.price;
    if (typeof value.cost === 'number') entity.builderCost = value.cost;
    if (value.gstIncluded) entity.gstIncluded = booleanValue(value.gstIncluded);
    if (value.priceStatus) entity.priceStatus = norm(value.priceStatus).replace(/[ -]+/g, '_');
    if (value.availability) entity.availabilityStatus = norm(value.availability).replace(/[ -]+/g, '_');
    const patch = {
      product_name: value.name || value.description, sku: value.supplierSku || old?.sku || null,
      selection_slot_ids: [...new Set([...(old?.selection_slot_ids || []), ...inferredSlots, ...(SELECTION_SLOT_IDS.includes(slot) ? [slot] : [])])],
      metadata: { ...(old?.metadata || {}), productEntity: entity, builderCsvKey: key, requirementClassification: { status: classification.status, requirementKeys: classification.requirementKeys, source: requestedRequirement ? 'builder-requirement-review' : baseClassification.status === 'CLASSIFIED' ? 'shared-requirement-taxonomy' : explicitSlot ? 'builder-selection-slot' : 'shared-requirement-taxonomy' } },
    };
    for (const [field, target] of [['description', 'description'], ['unit', 'unit'], ['imageUrl', 'primary_image_url']]) if (value[field]) patch[target] = value[field];
    if (typeof value.price === 'number') patch.upgrade_cost = value.price;
    if (typeof value.cost === 'number') patch.base_allowance = value.cost;
    if (value.active) patch.active = ['true', 'yes', '1', 'active'].includes(norm(value.active));
    let action = errors.length ? 'INVALID' : matches.length > 1 ? 'CONFLICT' : slotConflict || requirementConflict || classification.status === 'REVIEW_REQUIRED' ? 'REVIEW_REQUIRED' : !classification.requirementKeys.length ? 'UNMAPPED' : old ? Object.entries(patch).every(([field, value]) => sameJsonValue(old[field], value)) ? 'UNCHANGED' : 'UPDATE' : 'NEW';
    if (matches.length > 1) errors.push('Multiple existing products match this stable key.');
    if (slotConflict) errors.push('The selected requirement type conflicts with the selected legacy Selection Slot. Review the product classification.');
    else if (requirementConflict) errors.push('The selected requirement type conflicts with the product metadata. Review the product classification.');
    else if (classification.status === 'REVIEW_REQUIRED') errors.push(`Product matches multiple requirements: ${classification.requirementKeys.join(', ')}. Choose the applicable requirement type.`);
    else if (!classification.requirementKeys.length) errors.push('No shared product requirement matched. Choose a requirement type or a legacy Selection Slot.');
    const quoteMappingStatus = classification.matches.every(match => match.estimateSection) ? 'REQUIREMENT_MAPPED' : 'TEMPLATE_MAPPING_REQUIRED';
    return { row: index + 2, key, name: patch.product_name, action, errors, slotSource, slot, requirementKeys: classification.requirementKeys, classificationStatus: classification.status, quoteMappingStatus, id: old?.id || null, before: old, patch, alias: requested && slotSource && !SELECTION_SLOT_IDS.includes(slotSource) ? { alias: slotSource, selection_slot_id: slot } : null };
  });
  const counts = new Map();
  rows.forEach(row => { if (row.key) counts.set(row.key, (counts.get(row.key) || 0) + 1); });
  rows.forEach(row => { if (counts.get(row.key) > 1 && row.action !== 'INVALID') { row.action = 'CONFLICT'; row.errors.push('Duplicate stable key in this CSV.'); } });
  return { rows, report: importReport(rows) };
}
export function importReport(rows) {
  return { rowsRead: rows.length, ...Object.fromEntries(['NEW', 'UPDATE', 'UNCHANGED', 'INVALID', 'CONFLICT', 'REVIEW_REQUIRED', 'UNMAPPED'].map(action => [action, rows.filter(row => row.action === action).length])) };
}
