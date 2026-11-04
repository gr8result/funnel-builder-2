const UNPRICED = new Set(['price_pending', 'quote_required', 'expired', 'discontinued']);
const positiveOrZero = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const allowanceAmount = (allowance) => typeof allowance === 'number' ? positiveOrZero(allowance) : positiveOrZero(allowance?.unitPrice ?? allowance?.amount ?? allowance?.value);
const priceStatus = (product = {}) => String(product.priceStatus ?? product.price_status ?? product.metadata?.productEntity?.priceStatus ?? '').trim().toLowerCase();
const effectiveClientPrice = (product = {}) => {
  if (UNPRICED.has(priceStatus(product))) return null;
  return positiveOrZero(product.clientPrice ?? product.client_price ?? product.metadata?.productEntity?.clientPrice ?? product.upgradePrice ?? product.upgrade_cost);
};

function exGst(value, gstIncluded) {
  if (value === null) return null;
  return gstIncluded === true ? Math.round((value / 1.1 + Number.EPSILON) * 100) / 100 : value;
}

export function resolveInclusionBaselineItems(items = [], { workspaceId, privateProducts = [], catalogueProducts = [] } = {}) {
  const privateById = new Map(privateProducts.filter(product => product?.workspace_id === workspaceId).map(product => [product.id, product]));
  const catalogueById = new Map(catalogueProducts.map(product => [product.productId || product.productCode, product]));
  return items.map(item => {
    const privateProduct = item.default_product_id ? privateById.get(item.default_product_id) : null;
    const catalogueProduct = item.default_catalogue_product_id ? catalogueById.get(item.default_catalogue_product_id) : null;
    const product = privateProduct || catalogueProduct || null;
    const explicitAllowance = allowanceAmount(item.allowance);
    const allowanceGstIncluded = item.allowance?.gstIncluded ?? item.allowance?.priceIncludesGst ?? item.gstIncluded ?? item.priceIncludesGst;
    const productPrice = explicitAllowance === null ? effectiveClientPrice(product || {}) : null;
    const gstIncluded = product?.gstIncluded ?? product?.gst_included ?? product?.metadata?.productEntity?.gstIncluded;
    const baselineUnitPrice = explicitAllowance !== null
      ? exGst(explicitAllowance, allowanceGstIncluded)
      : typeof gstIncluded === 'boolean' ? exGst(productPrice, gstIncluded) : null;
    return {
      ...item,
      baselineProductName: item.baselineProductName || product?.productName || product?.product_name || product?.metadata?.productEntity?.productName || null,
      baselineUnitPrice,
      baselinePriceIncludesGst: explicitAllowance !== null ? typeof allowanceGstIncluded === 'boolean' ? allowanceGstIncluded : null : productPrice === null || typeof gstIncluded !== 'boolean' ? null : gstIncluded,
      baselineProductSource: explicitAllowance !== null ? 'INCLUSION_ALLOWANCE' : product ? privateProduct ? 'WORKSPACE_PRODUCT' : 'PRODUCT_LIBRARY' : 'UNRESOLVED',
    };
  });
}
