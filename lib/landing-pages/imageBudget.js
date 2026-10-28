import fs from 'node:fs';
import path from 'node:path';

// Hard spending guard for paid image generation. Paid calls are disabled unless a budget is configured,
// and every request is reserved against a persistent ledger before it is sent.
export const IMAGE_PRICE_USD = { 'gpt-image-1.5': { low: 0.013, medium: 0.05, high: 0.2 } };

function ledgerPath() {
  return process.env.LANDING_PAGE_IMAGE_LEDGER || path.join(process.cwd(), '.landing-page-image-spend.json');
}

function readLedger() {
  try { return JSON.parse(fs.readFileSync(ledgerPath(), 'utf8')); } catch { return { entries: [] }; }
}

export function imagePriceUsd(model = 'gpt-image-1.5', quality = 'medium') {
  return IMAGE_PRICE_USD[model]?.[quality] ?? null;
}

export function budgetStatus() {
  const limit = Number.parseFloat(process.env.LANDING_PAGE_IMAGE_BUDGET_USD || '0') || 0;
  const spent = readLedger().entries.reduce((total, entry) => total + (Number(entry.costUsd) || 0), 0);
  return { limitUsd: limit, spentUsd: Math.round(spent * 1000) / 1000, remainingUsd: Math.max(0, Math.round((limit - spent) * 1000) / 1000) };
}

// Reserves the cost of one request. Returns false when the price is unknown or the budget would be exceeded.
export function reserveImageSpend({ model, quality = 'medium', purpose = '', workspaceId = '' }) {
  const price = imagePriceUsd(model, quality);
  if (price == null) return { ok: false, reason: `No verified price for ${model}` };
  const status = budgetStatus();
  if (status.limitUsd <= 0) return { ok: false, reason: 'Paid image generation budget is not configured' };
  if (status.spentUsd + price > status.limitUsd + 1e-9) return { ok: false, reason: `Image budget of US$${status.limitUsd.toFixed(2)} would be exceeded` };
  const ledger = readLedger();
  ledger.entries.push({ at: new Date().toISOString(), model, quality, purpose, workspaceId, costUsd: price });
  fs.writeFileSync(ledgerPath(), JSON.stringify(ledger, null, 1));
  return { ok: true, costUsd: price };
}
