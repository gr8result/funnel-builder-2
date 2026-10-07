// Import an explicitly supplied position without fabricating executions or FX.
export function importNativeBrokerPosition(store, snapshot, at) {
  const next = structuredClone(store);
  const all = [...next.shortTermTrades, ...next.longTermHoldings, ...(next.archivedHoldings || [])];
  const matches = all.filter(row => String(row.symbol).replace(/:US$/, "").toUpperCase() === snapshot.symbol);
  if (matches.length > 1) throw new Error("Multiple existing positions match; reconciliation required");
  if (matches[0]?.brokerHoldingSnapshot?.id === snapshot.id) return next;
  // Existing positions require explicit stable-ID reconciliation, never replacement.
  if (matches.length) throw new Error(`Existing position ${matches[0].id} must be reconciled before import`);
  if (snapshot.nativeCurrency !== "USD" || snapshot.valuationCurrency !== "USD" ||
      !Number.isFinite(snapshot.quantity) || snapshot.quantity <= 0 ||
      !Number.isFinite(snapshot.nativeCurrentPrice) || snapshot.nativeCurrentPrice <= 0 ||
      Math.round(snapshot.quantity * snapshot.nativeCurrentPrice * 100) !== Math.round(snapshot.marketValue * 100)) {
    throw new Error("Invalid native position snapshot");
  }
  const row = {
    id: `broker_${snapshot.id}`, kind: snapshot.termClassification, termClassification: snapshot.termClassification,
    symbol: snapshot.symbol, exchange: snapshot.exchange, companyName: snapshot.companyName,
    broker: snapshot.broker, currency: snapshot.nativeCurrency, nativeCurrency: snapshot.nativeCurrency,
    valuationCurrency: snapshot.valuationCurrency, purchasePriceCurrency: snapshot.valuationCurrency,
    quantity: snapshot.quantity, status: "open", orderClassification: "COMPLETED_PURCHASE",
    purchasePrice: snapshot.fifoPrice, purchasePriceType: "rounded FIFO cost",
    nativeCurrentPrice: snapshot.nativeCurrentPrice,
    entryPrice: null, averageFilledPrice: null, purchaseDate: null, entryDate: null, fillTimestamp: null,
    targetPrice: null, safetyExit: null, takeSomeProfit: null, finalExit: null,
    pendingSellOrders: [], createdAt: at, updatedAt: at,
    brokerHoldingSnapshot: { ...snapshot, importedAt: at, displayOrder: 5 },
    orderHistory: [{ type: "BROKER_HOLDING_CONFIRMED", at, snapshotId: snapshot.id,
      note: "Ownership confirmed by supplied screenshot; original executions and dates not supplied." }],
  };
  (row.kind === "long-term" ? next.longTermHoldings : next.shortTermTrades).push(row);
  next.updatedAt = at;
  return next;
}
