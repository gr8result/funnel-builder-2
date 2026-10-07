import source from '../../data/product-library/catalogues/builder-cabinetry/final-cabinetry-quotation.json';

export const FINAL_CABINETRY = source;
export const isCabinetryDivider = row => ['heading','spacer'].includes(row.cabinetryRowType);
export function finalCabinetryRows(workspaceId) {
  if (workspaceId !== source.workspaceId) return [];
  return source.rows.map((entry, index) => {
    const key = entry.key || `final-cabinetry:${entry.sourceRow}`;
    const row = {id:key, section:'CABINETRY', item:entry.description, cabinetryRowType:entry.type,
      cabinetrySourceRow:entry.sourceRow, cabinetryApprovedAddition:entry.approvedAddition || false, sortOrder:index, active:true, included:true};
    if (entry.type !== 'product') return {...row, cabinetryHeadingLevel:entry.level, quantity:'', qty:'', unit:'', excelRate:'', cost:0};
    return {...row, cabinetryImportKey:key, importKey:key, productName:entry.description,
      room:entry.room, range:entry.range, finish:entry.range, unit:entry.unit,
      quantity:'', qty:'', manualQty:'', manualRate:'', cost:'', excelRate:entry.price,
      importedPrice:entry.price, sourceOfRate:source.sourceFile, priceBasis:'Approved cabinetry allowance'};
  });
}

export const cabinetryApplies = workspaceId => workspaceId === source.workspaceId;
// Removal scope only: these names never produce rows or act as fallback sources.
export function isCabinetrySection(name) {
  const text = String(name || '').replace(/^\d+[.\s-]+/, '').replace(/\s*\(\d+\)\s*$/, '').trim().toUpperCase();
  return /^(CABINETRY(?: - .*)?|BENCHTOPS(?: - .*)?|CABINET MAKER|MISC CABINETRY|BUTLERS PANTRY|LAUNDRY|BATHROOMS|WARDROBES|STANDARD WARDROBES COMPLETE \(2\.4M WIDE\)|STANDARD 3 DOOR ROBE UP TO 3\.6M WIDE)$/.test(text);
}
const families = new Set(['cabinetry','laminate-benchtops','stone-benchtops','stone-20mm-tops','stone-40mm-tops','robes','wardrobe-systems','robe-fitout']);
export const isCabinetryProduct = product => families.has(product.familyKey || product.family_key || product.metadata?.familyKey) || isCabinetrySection(product.attributes?.quotationSection || product.category);
export const finalCabinetryQuotation = workspaceId => cabinetryApplies(workspaceId) ? {CABINETRY:{collapsed:false,rows:finalCabinetryRows(workspaceId)}} : {};

export function replaceCabinetryTemplate(quotation, workspaceId) {
  if (!cabinetryApplies(workspaceId)) return quotation;
  const result = {}; let inserted = false;
  for (const [section,value] of Object.entries(quotation)) {
    if (!isCabinetrySection(section)) { result[section] = value; continue; }
    if (!inserted) { Object.assign(result,finalCabinetryQuotation(workspaceId)); inserted = true; }
  }
  if (!inserted) Object.assign(result,finalCabinetryQuotation(workspaceId));
  return result;
}

// Reconcile saved snapshots against the sole approved source. Obsolete rows are
// discarded, including populated legacy/custom copies. Only inputs attached to
// an exact approved product survive; no old-product matching or fallback exists.
export function reconcileCabinetryQuotation(workbook, workspaceId) {
  if (!cabinetryApplies(workspaceId) || (workbook.workspaceId && workbook.workspaceId !== workspaceId)) return workbook;
  if (workbook.cabinetryDatasetRevision === source.datasetRevision) return workbook;
  const existing = new Map((workbook.quotation?.CABINETRY?.rows || []).filter(r=>r.cabinetryRowType==='product' && !r.legacyCatalogueReference).map(r=>[r.cabinetryImportKey,r]));
  const rows = finalCabinetryRows(workspaceId).map(row => {
    const saved = existing.get(row.cabinetryImportKey);
    if (!saved || saved.item !== row.item) return row;
    const inputs = Object.fromEntries(Object.entries(saved).filter(([key]) => /^(quantity|qty|manualQty|manualQuantity|quantityFormula|quantityFormulaOverride|quantityManualOverride|quantityKey|selection.*|selected.*|guidedSelection|activeSelection|takeoff.*|notes|included)$/.test(key)));
    return {...row,...inputs};
  });
  const order = [...new Set([...(workbook.quotationSectionOrder || []),...Object.keys(workbook.quotation || {})])];
  const quotation = {}; let inserted = false;
  for (const section of order) {
    const group = workbook.quotation?.[section]; if (!group) continue;
    if (!isCabinetrySection(section)) { quotation[section] = group; continue; }
    if (!inserted) { quotation.CABINETRY = {collapsed:false,rows,sortOrder:group.sortOrder ?? order.indexOf(section)}; inserted = true; }
  }
  if (!inserted) quotation.CABINETRY = {collapsed:false,rows};
  const result = {...workbook,quotation,quotationSectionOrder:Object.keys(quotation),cabinetryDatasetRevision:source.datasetRevision};
  delete result.cabinetryQuoteMigration;
  delete result.cabinetryCatalogueAudit;
  if (workbook.productLibrary?.products) result.productLibrary = {...workbook.productLibrary,products:workbook.productLibrary.products.filter(p=>!isCabinetryProduct(p))};
  return result;
}

export function addCabinetryCatalogueItem(workbook, key, workspaceId) {
  if (!cabinetryApplies(workspaceId) || (workbook.workspaceId && workbook.workspaceId !== workspaceId)) return workbook;
  const row = finalCabinetryRows(workspaceId).find(r=>r.importKey===key);
  if (!row) throw Error('Unknown approved cabinetry item.');
  const group = workbook.quotation?.CABINETRY || {collapsed:false,rows:[]};
  if (group.rows.some(r=>r.importKey===key)) return workbook;
  const rows = [...group.rows];
  const next = rows.findIndex(r=>r.sortOrder > row.sortOrder);
  rows.splice(next < 0 ? rows.length : next,0,row);
  return {...workbook,quotation:{...workbook.quotation,CABINETRY:{...group,rows}},quotationSectionOrder:[...new Set([...(workbook.quotationSectionOrder || Object.keys(workbook.quotation || {})),'CABINETRY'])]};
}

const roomKey = room => room.startsWith('KITCHEN') ? 'kitchen' : room.startsWith("BUTLER'S") ? 'butlers-pantry' : room.startsWith('LAUNDRY') ? 'laundry' : room==='WARDROBES' ? 'bedrooms' : 'bathroom';
export const finalCabinetryProducts = source.rows.filter(r=>r.type==='product').map(row => {
  const key = row.key || `final-cabinetry:${row.sourceRow}`;
  return {productId:key,productCode:key,organisationId:source.workspaceId,
    familyKey:/BENCHTOPS/.test(row.room) ? (/LAMINATE/.test(row.range) ? 'laminate-benchtops' : 'stone-benchtops') : row.room==='WARDROBES' ? 'robes' : 'cabinetry',
    categoryKey:'cabinetry-joinery',topLevelArea:roomKey(row.room),productName:row.description,description:row.description,
    range:row.range,finish:row.range,priceUnit:row.unit,clientPrice:row.price,rrp:row.price,priceStatus:'indicative',priceBasis:'Approved cabinetry allowance',active:true,
    sourceType:'builder_private_import',sourceName:source.sourceFile,
    attributes:{quotationSection:'CABINETRY',approvedCabinetryRevision:source.datasetRevision,importKey:key,room:row.room,applicableRooms:[roomKey(row.room)],finishRange:row.range,unit:row.unit,clientSelectable:true,quotationEnabled:true}};
});
// Other tenants keep their shared catalogue. This builder receives no archived or
// hidden obsolete alternatives, even when asking for disabled products.
export function scopeCabinetryProducts(products, workspaceId) {
  if (!cabinetryApplies(workspaceId)) return products;
  const seen = new Set();
  return products.filter(product => {
    if (!isCabinetryProduct(product)) return true;
    if (product.attributes?.approvedCabinetryRevision !== source.datasetRevision) return false;
    const key = product.productCode;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
