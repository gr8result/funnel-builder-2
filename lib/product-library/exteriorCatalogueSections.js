// Browse mappings only: canonical product IDs, families and prices are preserved.
export const EXTERIOR_CATALOGUE_SECTIONS = {
  'skirting-architraves': [['all', 'Skirting & Architraves'], ['skirting', 'Skirting'], ['architraves', 'Architraves']],
  roofing: [
    ['all', 'All Roofing'], ['roofing-products', 'Roofing Products'],
    ['fascia', 'Fascia'], ['gutters', 'Gutters'], ['downpipes', 'Downpipes'],
    ['flashings', 'Flashings'], ['roof-ventilation', 'Roof Ventilation'], ['roof-accessories', 'Roof Accessories'],
  ],
  'entry-doors': [
    ['all', 'All Entry Doors & Door Furniture'], ['entry-doors', 'Entry Doors'],
    ['entrance-handles', 'Entrance Handles'], ['entrance-locksets', 'Entrance Locksets'],
    ['deadbolts', 'Deadbolts'], ['mortice-locks', 'Mortice Locks'],
    ['smart-digital-locks', 'Smart/Digital Locks'], ['hinges', 'Hinges'],
    ['door-closers', 'Door Closers'], ['door-accessories', 'Door Accessories'],
  ],
};

export function isExternalDoorHardware(product = {}) {
  const family = product.familyKey || product.familyId || product.family_key || '';
  if (family === 'entry-door-furniture') return true;
  if (!['handles', 'door-hardware'].includes(family)) return false;
  const text = [product.attributes?.handleUse, product.attributes?.choiceType, product.attributes?.doorCompatibility, product.categoryKey, product.productName].filter(Boolean).join(' ');
  if (/cabinet|cupboard|drawer|kitchen/i.test(text)) return false;
  return /entry|entrance|external|exterior/i.test(text);
}

export function exteriorSectionForProduct(product = {}, parent = '') {
  const family = product.familyKey || product.familyId || product.family_key || '';
  if (parent === 'skirting-architraves') return family === 'architraves' ? 'architraves' : family === 'skirting' ? 'skirting' : '';
  if (parent === 'roofing') {
    if (!['roofing', 'gutters-fascia'].includes(family)) return '';
    const step = product.attributes?.roofPackageStep || product.configuration || product.attributes?.configuration || '';
    const text = `${step || product.categoryKey || ''} ${product.productName || product.product_name || ''}`.toLowerCase();
    // Explicit package steps take priority over descriptions mentioning compatible products.
    for (const [pattern, section] of [[/downpipe/, 'downpipes'], [/fascia/, 'fascia'], [/gutter/, 'gutters'], [/flash/, 'flashings'], [/ventilat|whirly|roof vent/, 'roof-ventilation'], [/accessor|sarking|underlay|fastener|roof screw|ridge cap|battens?/, 'roof-accessories']]) {
      if (pattern.test(String(step).toLowerCase())) return section;
    }
    for (const [pattern, section] of [[/downpipe/, 'downpipes'], [/fascia/, 'fascia'], [/gutter/, 'gutters'], [/flash/, 'flashings'], [/ventilat|whirly|roof vent/, 'roof-ventilation'], [/accessor|sarking|underlay|fastener|roof screw|ridge cap|battens?/, 'roof-accessories']]) {
      if (pattern.test(text)) return section;
    }
    return 'roofing-products';
  }
  if (parent !== 'entry-doors') return '';
  if (family === 'entry-doors') return 'entry-doors';
  if (!isExternalDoorHardware(product)) return '';
  const text = [product.attributes?.hardwareType, product.attributes?.choiceType, product.productName, product.product_name, product.productType].filter(Boolean).join(' ').toLowerCase();
  if (/smart|digital|keyless|electronic/.test(text)) return 'smart-digital-locks';
  if (/deadbolt|dead bolt/.test(text)) return 'deadbolts';
  if (/mortice|mortise/.test(text)) return 'mortice-locks';
  if (/hinge/.test(text)) return 'hinges';
  if (/closer/.test(text)) return 'door-closers';
  if (/lockset|lock set|trilock|lock combination|entrance set|deadlatch|security set|entry lock|entrance lock|lock kit|roller lock/.test(text)) return 'entrance-locksets';
  if (/handle|lever|pull/.test(text)) return 'entrance-handles';
  return 'door-accessories';
}

export const ENTRANCE_HARDWARE_IMAGE = '/images/product-library/entrance-door-lockset.jpg';
