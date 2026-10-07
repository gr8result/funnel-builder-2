const money = value => Math.round((value + Number.EPSILON) * 100) / 100;

export function reconcileBrokerHoldings(store, snapshot, importedAt) {
  const next = structuredClone(store);
  if (next.brokerPortfolioSnapshot?.id === snapshot.id) return next;
  const stockHoldings = snapshot.type === "stock-holdings";
  const all = [...next.longTermHoldings, ...next.shortTermTrades];
  const ids = new Set();
  for (const item of snapshot.holdings) {
    const matches = all.filter(row => row.id === item.recordId);
    if (matches.length !== 1 || matches[0].symbol !== item.symbol || ids.has(item.recordId)) {
      throw new Error(`Expected one original record for ${item.symbol}`);
    }
    ids.add(item.recordId);
    const positiveFields = stockHoldings
      ? ["quantity", "nativeCurrentPrice"]
      : ["quantity", "nativeCurrentPrice", "averageBuyPriceAud", "costAud", "marketValueAud"];
    for (const key of positiveFields) {
      if (!Number.isFinite(item[key]) || item[key] <= 0) throw new Error(`Invalid ${key} for ${item.symbol}`);
    }
    if (stockHoldings) {
      if (!Number.isFinite(item.marketValueAud) || item.marketValueAud < 0) throw new Error(`Invalid marketValueAud for ${item.symbol}`);
      for (const key of ["averageBuyPriceAud", "costAud", "fxRate"]) {
        if (item[key] != null && (!Number.isFinite(item[key]) || item[key] <= 0)) throw new Error(`Invalid ${key} for ${item.symbol}`);
      }
      for (const key of ["quantity", "recentBuys", "recentSells", "openSells", "conditionalOrders", "availableToSell"]) {
        if (!Number.isInteger(item[key]) || (key !== "conditionalOrders" && item[key] < 0)) throw new Error(`Invalid ${key} for ${item.symbol}`);
      }
      for (const key of ["nativePriceChange", "priceChangePercent"]) {
        if (item[key] != null && !Number.isFinite(item[key])) throw new Error(`Invalid ${key} for ${item.symbol}`);
      }
      if (item.availableToSell !== item.quantity + item.recentBuys - item.recentSells - item.openSells) throw new Error(`Available to sell mismatch for ${item.symbol}`);
    } else if (money(item.marketValueAud - item.costAud) !== item.profitLossAud) throw new Error(`P&L mismatch for ${item.symbol}`);
  }
  const totalFields = stockHoldings
    ? ["marketValueAud", "quantity", "recentBuys", "recentSells", "openSells", "conditionalOrders", "availableToSell"]
    : ["costAud", "marketValueAud", "profitLossAud"];
  for (const field of totalFields) {
    const total = field;
    if (money(snapshot.holdings.reduce((sum, row) => sum + row[field], 0)) !== snapshot.totals[total]) throw new Error(`Snapshot ${total} does not reconcile`);
  }
  if (stockHoldings && snapshot.accountSummary) {
    for (const field of ["totalHoldingsAud", "cashAud", "totalPortfolioAud", "profitLossAud", "profitLossPercent", "dailyProfitLossAud"]) {
      if (!Number.isFinite(snapshot.accountSummary[field])) throw new Error(`Invalid account summary ${field}`);
    }
    const account = snapshot.accountSummary;
    if (money(account.totalHoldingsAud + account.cashAud) !== account.totalPortfolioAud) throw new Error("Account portfolio total does not reconcile");
  }
  for (const item of snapshot.holdings) {
    const row = all.find(row => row.id === item.recordId);
    const previousHoldingSnapshot = row.brokerHoldingSnapshot;
    const averageBuyPriceAud = stockHoldings
      ? item.averageBuyPriceAud ?? previousHoldingSnapshot?.averageBuyPriceAud ?? (row.purchasePriceCurrency === "AUD" ? row.purchasePrice : null)
      : item.averageBuyPriceAud;
    const costAud = stockHoldings ? item.costAud ?? previousHoldingSnapshot?.costAud ?? null : item.costAud;
    const wasPending = row.status === "pending";
    if (wasPending && !row.originalOrder) row.originalOrder = structuredClone(row);
    row.brokerSnapshotHistory = [...(row.brokerSnapshotHistory || []), {
      snapshotId: snapshot.id, importedAt, previousRecord: structuredClone(row),
    }];
    Object.assign(row, {
      quantity: item.quantity, companyName: item.companyName || row.companyName,
      status: "open", termClassification: item.termClassification || row.termClassification || row.kind,
      nativeCurrency: item.nativeCurrency, nativeCurrentPrice: item.nativeCurrentPrice,
      purchasePrice: averageBuyPriceAud, purchasePriceCurrency: "AUD", valuationCurrency: "AUD",
      brokerHoldingSnapshot: { ...item, id: snapshot.id, source: snapshot.source, importedAt,
        ...(stockHoldings ? { type: snapshot.type, broker: snapshot.broker || "CMC", averageBuyPriceAud, costAud,
          profitLossAud: null, profitLossPercent: null, dailyProfitLossAud: null,
          costBasisSourceSnapshotId: previousHoldingSnapshot?.costBasisSourceSnapshotId || previousHoldingSnapshot?.id || null } : {}),
        quoteTimestamp: null, fxRate: item.fxRate ?? null, fxTimestamp: null, displayOrder: snapshot.holdings.indexOf(item) },
      updatedAt: importedAt,
    });
    if (wasPending) {
      row.orderClassification = "COMPLETED_PURCHASE";
      row.orderStatus = "Holding confirmed by CMC snapshot";
      row.filledQuantity = item.quantity;
      row.averageFilledPrice = item.nativeCurrency === "AUD" ? averageBuyPriceAud : null;
      row.entryPrice = row.averageFilledPrice;
      row.fillTimestamp = null;
      row.purchaseDate = null;
      row.requiresFillConfirmation = false;
      row.orderHistory = [...(row.orderHistory || []), { type: "BROKER_HOLDING_CONFIRMED", at: importedAt,
        snapshotId: snapshot.id, quantity: item.quantity, fillTimestamp: null,
        averageCostAud: averageBuyPriceAud, nativeExecutionPrice: row.averageFilledPrice,
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
  if (next.brokerPortfolioSnapshot) {
    next.brokerPortfolioSnapshotHistory = [...(next.brokerPortfolioSnapshotHistory || []), {
      replacedAt: importedAt, snapshot: structuredClone(next.brokerPortfolioSnapshot),
    }];
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
  const nativeValuation = snapshot.valuationCurrency === "USD";
  const currency = snapshot.valuationCurrency || "AUD";
  const source = snapshot.broker || "CMC";
  const pnl = nativeValuation ? snapshot.profitLoss : snapshot.profitLossAud;
  return {
    ...row, dataAvailable: true, currentPrice: snapshot.nativeCurrentPrice,
    nativeCurrency: snapshot.nativeCurrency, valuationCurrency: currency, purchasePriceCurrency: currency,
    purchasePrice: nativeValuation ? snapshot.fifoPrice : snapshot.averageBuyPriceAud,
    amountInvested: nativeValuation ? snapshot.cost : snapshot.costAud,
    currentValue: nativeValuation ? snapshot.marketValue : snapshot.marketValueAud,
    marketValue: nativeValuation ? snapshot.marketValue : snapshot.marketValueAud,
    profitLoss: pnl, profitLossPercent: snapshot.profitLossPercent,
    dailyProfitLoss: snapshot.dailyProfitLossAud, dataTimestamp: snapshot.quoteTimestamp,
    valuationSource: `${source} holdings snapshot`, notYetOwned: false, effectiveStatus: "open",
    statusLabel: "Open", statusMessage: `Holding confirmed by ${source} snapshot`,
    tone: pnl == null ? "grey" : pnl >= 0 ? "green" : "amber",
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
  const valuationChanged = (patch.purchasePrice !== undefined && patch.purchasePrice !== row.purchasePrice) ||
    (patch.quantity !== undefined && patch.quantity !== row.quantity);
  if (valuationChanged && snapshot.valuationCurrency === "USD") {
    snapshot.fifoPrice = updated.purchasePrice;
    snapshot.quantity = updated.quantity;
    // Rounded FIFO is not an exact cost basis. An edit invalidates broker P&L.
    snapshot.cost = null;
    snapshot.marketValue = money(snapshot.nativeCurrentPrice * updated.quantity);
    snapshot.profitLoss = null;
    snapshot.profitLossPercent = null;
    snapshot.valuationEditedAt = at;
  } else if (valuationChanged) {
    snapshot.averageBuyPriceAud = updated.purchasePrice;
    snapshot.quantity = updated.quantity;
    snapshot.costAud = money(updated.purchasePrice * updated.quantity);
    snapshot.marketValueAud = money(row.brokerHoldingSnapshot.marketValueAud * updated.quantity / row.quantity);
    snapshot.profitLossAud = snapshot.type === "stock-holdings" ? null : money(snapshot.marketValueAud - snapshot.costAud);
    snapshot.profitLossPercent = snapshot.type === "stock-holdings" ? null : money(snapshot.profitLossAud / snapshot.costAud * 100);
    snapshot.valuationEditedAt = at;
    snapshot.source = "User edit of CMC holding; valuation recalculated from saved snapshot";
  }
  updated.updatedAt = at;
  updated.orderHistory = [...(row.orderHistory || []), { type: "HOLDING_EDIT", at, changes: patch }];
  return { ok: true, errors: [], value: updated };
}
