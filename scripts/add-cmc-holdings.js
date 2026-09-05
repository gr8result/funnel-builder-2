#!/usr/bin/env node
/**
 * Add CMC holdings to Freedom trades store.
 * Preserves CMC snapshot data with proper broker provenance tracking.
 */

const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(process.cwd(), 'tmp', 'freedom-trades.json');

function newId(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

const CMC_HOLDINGS = [
  {
    symbol: 'CBA',
    exchange: 'ASX',
    currency: 'AUD',
    companyName: 'Commonwealth Bank of Australia',
    purchasePrice: 159.174,
    quantity: 45,
    purchaseDate: '2026-08-01T00:00:00.000Z',
    reason: 'Real broker holding from CMC Invest. Active position: 45 shares at A$159.174 average cost, Total AUD cost: A$7,162.85, Current CMC market value: A$7,182.90, Current profit: +A$20.05 (+0.28%)',
    broker: 'CMC Invest',
    importFingerprint: 'cmc_real_cba_45',
    sourceStorage: 'CMC Markets real holding',
  },
  {
    symbol: 'JBLU',
    exchange: 'US',
    currency: 'AUD',
    companyName: 'JetBlue Airways',
    purchasePrice: 7.016,
    quantity: 240,
    purchaseDate: '2026-08-01T00:00:00.000Z',
    reason: 'Real broker holding from CMC Invest. 240 shares, AUD cost basis A$7.016 per share, Total AUD cost: A$1,683.94, Current CMC USD price: US$4.4700, Current AUD market value: A$1,492.83, Current loss: -A$191.12 (-11.35%). NOTE: CMC displays AUD cost with USD market price.',
    broker: 'CMC Invest',
    importFingerprint: 'cmc_real_jblu_240',
    sourceStorage: 'CMC Markets real holding',
  },
  {
    symbol: 'WULF',
    exchange: 'US',
    currency: 'AUD',
    companyName: 'TeraWulf Inc',
    purchasePrice: 21.619,
    quantity: 88,
    purchaseDate: '2026-08-01T00:00:00.000Z',
    reason: 'Real broker holding from CMC Invest. 88 shares, AUD cost basis A$21.619 per share, Total AUD cost: A$1,902.46, Current CMC USD price: US$14.6500, Current AUD market value: A$1,793.95, Current loss: -A$108.51 (-5.70%). NOTE: CMC displays AUD cost with USD market price.',
    broker: 'CMC Invest',
    importFingerprint: 'cmc_real_wulf_88',
    sourceStorage: 'CMC Markets real holding',
  },
];

async function addHoldings() {
  try {
    // Read existing store
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const store = JSON.parse(raw);

    // Check for duplicates by importFingerprint and symbol+price+quantity
    const existingFingerprints = new Set(
      (store.longTermHoldings || []).map(h => h?.importFingerprint).filter(Boolean)
    );
    const existingSymbols = new Set(
      (store.longTermHoldings || []).map(h => `${h?.symbol}_${h?.purchasePrice}_${h?.quantity}`).filter(Boolean)
    );
    
    const duplicates = CMC_HOLDINGS.filter(h => 
      existingFingerprints.has(h.importFingerprint) || 
      existingSymbols.has(`${h.symbol}_${h.purchasePrice}_${h.quantity}`)
    );
    if (duplicates.length > 0) {
      console.error('✗ Duplicate holdings found:');
      duplicates.forEach(d => console.error(`  - ${d.symbol}`));
      process.exit(1);
    }

    // Add holdings with stable IDs
    const now = new Date().toISOString();
    CMC_HOLDINGS.forEach(holding => {
      const record = {
        id: `lt_${holding.symbol}_${holding.purchasePrice}_${holding.quantity}`,
        kind: 'long-term',
        ...holding,
        createdAt: now,
        updatedAt: now,
      };
      store.longTermHoldings.push(record);
    });

    // Update store timestamp
    store.updatedAt = now;

    // Write back with proper formatting (2-space indent)
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));

    console.log('✓ Successfully added 3 CMC holdings to Freedom');
    console.log('');
    console.log('Holdings added:');
    CMC_HOLDINGS.forEach(h => {
      const invested = (h.purchasePrice * h.quantity).toFixed(2);
      console.log(`  ✓ ${h.symbol}: ${h.quantity} @ A$${h.purchasePrice} = A$${invested} (${h.currency})`);
    });
    console.log('');
    console.log('Storage location: ' + STORE_PATH);
    console.log('Total holdings: ' + store.longTermHoldings.length);

    // Verify totals from CMC
    const cbaInvested = 159.174 * 45;
    const jbluInvested = 7.016 * 240;
    const wulfInvested = 21.619 * 88;
    const totalCost = cbaInvested + jbluInvested + wulfInvested;
    
    console.log('');
    console.log('CMC Snapshot Reconciliation:');
    console.log(`  CBA cost:  A$${cbaInvested.toFixed(2)}`);
    console.log(`  JBLU cost: A$${jbluInvested.toFixed(2)}`);
    console.log(`  WULF cost: A$${wulfInvested.toFixed(2)}`);
    console.log(`  Total:     A$${totalCost.toFixed(2)} (expected: A$10,749.25)`);
    
    if (Math.abs(totalCost - 10749.25) < 0.01) {
      console.log('  ✓ Cost basis reconciles with CMC');
    } else {
      console.log('  ⚠ Cost basis mismatch!');
    }

  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

addHoldings();
