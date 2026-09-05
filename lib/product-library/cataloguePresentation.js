export const CATALOGUE_SORT_OPTIONS = [['name','Name A–Z'],['name-desc','Name Z–A'],['brand','Brand A–Z'],['price','Price low–high'],['price-desc','Price high–low'],['updated','Recently updated']];
const name = p => String(p.productName || p.product_name || p.model || '');
export function cataloguePrice(p = {}) {
  const value = p.attributes?.price_per_stock_length ?? p.builderPrice ?? p.clientPrice ?? p.selectedCost ?? p.price ?? p.rrp;
  return value === '' || value == null || !Number.isFinite(Number(value)) ? null : Number(value);
}
export function sortCatalogueProducts(products = [], sort = 'name') {
  return [...products].sort((a,b) => {
    let result = 0;
    if (sort === 'name-desc') result = name(b).localeCompare(name(a), 'en-AU', {numeric:true});
    else if (sort === 'brand') result = String(a.brand || a.manufacturer || '').localeCompare(String(b.brand || b.manufacturer || ''), 'en-AU');
    else if (sort === 'price' || sort === 'price-desc') {
      const x=cataloguePrice(a), y=cataloguePrice(b);
      if (x == null || y == null) result = x == null ? y == null ? 0 : 1 : -1;
      else result = (x-y) * (sort === 'price-desc' ? -1 : 1);
    } else if (sort === 'updated') result = (Date.parse(b.updatedAt || b.updated_at || b.sourceVerifiedAt || b.sourceRetrievedAt || '') || 0) - (Date.parse(a.updatedAt || a.updated_at || a.sourceVerifiedAt || a.sourceRetrievedAt || '') || 0);
    return result || name(a).localeCompare(name(b), 'en-AU', {numeric:true}) || String(a.productId || a.productCode).localeCompare(String(b.productId || b.productCode));
  });
}
export function catalogueFilterValues(products = [], brand = '') {
  const unique = values => [...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  return {brands:unique(products.map(p=>p.brand)), ranges:unique(products.filter(p=>!brand || p.brand===brand).map(p=>p.range))};
}
export const isTrimProduct = p => Boolean(p?.attributes?.trimIdentity);
export function trimRates(value, basis = 'linear') {
  if (value === '' || value == null) return {price_per_linear_metre:null, stock_length_m:5.4, price_per_stock_length:null};
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0) throw Error('Enter a non-negative Australian dollar rate.');
  const lm = basis === 'stock' ? rate / 5.4 : rate;
  return {price_per_linear_metre:Math.round(lm*10000)/10000, stock_length_m:5.4, price_per_stock_length:Math.round(lm*5.4*100)/100};
}
export function trimIdentity(p = {}) {
  const a=p.attributes || {};
  return [p.brand, (a.productTypes || [p.product_type || p.family_key || p.familyKey]).slice().sort().join('/'), p.profile, a.widthMm, a.thicknessMm, p.material, p.finish || 'Unfinished'].map(v=>String(v||'').trim().toLowerCase().replace(/\s+/g,' ')).join('|');
}
export function trimSpecification(p = {}) {
  const a=p.attributes || {};
  return [(a.productTypes || ['Skirting', 'Architrave']).join(' / '),p.brand,p.profile,`${a.widthMm} × ${a.thicknessMm} mm`,p.material,p.finish || 'Unfinished','5.4 m length'].filter(Boolean).join(' · ');
}
export const INTERNAL_CATALOGUE_SECTIONS = {
  'stair-components': [['all','All Stairs & Stair Components'],['complete','Complete stair systems'],['straight','Straight stairs'],['l-shaped','L-shaped stairs'],['u-shaped','U-shaped stairs'],['winder','Winder stairs'],['timber','Timber stairs'],['steel-stringer','Steel-stringer stairs'],['treads','Stair treads'],['risers','Risers'],['stringers','Stringers'],['newel-posts','Newel posts'],['handrails','Handrails'],['balustrade-components','Balustrade components']],
  'wardrobe-systems': [['all','All Wardrobe Systems'],['shelf-rail','Basic shelf and hanging rail'],['double-hanging','Double hanging system'],['walk-in','Walk-in wardrobe system'],['built-in','Built-in wardrobe internals'],['adjustable-shelving','Adjustable shelving'],['drawer-towers','Drawer towers'],['shoe-shelving','Shoe shelving'],['corner-shelving','Corner shelving'],['hanging-rails','Hanging rails'],['baskets','Wardrobe baskets'],['accessories','Accessories']],
};
