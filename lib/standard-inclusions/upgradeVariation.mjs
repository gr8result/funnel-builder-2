const amount = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const money = value => Math.round((value + Number.EPSILON) * 100) / 100;

export function standardInclusionUpgradeProposals(workbook = {}, products = [], { quotation = workbook.quotation } = {}) {
  const baseline = workbook.jobInclusionSnapshot?.jobInclusionSnapshot || workbook.jobInclusionSnapshot;
  if (baseline?.schedule?.source !== 'standard-inclusions') return [];
  const catalogue = new Map(products.map(product => [product.productId || product.id, product]));
  const targets = Object.entries(quotation || {}).flatMap(([section, group]) => (group.rows || []).map(row => ({ section, row })));
  const proposals = new Map();
  for (const room of workbook.clientSelectionsBook?.rooms || []) for (const row of room.rows || []) {
    const selection = row.guidedSelection || row;
    const slot = selection.selectionSlotId || selection.requirementKey;
    const locationId = selection.locationId || null;
    const includes = (baseline.items || []).filter(item => (item.selection_slot_id || item.selectionSlotId) === slot);
    const located = includes.filter(item => (item.location_id || item.locationId || null) === locationId);
    const candidates = located.length ? located : includes.filter(item => !(item.location_id || item.locationId));
    if (candidates.length !== 1 || !selection.productId) continue;
    const included = candidates[0];
    const includedId = included.baselineProductId || included.default_product_id;
    if (includedId === selection.productId) continue;
    const key = `${baseline.schedule.id}:${baseline.schedule.scheduleVersionId}:${slot}:${locationId || 'default'}`;
    const prior = proposals.get(key);
    if (prior && prior.productId !== selection.productId) {
      proposals.set(key, { ...prior, status: 'CONFLICT', reason: 'Multiple replacements exist for this inclusion and location.' });
      continue;
    }
    const product = catalogue.get(selection.productId);
    const matchingRows = targets.filter(target => target.row.selectionSlotId === slot && (!locationId || target.row.locationId === locationId || !target.row.locationId));
    const target = matchingRows.length === 1 ? matchingRows[0] : null;
    const quantity = target ? amount(target.row.qty ?? target.row.quantity) : null;
    const currentPrice = product ? amount(product.clientPrice ?? product.price) : null;
    const includesGst = product?.priceIncludesGst ?? product?.gstIncluded;
    const pricePending = !product || product.active === false || product.selectable === false || product.priceReviewRequired === true
      || ['hidden', 'draft', 'verification-required'].includes(String(product.eligibility || '').toLowerCase())
      || /pending|quote|required|unconfirmed|expired/i.test(String(product.priceStatus || ''));
    const unitPriceExGst = currentPrice === null || typeof includesGst !== 'boolean' || pricePending ? null : includesGst ? money(currentPrice / 1.1) : currentPrice;
    const creditExGst = included.baselinePriceIncludesGst === false ? amount(included.baselineUnitPrice) : null;
    const manualCredit = target && (target.row.selectionSource === 'MANUAL_OVERRIDE' || amount(target.row.manualRate) !== null);
    const status = !target ? 'MAPPING_REQUIRED' : manualCredit ? 'CONTRACT_CREDIT_REVIEW' : quantity === null || quantity <= 0 ? 'QUANTITY_REQUIRED' : unitPriceExGst === null || creditExGst === null ? 'PRICE_REQUIRED' : 'READY';
    proposals.set(key, {
      key, status, selectionSlotId: slot, locationId,
      scheduleId: baseline.schedule.id, scheduleVersionId: baseline.schedule.scheduleVersionId,
      includedProductId: includedId, includedProductName: included.baselineProductName || includedId,
      productId: selection.productId, productName: product?.productName || product?.name || selection.productName || selection.productId,
      quantity, unit: target?.row.unit || included.metadata?.unit || '',
      sourceQuoteRowId: target?.row.id || '', sourceSection: target?.section || '',
      creditExGst, unitPriceExGst,
      unitDifferenceExGst: status === 'READY' ? money(unitPriceExGst - creditExGst) : null,
      differenceExGst: status === 'READY' ? money((unitPriceExGst - creditExGst) * quantity) : null,
    });
  }
  return [...proposals.values()];
}

export function priceStandardInclusionUpgrade(workbook, proposal, calculate) {
  if (proposal.status !== 'READY') throw Error('Resolve the inclusion mapping, quantity and current catalogue price before preparing a variation.');
  const section = workbook.quotation?.[proposal.sourceSection];
  if (!section?.rows?.some(row => row.id === proposal.sourceQuoteRowId)) throw Error('The original quotation row is no longer available.');
  const withPrice = price => ({ ...workbook, quotation: { ...workbook.quotation, [proposal.sourceSection]: {
    ...section, rows: section.rows.map(row => row.id === proposal.sourceQuoteRowId ? { ...row, selectionSource: 'CLIENT_SELECTION', activeUnitPrice: price, selectionPricePending: false } : row),
  } } });
  const before = calculate(withPrice(proposal.creditExGst)).summary;
  const after = calculate(withPrice(proposal.unitPriceExGst)).summary;
  const total = money(after.finalQuoteTotal - before.finalQuoteTotal);
  const gst = money(after.gst - before.gst);
  if (![total, gst].every(Number.isFinite)) throw Error('The existing quotation calculator could not price this upgrade.');
  return { ...proposal, subtotal: money(total - gst), gst, total, gstRate: after.gstPercent, pricingRules: {
    preliminaryCostsPercent: after.preliminaryCostsPercent, overheadsPercent: after.overheadsPercent,
    marginPercent: after.marginPercent, profitPercent: after.profitPercent, gstPercent: after.gstPercent,
    salesCommissionPercent: after.salesCommissionPercent,
  } };
}

export async function standardInclusionUpgradeDraftId({ workspaceId, projectId, snapshotId, upgrade }) {
  if (!workspaceId || !projectId || !snapshotId || !upgrade?.key || !upgrade.productId) throw Error('An upgrade requires an authorised workspace, job and saved snapshot.');
  const input = JSON.stringify([workspaceId, projectId, upgrade.key, upgrade.productId]);
  const bytes = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))).slice(0, 16);
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function planUpgradeVariationTransition(variation, action, { userId, now }) {
  if (variation?.metadata?.source !== 'standard_inclusion_upgrade') throw Error('This record is not a Standard Inclusions upgrade.');
  const metadata = { ...variation.metadata, paymentStatus: variation.metadata.paymentStatus || 'not_requested', quoteTreatment: 'separate_variation' };
  if (action === 'approve') {
    if (variation.status !== 'draft') throw Error('Only a draft upgrade can be reviewed.');
    return { metadata: { ...metadata, uiStatus: 'draft', builderReviewStatus: 'approved', builderReviewedBy: userId, builderReviewedAt: now } };
  }
  if (action === 'issue') {
    if (!['draft', 'submitted'].includes(variation.status) || metadata.builderReviewStatus !== 'approved') throw Error('Builder approval is required before issuing this upgrade.');
    return { status: 'submitted', submitted_at: variation.submitted_at || now, client_visible: true, requires_client_approval: true, client_status: 'awaiting_client', metadata: { ...metadata, uiStatus: 'sent', paymentStatus: 'outstanding', issuedBy: userId } };
  }
  throw Error('Unsupported upgrade variation action.');
}

export function planUpgradeClientResponse(variation, action, { now, clientName, clientEmail }) {
  if (variation?.metadata?.source !== 'standard_inclusion_upgrade') return null;
  if (variation.metadata.builderReviewStatus !== 'approved' || !['submitted', 'approved', 'rejected'].includes(variation.status)) throw Error('This upgrade has not been issued after builder approval.');
  if (!['approved', 'rejected', 'changes_requested'].includes(action)) throw Error('Unsupported client response.');
  if (['approved', 'rejected'].includes(variation.status) && variation.status !== action) throw Error('This upgrade already has a different client decision.');
  return {
    status: action === 'changes_requested' ? 'submitted' : action,
    client_status: action,
    ...(action === 'approved' ? { approved_at: variation.approved_at || now, approved_by_name: clientName, approved_by_email: clientEmail } : {}),
    metadata: { ...variation.metadata, uiStatus: action === 'changes_requested' ? 'sent' : action, clientResponseAt: now, paymentStatus: action === 'rejected' ? 'not_required' : 'outstanding', quoteTreatment: 'separate_variation' },
  };
}