export const fieldClass = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
export const buttonClass = 'rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50';
export const primaryButtonClass = 'rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50';

const kitchenOptions = [
  ['baseCabinets', 'Base cabinets'], ['drawerUnits', 'Drawer units'], ['overheads', 'Overhead cabinets'],
  ['tallCabinets', 'Tall cabinets'], ['pantryCabinets', 'Pantry cabinets'], ['islandCabinetry', 'Island cabinetry'],
  ['applianceCabinetry', 'Appliance cabinetry'], ['fridgePanels', 'Fridge panels'], ['dishwasherPanels', 'Dishwasher panels'],
  ['microwaveCabinetry', 'Microwave cabinetry'], ['rangehoodCabinetry', 'Rangehood cabinetry'], ['openShelves', 'Open shelves'],
  ['endPanels', 'End panels'], ['bulkheads', 'Bulkheads'], ['rawMdfBulkheads', 'Raw MDF bulkheads'],
];
const laundryOptions = [
  ['baseCabinets', 'Base cabinets'], ['drawerUnits', 'Drawer units'], ['overheads', 'Overhead cabinets'],
  ['tallLinenCupboard', 'Tall linen cupboard'], ['openShelves', 'Open shelves'], ['hangingRail', 'Hanging rail'],
  ['benchtop', 'Benchtop'], ['endPanels', 'End panels'], ['bulkheads', 'Bulkheads'],
];
const vanityGroups = [
  { title: 'Floor-mounted vanity', options: [['floorTwoDoorVanity', 'Floor-mounted 2-door vanity'], ['floorOneDoorVanity', 'Floor-mounted 1-door vanity'], ['floorFourDrawerVanity', 'Floor-mounted 4-drawer vanity']] },
  { title: 'Wall-mounted vanity', options: [['wallTwoDoorVanity', 'Wall-mounted 2-door vanity'], ['wallOneDoorVanity', 'Wall-mounted 1-door vanity'], ['wallThreeDrawerVanity', 'Wall-mounted 3-drawer vanity'], ['wallTwoDrawerVanity', 'Wall-mounted 2-drawer vanity']] },
  { title: 'Storage and finishes', options: [['towelDisplay', 'Towel display'], ['tallLinenCupboard', 'Tall linen cupboard'], ['twoDoorShavingCabinet', '2-door shaving cabinet'], ['oneDoorShavingCabinet', '1-door shaving cabinet'], ['laminateBenchtop', 'Laminated benchtop'], ['laminateMitredBenchtop', 'Laminated benchtop with mitred drop'], ['stoneBenchtop', 'Stone benchtop'], ['stoneMitredBenchtop', 'Stone benchtop with mitred drop'], ['linenBulkhead', 'Bulkhead over tall cupboard']] },
];

export function roomKind(room = '') {
  const name = String(room).toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (/bathroom|ensuite|powder/.test(name)) return 'bathroom';
  if (/laundry/.test(name)) return 'laundry';
  if (/kitchen|pantry/.test(name)) return 'kitchen';
  return 'other';
}

export function cabinetConfigurationGroups(room) {
  const kind = roomKind(room);
  if (kind === 'bathroom') return vanityGroups;
  if (kind === 'laundry') return [{ title: 'Laundry cabinetry', options: laundryOptions }];
  if (kind === 'kitchen') return [{ title: 'Cabinetry and panels', options: kitchenOptions }];
  return [{ title: 'Cabinetry and storage', options: kitchenOptions.filter(([key]) => ['baseCabinets', 'drawerUnits', 'overheads', 'tallCabinets', 'openShelves', 'endPanels', 'bulkheads', 'rawMdfBulkheads'].includes(key)).concat([['hangingRail', 'Hanging rail'], ['tallLinenCupboard', 'Tall linen cupboard']]) }];
}

export function cabinetFeatureOptions(room) {
  const shared = [['openShelving', 'Open shelving'], ['featureShelving', 'Feature shelving'], ['endPanels', 'End panels'], ['featurePanels', 'Feature panels'], ['bulkheads', 'Bulkheads'], ['rawMdfBulkheads', 'Raw MDF bulkheads'], ['linenCupboard', 'Linen cupboard']];
  if (roomKind(room) === 'kitchen') return shared.concat([['appliancePanels', 'Appliance panels'], ['fridgePanels', 'Fridge panels'], ['dishwasherPanels', 'Dishwasher panels'], ['microwaveCabinetry', 'Microwave cabinetry'], ['rangehoodCabinetry', 'Rangehood cabinetry']]);
  if (roomKind(room) === 'laundry' || roomKind(room) === 'other') return shared.concat([['hangingRail', 'Hanging rail']]);
  return shared;
}

const labels = Object.fromEntries([...kitchenOptions, ...laundryOptions, ...vanityGroups.flatMap((group) => group.options), ...cabinetFeatureOptions('kitchen'), ...cabinetFeatureOptions('laundry')]);
export function humanLabel(value = '') {
  if (labels[value]) return labels[value];
  return String(value).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/^./, (first) => first.toUpperCase());
}

export function productKey(product) {
  return String(product?.productId || product?.id || product?.productCode || product?.sku || '');
}

export function productName(product) {
  if (!product) return '';
  if (typeof product === 'string') return product;
  return [product.brand || product.supplier, product.productName || product.colourName || product.name, product.finish].filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join(' · ');
}

// Keep the chosen product's identity and useful display fields, never a catalogue or source document.
export function productSnapshot(product) {
  if (!product) return null;
  const fields = ['id', 'productId', 'variantId', 'requiresVariantSelection', 'manufacturerProductId', 'productCode', 'sku', 'brand', 'supplier', 'range', 'productRange', 'productFamily', 'productName', 'colourName', 'colourCode', 'colour', 'finish', 'model', 'style', 'size', 'thickness', 'thicknessKind', 'substrate', 'material', 'description', 'imageUrl', 'primaryImageUrl', 'swatchImage', 'price', 'rrp', 'clientPrice', 'priceStatus', 'currency', 'productUrl', 'officialProductUrl', 'sourceUrl'];
  const snapshot = Object.fromEntries(fields.filter((key) => product[key] !== undefined && product[key] !== null && typeof product[key] !== 'object').map((key) => [key, product[key]]));
  for (const key of ['sizes', 'finishes']) if (Array.isArray(product[key])) snapshot[key] = product[key].filter((value) => typeof value === 'string' || typeof value === 'number');
  return snapshot;
}

export function productVariantSnapshot(product, variant) {
  if (!product || !variant || !product.variants?.some((item) => item.id === variant.id)) return null;
  return productSnapshot({ ...product, ...variant, id: product.id, productId: product.productId || product.id, variantId: variant.id, requiresVariantSelection: true });
}
