const amount = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const SLOT_REQUIREMENT_KEYS = Object.freeze({
  kitchen_sink: 'sink', kitchen_mixer: 'sink-mixer', oven: 'oven', cooktop: 'cooktop', dishwasher: 'dishwasher',
  toilet_suite: 'toilet-suite', basin: 'bathroom-basin', basin_mixer: 'basin-mixer', bath: 'bath',
  shower_mixer: 'bath-mixer', shower_screen: 'shower-screen', mirror: 'mirror', floor_tile: 'floor-tiles', wall_tile: 'wall-tiles',
});

export function standardInclusionRequirementKey(slot) { return SLOT_REQUIREMENT_KEYS[slot] || slot; }

export function standardInclusionSelectionSlot(requirementKey) {
  return Object.entries(SLOT_REQUIREMENT_KEYS).find(([, key]) => key === requirementKey)?.[0] || requirementKey;
}

export function standardInclusionClientSelectionPatches(snapshot, { resolveRequirement = () => null, quotation = {} } = {}) {
  const baseline = snapshot?.jobInclusionSnapshot || snapshot;
  if (baseline?.schedule?.source !== 'standard-inclusions' || !Array.isArray(baseline.items)) return [];
  const rows = Object.values(quotation).flatMap(section => section?.rows || []);
  const patches = [];
  for (const item of baseline.items) {
    const slot = item.selection_slot_id || item.selectionSlotId;
    const requirement = resolveRequirement(standardInclusionRequirementKey(slot));
    const product = item.metadata?.productSnapshot;
    if (!requirement || !slot || !item.default_product_id || !product) continue;
    const allowance = amount(item.baselineUnitPrice);
    const quoteRow = rows.find(row => row.selectionSlotId === slot && (!item.location_id || row.locationId === item.location_id));
    const quantity = amount(quoteRow?.qty ?? quoteRow?.quantity) ?? amount(item.metadata?.quantity) ?? requirement.defaultQuantity ?? 1;
    const productId = item.baselineProductId || item.default_product_id;
    const productName = item.baselineProductName || product.name || product.productName || productId;
    const details = {
      source: 'standard_inclusions_baseline',
      selectionSlotId: slot,
      requirementKey: requirement.requirementKey,
      requirementLabel: requirement.label,
      familyKey: requirement.familyKey,
      productId,
      baselineProductId: productId,
      productName,
      selectedProduct: productName,
      brand: product.brand || '',
      supplier: product.supplier || '',
      model: product.model || product.sku || '',
      description: item.metadata.description || product.description || '',
      specification: item.metadata.specification || product.specification || '',
      image: product.image || '',
      finish: product.finish || '',
      colour: product.colour || '',
      availableOptions: product.availableOptions || product.attributes?.selectionFacets || product.selectionFacets || {},
      allowance,
      originalAllowance: allowance,
      selectedPrice: allowance,
      selectedPriceIncludesGst: item.baselinePriceIncludesGst === false ? false : item.baselinePriceIncludesGst === true ? true : null,
      quantity,
      unit: item.metadata.unit || product.unit || requirement.defaultUnit || 'EACH',
      variation: 0,
      variationAmount: 0,
      variationPending: allowance === null,
      priceStatus: allowance === null ? 'Price required' : 'Included allowance',
      priceState: allowance === null ? 'Quote Required' : 'Current Price',
      configurationComplete: true,
      standardInclusionBaseline: {
        scheduleId: baseline.schedule.id,
        scheduleVersionId: baseline.schedule.scheduleVersionId,
        scheduleName: baseline.schedule.display_name || baseline.schedule.name,
        productId,
        productName,
        allowance,
        productSnapshot: product,
      },
    };
    patches.push({
      requirement,
      includedProductId: productId,
      patch: {
        selectedOptionId: productId,
        selectedProduct: productName,
        productModel: details.model,
        brand: details.brand,
        supplier: details.supplier,
        description: details.description,
        finishColour: details.finish || details.colour,
        imageUrl: details.image,
        allowanceAmount: allowance,
        selectedCost: allowance,
        upgradeCost: 0,
        included: true,
        status: 'selected',
        guidedSelection: details,
      },
    });
  }
  return patches;
}

export function mergeStandardInclusionClientSelectionBook(book = {}, patches = [], applyPatch = (current, requirement, patch) => current) {
  let next = book;
  const inserted = [];
  for (const entry of patches) {
    const rows = (next.rooms || []).flatMap(room => room.rows || []);
    const existing = rows.find(row => row.guidedRequirementKey === entry.requirement.requirementKey
      || row.guidedSelection?.requirementKey === entry.requirement.requirementKey);
    const selectedProductId = existing?.guidedSelection?.productId || existing?.guidedSelection?.selectedProductId || existing?.selectedOptionId || '';
    if (selectedProductId) continue;
    next = applyPatch(next, entry.requirement, entry.patch);
    inserted.push(entry.requirement.requirementKey);
  }
  return { book: next, inserted };
}