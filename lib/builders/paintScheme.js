export const PAINT_SURFACES = [
  ['walls', 'Walls', 'interior', true, /internal.*wall|wall.*paint/i],
  ['ceilings', 'Ceilings', 'interior', true, /ceiling/i],
  ['skirting', 'Skirting', 'interior', true, /skirting|trim/i],
  ['doors', 'Internal doors', 'interior', true, /internal.*door|door.*paint/i],
  ['cornices', 'Cornices', 'interior', false, /cornice/i],
  ['architraves', 'Architraves', 'interior', false, /architrave/i],
  ['frames', 'Door frames / jambs', 'interior', false, /jamb|door frame/i],
  ['reveals', 'Window reveals / trim', 'interior', false, /window.*trim|reveal/i],
  ['external-walls', 'External walls', 'exterior', false, /external.*wall/i],
  ['render', 'Render', 'exterior', false, /render/i],
  ['cladding', 'Cladding', 'exterior', false, /cladding/i],
  ['eaves', 'Eaves / soffits', 'exterior', false, /eave|soffit/i],
  ['fascia', 'Fascia', 'exterior', false, /fascia/i],
  ['exterior-doors', 'Exterior doors', 'exterior', false, /external.*door|entry.*door/i],
  ['exterior-trim', 'Exterior trim', 'exterior', false, /external.*trim/i],
].map(([key, label, area, required, quotePattern]) => ({ key, label, area, required, quotePattern }));

export function paintQuotationRequirements(workbook = {}) {
  return Object.entries(workbook.quotation || {}).flatMap(([section, group]) => {
    if (!/paint/i.test(section)) return [];
    return (group.rows || []).flatMap(row => {
      if (row.source === 'client-paint-feature') return [];
      const text = [row.item, row.description].filter(Boolean).join(' ');
      const surface = [...PAINT_SURFACES].reverse().find(s => s.quotePattern.test(text));
      if (!surface) return [];
      const raw = row.qty ?? row.quantity;
      const quantity = raw === '' || raw == null ? null : Number(raw);
      return [{ section, rowId: row.id, surface: surface.key, location: row.location || row.level || 'House',
        quantity: Number.isFinite(quantity) ? quantity : null, unit: row.unit || '', source: 'Quotation / Job Setup',
        materialAllowance: row.paintSelectionOriginal?.materialRate ?? row.materialRate ?? row.materialAllowancePerUnit ?? null }];
    });
  });
}

export function newPaintScheme(inclusion = {}) {
  return { schemaVersion: 1, defaults: structuredClone(inclusion.defaults || {}), overrides: [], featureWalls: [], confirmed: false };
}

export function paintSchemeFromInclusions(inclusions = {}, products = [], colours = []) {
  const selectedPackage = inclusions.packages?.find(p => p.id === inclusions.selectedPackageId);
  const explicit = selectedPackage?.paintScheme || inclusions.paintScheme;
  const scheme = newPaintScheme(explicit || {});
  const sections = (inclusions.sections || []).filter(s => s.active !== false && (!s.package_id || s.package_id === inclusions.selectedPackageId) && /paint/i.test(s.title));
  scheme.inclusionBaseline = { packageId: inclusions.selectedPackageId || '', sections: structuredClone(sections), paintScheme: explicit ? structuredClone(explicit) : null };
  const normalize = value => String(value || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
  for (const section of sections) for (const bullet of section.bullets || []) {
    if (typeof bullet !== 'string') continue;
    const text = normalize(bullet);
    const product = products.filter(p => p.attributes?.availableFinishes?.length && text.includes(normalize(p.productName))).sort((a,b) => b.productName.length - a.productName.length)[0];
    const colour = colours.filter(c => text.includes(normalize(c.name))).sort((a,b) => b.name.length - a.name.length)[0];
    if (!product) continue;
    for (const surface of PAINT_SURFACES.filter(s => s.quotePattern.test(bullet))) {
      if (!scheme.defaults[surface.key]) scheme.defaults[surface.key] = { productCode: product.productCode, colourId: colour?.id || '', finish: product.attributes.availableFinishes[0] };
    }
  }
  return scheme;
}

export function paintChoiceErrors(choice, products, colours) {
  const product = products.find(p => p.productCode === choice?.productCode);
  const colour = colours.find(c => c.id === choice?.colourId);
  const errors = [];
  if (!product) errors.push('Choose a paint product');
  if (!colour) errors.push('Choose a colour');
  if (product && !product.attributes?.availableFinishes?.includes(choice?.finish)) errors.push('Choose a published finish for this product');
  if (product && colour && product.manufacturer !== colour.manufacturer) errors.push('Choose a colour from the selected manufacturer');
  return errors;
}

export function paintSchemeComplete(scheme, products, colours) {
  return PAINT_SURFACES.filter(s => s.required).every(s => !paintChoiceErrors(scheme.defaults?.[s.key], products, colours).length);
}

export function resolvePaintChoice(scheme, surface, location) {
  return scheme.overrides?.find(o => o.surface === surface && o.location === location)?.choice || scheme.defaults?.[surface] || null;
}

export function paintLitres(area, coverage, coats, wastePercent) {
  if ([area, coverage, coats, wastePercent].some(v => v === '' || v == null || !Number.isFinite(Number(v)))) return null;
  if (area < 0 || coverage <= 0 || coats <= 0 || wastePercent < 0) return null;
  return Math.ceil((Number(area) / Number(coverage)) * Number(coats) * (1 + Number(wastePercent) / 100) * 100) / 100;
}

export function paintMaterialOrder(choice, area, unit = 'M2') {
  if (!/^(m2|m²)$/i.test(unit || '')) return null;
  const litres = paintLitres(area, choice.coverage, choice.coats, choice.wastePercent);
  const variant = choice.productSnapshot?.attributes?.variants?.find(v => v.sku === choice.packageSku && !v.isNotSelling);
  if (litres == null || !variant) return null;
  const size = String(variant.size || '').match(/^(\d+(?:\.\d+)?)\s*(ML|L)$/i);
  const sizeLitres = size ? Number(size[1]) / (size[2].toUpperCase() === 'ML' ? 1000 : 1) : 0;
  const price = variant.price?.value;
  if (!sizeLitres || !(price > 0)) return null;
  const packages = Math.ceil(litres / sizeLitres);
  return { litres, packages, sizeLitres, sku: variant.sku, packagePrice: price, materialCostExGst: Math.round(packages * price / 1.1 * 100) / 100 };
}

export function snapshotPaintScheme(scheme, products, colours) {
  const snapshot = choice => {
    if (!choice) return null;
    const product = products.find(p => p.productCode === choice.productCode);
    const colour = colours.find(c => c.id === choice.colourId);
    return { ...choice, manufacturer: product?.manufacturer || '', productName: product?.productName || '',
      colourName: colour?.name || '', colourCode: colour?.code || '', hex: colour?.hex || '',
      supplier: product?.supplier || '', sourceUrl: product?.officialProductUrl || '',
      colourSourceUrl: colour?.sourceUrl || '', productSnapshot: product, colourSnapshot: colour };
  };
  return { ...scheme, defaults: Object.fromEntries(Object.entries(scheme.defaults || {}).map(([key,value]) => [key, snapshot(value)])),
    overrides: (scheme.overrides || []).map(o => ({ ...o, choice: snapshot(o.choice) })),
    featureWalls: (scheme.featureWalls || []).map(o => ({ ...o, choice: snapshot(o.choice) })), updatedAt: new Date().toISOString() };
}

export function connectPaintSchemeToQuotation(workbook = {}, book = {}) {
  const scheme = (book.rooms || []).flatMap(r => r.rows || []).find(r => r.guidedSelection?.paintScheme)?.guidedSelection.paintScheme;
  if (!scheme) return workbook;
  const requirements = paintQuotationRequirements(workbook);
  const quotation = { ...(workbook.quotation || {}) };
  const schedule = requirements.map(req => {
    const choice = resolvePaintChoice(scheme, req.surface, req.location);
    const overrides = (scheme.overrides || []).filter(o => o.surface === req.surface);
    // A whole-house row cannot be priced until areas of its room overrides are allocated.
    const features = req.surface === 'walls' ? (scheme.featureWalls || []).filter(f => req.location === 'House' || req.location === f.location) : [];
    const unresolvedFeatures = features.some(f => f.areaM2 == null) || (features.length && requirements.filter(r => r.surface === 'walls' && r.location === 'House').length > 1);
    const unresolvedOverrides = req.location === 'House' && overrides.length > 0;
    const materialArea = req.quantity == null ? null : Math.max(0, req.quantity - features.reduce((n,f) => n + Number(f.areaM2 || 0), 0));
    return { ...req, choice, overrides, materialArea, order: choice && !unresolvedOverrides && !unresolvedFeatures ? paintMaterialOrder(choice, materialArea, req.unit) : null };
  });
  for (const [section, group] of Object.entries(quotation)) {
    if (!/paint/i.test(section)) continue;
    quotation[section] = { ...group, rows: (group.rows || []).filter(row => row.source !== 'client-paint-feature').map(row => {
      const spec = schedule.find(s => s.section === section && s.rowId === row.id);
      if (!spec?.choice) return row;
      // Supply-and-install rates cannot be split by guessing a labour allowance.
      const original = row.paintSelectionOriginal || { excelRate: row.excelRate, manualRate: row.manualRate,
        materialRate: row.materialRate ?? row.materialAllowancePerUnit ?? null, labourRate: row.labourRate, qty: row.qty,
        description: row.description, finalRateUsed: row.finalRateUsed, cost: row.cost };
      const allowance = original.materialRate ?? (spec.choice.materialAllowancePerM2 === '' ? null : spec.choice.materialAllowancePerM2) ?? null;
      const combinedRaw = original.manualRate !== '' && original.manualRate != null ? original.manualRate : original.excelRate;
      const combined = combinedRaw === '' || combinedRaw == null ? NaN : Number(combinedRaw);
      const priced = spec.order && allowance != null && spec.quantity > 0 && Number.isFinite(combined);
      return { ...row, paintSelectionOriginal: original,
        paintSpecification: spec, productName: spec.choice.productName, manufacturer: spec.choice.manufacturer,
        colour: spec.choice.colourName, colourCode: spec.choice.colourCode, finish: spec.choice.finish,
        description: [original.description, `${spec.choice.productName} / ${spec.choice.colourName} (${spec.choice.colourCode}) / ${spec.choice.finish}`,
          ...spec.overrides.map(o => `${o.location}: ${o.choice.productName} / ${o.choice.colourName} / ${o.choice.finish}`)].filter(Boolean).join('; '),
        selectedMaterialValue: spec.order?.materialCostExGst ?? null,
        materialVariation: priced ? spec.order.materialCostExGst - Number(allowance) * spec.quantity : null,
        manualRate: priced ? Math.round((combined - Number(allowance) + spec.order.materialCostExGst / spec.quantity) * 10000) / 10000 : original.manualRate,
        finalRateUsed: priced ? Math.round((combined - Number(allowance) + spec.order.materialCostExGst / spec.quantity) * 10000) / 10000 : original.finalRateUsed,
        cost: priced ? '' : original.cost,
        paintVariationStatus: priced ? 'Priced' : 'Material quantity and supplier pricing required' };
    }) };
  }
  const featureSection = requirements.find(r => r.surface === 'walls')?.section || Object.keys(quotation).find(s => /paint/i.test(s));
  const featureSchedule = (scheme.featureWalls || []).map(f => ({ section: featureSection || '', rowId: `paint-feature:${f.id}`, surface: 'feature-wall', location: f.location,
    wall: f.wall, quantity: f.areaM2, unit: 'M2', choice: f.choice, order: paintMaterialOrder(f.choice, f.areaM2, 'M2') }));
  if (featureSection) for (const feature of featureSchedule) quotation[featureSection].rows.push({ id: feature.rowId, source: 'client-paint-feature',
    item: `Feature wall — ${feature.location} — ${feature.wall}`, description: `${feature.choice.productName} / ${feature.choice.colourName} (${feature.choice.colourCode}) / ${feature.choice.finish}`,
    qty: feature.quantity ?? '', unit: 'M2', manualRate: feature.order && feature.quantity > 0 ? feature.order.materialCostExGst / feature.quantity : '',
    excelRate: '', cost: '', labourRate: 0, quoteRequired: !feature.order, included: true, active: true, paintSpecification: feature });
  const items = (workbook.procurement?.items || []).filter(p => p.source !== 'client-paint-scheme');
  for (const s of [...schedule, ...featureSchedule].filter(s => s.choice)) items.push({ ...(workbook.procurement?.items || []).find(p => p.id === `paint:${s.section}:${s.rowId}`), id: `paint:${s.section}:${s.rowId}`, source: 'client-paint-scheme',
    linkedQuotationRowId: s.rowId, sectionName: s.section, itemDescription: `${s.choice.productName} / ${s.choice.colourName} / ${s.choice.finish}`,
    productCode: s.choice.productCode, supplier: s.choice.supplier, manufacturer: s.choice.manufacturer,
    colour: s.choice.colourName, colourCode: s.choice.colourCode, finish: s.choice.finish, surface: s.surface,
    location: s.location, paintableQuantity: s.quantity, paintableUnit: s.unit, qty: s.order?.packages ?? null, unit: s.order ? `${s.order.sizeLitres}L pack` : 'litre',
    estimatedRate: s.order ? s.order.packagePrice / 1.1 : null, estimatedTotal: s.order?.materialCostExGst ?? null,
    status: s.order ? 'Not Started' : 'quantity-and-quote-required', paintSpecification: s });
  return { ...workbook, quotation, paintScheme: scheme, paintSchedule: [...schedule, ...featureSchedule],
    procurement: { ...(workbook.procurement || {}), items, paintFeatureWalls: scheme.featureWalls || [] } };
}
