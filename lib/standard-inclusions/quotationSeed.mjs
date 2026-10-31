function amountOrNull(value) {
  if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) return null;
  return Number(value);
}

export function buildStandardInclusionsQuotationSeed(snapshot = {}) {
  const scheduleId = String(snapshot.scheduleId || "");
  const versionId = String(snapshot.scheduleVersionId || "");
  if (!scheduleId || !versionId) throw new Error("Approved schedule and version identities are required.");
  const items = Array.isArray(snapshot.items) ? snapshot.items : [];
  const lines = items.filter((item) => item.reviewStatus === "approved").map((item) => {
    const product = item.product || {};
    const overrideAllowance = amountOrNull(item.allowanceOverride);
    const reviewedPrice = item.includedPriceBasis === "catalogue_unit_price" && typeof product.gstIncluded === "boolean" ? amountOrNull(item.includedUnitPrice) : null;
    const allowance = overrideAllowance ?? amountOrNull(item.allowance) ?? amountOrNull(product.allowance) ?? reviewedPrice;
    const productId = String(product.productId || "");
    const itemId = String(item.id || "");
    if (!productId && !itemId) throw new Error("Every approved inclusion needs a stable product or item identity.");
    return {
      lineId: `standard-inclusion:${scheduleId}:${versionId}:${itemId || productId}`,
      scheduleId,
      scheduleVersionId: versionId,
      scheduleVersion: Number(snapshot.scheduleVersion) || 0,
      inclusionItemId: itemId,
      productId: productId || null,
      productCode: product.sku || product.model || null,
      productName: product.name || item.description || "Builder specification",
      category: String(item.category || "Other builder-specific inclusions"),
      description: String(item.description || product.description || ""),
      specification: String(item.specification || product.specification || ""),
      brand: String(product.brand || ""),
      model: String(product.model || ""),
      supplier: String(product.supplier || ""),
      quantity: amountOrNull(item.quantity),
      unit: String(item.unit || product.unit || ""),
      allowance,
      allowanceBasis: overrideAllowance !== null ? "builder_schedule_override" : allowance == null ? "unpriced" : reviewedPrice !== null && product.allowance == null ? "reviewed_catalogue_unit_price" : "product_library_base_allowance",
      upgradePrice: amountOrNull(product.price),
      currency: String(product.currency || "AUD"),
      gstIncluded: typeof product.gstIncluded === "boolean" ? product.gstIncluded : null,
      source: "approved_standard_inclusions",
      status: "approved",
    };
  });

  const seen = new Set();
  for (const line of lines) {
    if (seen.has(line.lineId)) throw new Error(`Duplicate approved inclusion identity: ${line.lineId}`);
    seen.add(line.lineId);
  }
  return {
    scheduleId,
    scheduleVersionId: versionId,
    scheduleVersion: Number(snapshot.scheduleVersion) || 0,
    scheduleName: String(snapshot.scheduleName || "Standard Inclusions"),
    tierKey: String(snapshot.tierKey || ""),
    workspaceId: String(snapshot.sourceWorkspaceId || ""),
    lines,
  };
}
