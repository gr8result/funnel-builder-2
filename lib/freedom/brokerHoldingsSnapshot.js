const money = value => Math.round((value + Number.EPSILON) * 100) / 100;

export function reconcileBrokerHoldings(store, snapshot, importedAt) {
  const next = structuredClone(store);
  if (next.brokerPortfolioSnapshot?.id === snapshot.id) return next;
  const all = [...next.longTermHoldings, ...next.shortTermTrades];
  const ids = new Set();
  for (const item of snapshot.holdings) {
    const matches = all.filter(row => row.id === item.recordId);
    if (matches.length !== 1 || matches[0].symbol !== item.symbol || ids.has(item.recordId)) {
      throw new Error(`Expected one original record for ${item.symbol}`);
    }
    ids.add(item.recordId);
    for (const key of ["quantity", "nativeCurrentPrice", "averageBuyPriceAud", "costAud", "marketValueAud"]) {
      if (!Number.isFinite(item[key]) || item[key] <= 0) throw new Error(`Invalid ${key} for ${item.symbol}`);
    }
    if (money(item.marketValueAud - item.costAud) !== item.profitLossAud) throw new Error(`P&L mismatch for ${item.symbol}`);
  }
  for (const [field, total] of [["costAud", "costAud"], ["marketValueAud", "marketValueAud"], ["profitLossAud", "profitLossAud"]]) {
    if (money(snapshot.holdings.reduce((sum, row) => sum + row[field], 0)) !== snapshot.totals[total]) throw new Error(`Snapshot ${total} does not reconcile`);
  }
  for (const item of snapshot.holdings) {
    const row = all.find(row => row.id === item.recordId);
    const wasPending = row.status === "pending";
    if (wasPending && !row.originalOrder) row.originalOrder = structuredClone(row);
    row.brokerSnapshotHistory = [...(row.brokerSnapshotHistory || []), {
      snapshotId: snapshot.id, importedAt, previousRecord: structuredClone(row),
    }];
    Object.assign(row, {
      quantity: item.quantity, companyName: item.companyName || row.companyName,
      status: "open", termClassification: item.termClassification || row.termClassification || row.kind,
      nativeCurrency: item.nativeCurrency, nativeCurrentPrice: item.nativeCurrentPrice,
      purchasePrice: item.averageBuyPriceAud, purchasePriceCurrency: "AUD", valuationCurrency: "AUD",
      brokerHoldingSnapshot: { ...item, id: snapshot.id, source: snapshot.source, importedAt,
        quoteTimestamp: null, fxRate: null, fxTimestamp: null, displayOrder: snapshot.holdings.indexOf(item) },
      updatedAt: importedAt,
    });
    if (wasPending) {
      row.orderClassification = "COMPLETED_PURCHASE";
      row.orderStatus = "Holding confirmed by CMC snapshot";
      row.filledQuantity = item.quantity;
      row.averageFilledPrice = item.nativeCurrency === "AUD" ? item.averageBuyPriceAud : null;
      row.entryPrice = row.averageFilledPrice;
      row.fillTimestamp = null;
      row.purchaseDate = null;
      row.requiresFillConfirmation = false;
      row.orderHistory = [...(row.orderHistory || []), { type: "BROKER_HOLDING_CONFIRMED", at: importedAt,
        snapshotId: snapshot.id, quantity: item.quantity, fillTimestamp: null,
        averageCostAud: item.averageBuyPriceAud, nativeExecutionPrice: row.averageFilledPrice,
        note: "Current ownership confirmed by user-supplied CMC holdings snapshot; execution time not supplied." }];
    }
    if (row.termClassification === "long-term" && next.shortTermTrades.some(item => item.id === row.id)) {
      next.shortTermTrades = next.shortTermTrades.filter(item => item.id !== row.id);
      row.kind = "long-term";
      next.longTermHoldings.push(row);
    }
  }
  next.archivedHoldings ||= [];
  for (const id of snapshot.archiveIds || []) {
    const row = [...next.longTermHoldings, ...next.shortTermTrades].find(row => row.id === id);
    if (!row) throw new Error(`Original record to archive was not found: ${id}`);
    row.status = "archived";
    row.archiveReason = "No longer shown in current broker holdings—sale details require confirmation.";
    row.archivedAt = importedAt;
    row.salePrice = null;
    row.saleDate = null;
    row.realisedProfitLoss = null;
    row.orderHistory = [...(row.orderHistory || []), { type: "ABSENT_FROM_BROKER_HOLDINGS", at: importedAt, snapshotId: snapshot.id, note: row.archiveReason }];
    next.archivedHoldings.push(row);
    next.longTermHoldings = next.longTermHoldings.filter(item => item.id !== id);
    next.shortTermTrades = next.shortTermTrades.filter(item => item.id !== id);
  }
  next.brokerPortfolioSnapshot = { ...snapshot, importedAt, quoteTimestamp: null, fxRate: null, fxTimestamp: null };
  next.updatedAt = importedAt;
  const finalIds = [...next.longTermHoldings, ...next.shortTermTrades, ...next.archivedHoldings].map(row => row.id);
  if (new Set(finalIds).size !== finalIds.length) throw new Error("Duplicate record IDs after reconciliation");
  return next;
}

// Broker AUD totals are authoritative: multiplying rounded averages or USD quotes
// cannot reproduce them. Live history remains available separately for charts.
export function brokerHoldingValuation(row) {
  const snapshot = row.brokerHoldingSnapshot;
  if (!snapshot) return null;
  const price = snapshot.nativeCurrentPrice;
  const target = row.targetPrice ?? row.takeSomeProfit ?? null;
  return {
    ...row, dataAvailable: true, currentPrice: snapshot.nativeCurrentPrice,
    nativeCurrency: snapshot.nativeCurrency, valuationCurrency: "AUD", purchasePriceCurrency: "AUD",
    purchasePrice: snapshot.averageBuyPriceAud, amountInvested: snapshot.costAud,
    currentValue: snapshot.marketValueAud, marketValue: snapshot.marketValueAud,
    profitLoss: snapshot.profitLossAud, profitLossPercent: snapshot.profitLossPercent,
    dailyProfitLoss: snapshot.dailyProfitLossAud, dataTimestamp: snapshot.quoteTimestamp,
    valuationSource: "CMC holdings snapshot", notYetOwned: false, effectiveStatus: "open",
    statusLabel: "Open", statusMessage: "Holding confirmed by CMC snapshot",
    tone: snapshot.profitLossAud >= 0 ? "green" : "amber",
    targetPrice: target,
    distanceToTarget: target == null ? null : money(target - price),
    distanceToTargetPercent: target == null ? null : money((target - price) / price * 100),
    distanceToSafetyExit: row.safetyExit == null ? null : money(price - row.safetyExit),
    distanceToSafetyExitPercent: row.safetyExit == null ? null : money((price - row.safetyExit) / price * 100),
    pendingSellOrders: (row.pendingSellOrders || []).map(order => ({ ...order,
      currentPrice: price, distanceToTarget: money(order.targetPrice - price),
      distanceToTargetPercent: money((order.targetPrice - price) / price * 100),
      potentialMovement: money((order.targetPrice - price) * order.quantity),
      currentPriceSource: "CMC holdings snapshot",
    })),
  };
}

export function editBrokerHolding(row, patch, at = new Date().toISOString()) {
  const updated = structuredClone(row);
  const snapshot = updated.brokerHoldingSnapshot;
  for (const key of ["quantity", "purchasePrice", "targetPrice", "safetyExit", "takeSomeProfit"]) {
    if (!(key in patch)) continue;
    const value = patch[key];
    if (value !== null && (!Number.isFinite(value) || value <= 0)) return { ok: false, errors: [`Invalid ${key}.`] };
    if (["quantity", "purchasePrice"].includes(key) && value === null) return { ok: false, errors: [`${key} is required.`] };
    updated[key] = value;
  }
  if (patch.purchasePrice !== undefined || patch.quantity !== undefined) {
    snapshot.averageBuyPriceAud = updated.purchasePrice;
    snapshot.quantity = updated.quantity;
    snapshot.costAud = money(updated.purchasePrice * updated.quantity);
    snapshot.marketValueAud = money(row.brokerHoldingSnapshot.marketValueAud * updated.quantity / row.quantity);
    snapshot.profitLossAud = money(snapshot.marketValueAud - snapshot.costAud);
    snapshot.profitLossPercent = money(snapshot.profitLossAud / snapshot.costAud * 100);
    snapshot.valuationEditedAt = at;
    snapshot.source = "User edit of CMC holding; valuation recalculated from saved snapshot";
  }
  updated.updatedAt = at;
  updated.orderHistory = [...(row.orderHistory || []), { type: "HOLDING_EDIT", at, changes: patch }];
  return { ok: true, errors: [], value: updated };
}
