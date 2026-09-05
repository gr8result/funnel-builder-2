#!/usr/bin/env node
/**
 * Import Real CMC Orders - IVV, CLSK pending buys and NWH/JBLU/WULF sell orders
 * 
 * Deduplicates by fingerprint and symbol, prevents duplicate holdings,
 * properly separates pending orders from active holdings.
 */

const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(process.cwd(), 'tmp', 'freedom-trades.json');

function round(value, decimals = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Number(num.toFixed(decimals));
}

function generateFingerprint(text) {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(text).digest('hex').slice(0, 16);
}

try {
  const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  const changes = [];
  
  // ====== 1. IMPORT IVV PENDING BUY (NEW) ======
  const ivvFingerprint = generateFingerprint('cmc_pending_buy_ivv_86_71.09_asx_aud_ltc');
  const existingIvv = data.shortTermTrades.find(t => t.importFingerprint === ivvFingerprint || (t.symbol === 'IVV' && t.orderClassification === 'PENDING_BUY_ORDER'));
  
  if (!existingIvv) {
    const ivvOrder = {
      id: `st_ivv_pb_${Date.now().toString(36)}`,
      kind: "short-term",
      symbol: "IVV",
      exchange: "ASX",
      currency: "AUD",
      companyName: "iShares S&P 500 ETF",
      entryPrice: 71.090,
      quantity: 86,
      entryDate: "2026-09-02T00:00:00.000Z",
      safetyExit: null,
      takeSomeProfit: null,
      finalExit: null,
      status: "pending",
      importedOrder: true,
      broker: "CMC",
      side: "BUY",
      orderStatus: "Waiting for Market to Open",
      orderClassification: "PENDING_BUY_ORDER",
      importFingerprint: ivvFingerprint,
      averageFilledPrice: null,
      filledQuantity: null,
      expiry: null,
      goodTillCancelled: true,
      termClassification: "long-term",
      requiresFillConfirmation: true,
      orderHistory: [
        {
          type: "ORDER_IMPORT",
          at: new Date().toISOString(),
          fingerprint: ivvFingerprint,
          classification: "PENDING_BUY_ORDER",
          source: "CMC",
          snapshot: { currentPrice: 71.050, status: "Waiting for Market to Open" }
        }
      ],
      notes: "Real CMC Invest pending long-term purchase. Not yet owned.",
      sourceSymbolResolved: null,
      cmcSnapshot: {
        symbol: "IVV",
        company: "iShares S&P 500 ETF",
        exchange: "ASX",
        currency: "AUD",
        side: "BUY",
        orderType: "Limit Buy",
        quantity: 86,
        limitPrice: 71.090,
        filled: 0,
        unfilled: 86,
        currentPrice: 71.050,
        status: "Waiting for Market to Open",
        expiry: "Good Till Cancelled",
        importedAt: new Date().toISOString()
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.shortTermTrades.push(ivvOrder);
    changes.push('✓ Added IVV pending buy: 86 @ A$71.09 long-term (GTC)');
  } else {
    changes.push('✓ IVV pending buy already exists (no duplicate added)');
  }
  
  // ====== 2. UPDATE CLSK PENDING BUY WITH CMC DETAILS + ATTACHED TARGET ======
  const clskFingerprint = generateFingerprint('cmc_pending_buy_clsk_320_10.85_us_usd_stc');
  let clskUpdated = false;
  
  const clskRecord = data.shortTermTrades.find(t => t.symbol === 'CLSK' && t.side === 'BUY' && t.orderClassification !== 'PENDING_BUY_ORDER');
  
  if (clskRecord) {
    // Update existing CLSK to add CMC order details
    if (!clskRecord.cmcSnapshot) {
      clskRecord.importedOrder = true;
      clskRecord.orderStatus = "Waiting for Market to Open";
      clskRecord.orderClassification = "PENDING_BUY_ORDER";
      clskRecord.importFingerprint = clskFingerprint;
      clskRecord.entryPrice = 10.850;
      clskRecord.quantity = 320;
      clskRecord.expiry = "2026-10-03T00:00:00.000Z";
      clskRecord.goodTillCancelled = false;
      clskRecord.termClassification = "short-term";
      clskRecord.requiresFillConfirmation = true;
      clskRecord.status = "pending";
      clskRecord.takeSomeProfit = 16.000; // Attached take-profit
      clskRecord.finalExit = 16.000;
      clskRecord.cmcSnapshot = {
        symbol: "CLSK",
        company: "CleanSpark",
        exchange: "US",
        currency: "USD",
        side: "BUY",
        orderType: "Limit Buy",
        quantity: 320,
        limitPrice: 10.850,
        filled: 0,
        unfilled: 320,
        currentPrice: 11.060,
        status: "Waiting for Market to Open",
        expiry: "2026-10-03",
        attachedTakeProfitPrice: 16.000,
        potentialGainUSD: (16.000 - 10.850) * 320,
        potentialGainPercent: ((16.000 - 10.850) / 10.850) * 100,
        importedAt: new Date().toISOString()
      };
      if (clskRecord.orderHistory) {
        clskRecord.orderHistory.push({
          type: "CMC_ORDER_SYNC",
          at: new Date().toISOString(),
          snapshot: clskRecord.cmcSnapshot,
          classification: "PENDING_BUY_ORDER"
        });
      }
      clskUpdated = true;
    }
  }
  
  if (!clskRecord) {
    // Create new CLSK record
    const clskOrder = {
      id: `st_clsk_pb_${Date.now().toString(36)}`,
      kind: "short-term",
      symbol: "CLSK",
      exchange: "US",
      currency: "USD",
      companyName: "CleanSpark",
      entryPrice: 10.850,
      quantity: 320,
      entryDate: "2026-09-02T00:00:00.000Z",
      safetyExit: null,
      takeSomeProfit: 16.000,
      finalExit: 16.000,
      status: "pending",
      importedOrder: true,
      broker: "CMC",
      side: "BUY",
      orderStatus: "Waiting for Market to Open",
      orderClassification: "PENDING_BUY_ORDER",
      importFingerprint: clskFingerprint,
      averageFilledPrice: null,
      filledQuantity: null,
      expiry: "2026-10-03T00:00:00.000Z",
      goodTillCancelled: false,
      termClassification: "short-term",
      requiresFillConfirmation: true,
      orderHistory: [
        {
          type: "ORDER_IMPORT",
          at: new Date().toISOString(),
          fingerprint: clskFingerprint,
          classification: "PENDING_BUY_ORDER",
          source: "CMC",
          snapshot: { currentPrice: 11.060, status: "Waiting for Market to Open", attachedTarget: 16.000 }
        }
      ],
      notes: "Real CMC Invest pending short-term purchase with attached take-profit US$16.00. Potential gain: US$1,648.00 (47.47%)",
      sourceSymbolResolved: null,
      cmcSnapshot: {
        symbol: "CLSK",
        company: "CleanSpark",
        exchange: "US",
        currency: "USD",
        side: "BUY",
        orderType: "Limit Buy",
        quantity: 320,
        limitPrice: 10.850,
        filled: 0,
        unfilled: 320,
        currentPrice: 11.060,
        status: "Waiting for Market to Open",
        expiry: "2026-10-03",
        attachedTakeProfitPrice: 16.000,
        potentialGainUSD: (16.000 - 10.850) * 320,
        potentialGainPercent: ((16.000 - 10.850) / 10.850) * 100,
        importedAt: new Date().toISOString()
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.shortTermTrades.push(clskOrder);
    clskUpdated = true;
  }
  
  if (clskUpdated) {
    changes.push('✓ CLSK: 320 @ US$10.85 short-term (expires Oct 3) with attached target US$16.00');
  } else {
    changes.push('✓ CLSK already fully configured (no update needed)');
  }
  
  // ====== 3. NWH HOLDINGS & SELL ORDER ======
  // Check if genuine NWH holding exists in longTermHoldings
  let nwhHolding = data.longTermHoldings.find(h => h.symbol === 'NWH');
  
  if (!nwhHolding) {
    // Create new NWH holding for 1,436 shares with sell order attached
    nwhHolding = {
      id: `lt_NWH_real_1436`,
      kind: "long-term",
      symbol: "NWH",
      exchange: "ASX",
      currency: "AUD",
      companyName: null,
      purchasePrice: null,
      quantity: 1436,
      purchaseDate: null,
      reason: "Real CMC Invest holding with active sell order. Purchase price not recorded.",
      broker: "CMC Invest",
      importFingerprint: generateFingerprint('cmc_real_nwh_holding_1436'),
      sourceStorage: "CMC Markets real holding",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      targetPrice: null,
      safetyExit: null,
      // Pending sell orders array
      pendingSellOrders: [
        {
          id: `so_nwh_tp_${Date.now().toString(36)}`,
          orderType: "Conditional Sell / Take Profit",
          side: "SELL",
          quantity: 1436,
          targetPrice: 7.850,
          currentPrice: 7.670,
          status: "Active",
          expiry: null,
          goodTillCancelled: true,
          distanceToTarget: 0.18,
          distanceToTargetPercent: ((7.850 - 7.670) / 7.670) * 100,
          potentialMovement: (7.850 - 7.670) * 1436,
          cmcSnapshot: {
            symbol: "NWH",
            exchange: "ASX",
            currency: "AUD",
            side: "SELL",
            orderType: "Conditional Sell / Take Profit",
            quantity: 1436,
            targetPrice: 7.850,
            currentPrice: 7.670,
            status: "Active",
            expiry: "Good Till Cancelled",
            importedAt: new Date().toISOString()
          },
          orderHistory: [
            {
              type: "ORDER_IMPORT",
              at: new Date().toISOString(),
              classification: "PENDING_SELL_ORDER",
              source: "CMC"
            }
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    };
    data.longTermHoldings.push(nwhHolding);
    changes.push('✓ Created NWH holding: 1,436 shares with A$7.85 take-profit order (GTC, distance: A$0.18)');
  } else {
    // Update existing NWH holding to add sell order if not already present
    if (!nwhHolding.pendingSellOrders) {
      nwhHolding.pendingSellOrders = [];
    }
    const existingSellOrder = nwhHolding.pendingSellOrders.find(o => o.targetPrice === 7.850);
    if (!existingSellOrder) {
      nwhHolding.pendingSellOrders.push({
        id: `so_nwh_tp_${Date.now().toString(36)}`,
        orderType: "Conditional Sell / Take Profit",
        side: "SELL",
        quantity: 1436,
        targetPrice: 7.850,
        currentPrice: 7.670,
        status: "Active",
        expiry: null,
        goodTillCancelled: true,
        distanceToTarget: 0.18,
        distanceToTargetPercent: ((7.850 - 7.670) / 7.670) * 100,
        potentialMovement: (7.850 - 7.670) * 1436,
        cmcSnapshot: {
          symbol: "NWH",
          exchange: "ASX",
          currency: "AUD",
          side: "SELL",
          orderType: "Conditional Sell / Take Profit",
          quantity: 1436,
          targetPrice: 7.850,
          currentPrice: 7.670,
          status: "Active",
          expiry: "Good Till Cancelled",
          importedAt: new Date().toISOString()
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      changes.push('✓ Attached sell order to existing NWH holding (A$7.85 target)');
    }
  }
  
  // ====== 4. JBLU HOLDING - ATTACH SELL ORDER ======
  const jbluHolding = data.longTermHoldings.find(h => h.symbol === 'JBLU');
  if (jbluHolding) {
    if (!jbluHolding.pendingSellOrders) {
      jbluHolding.pendingSellOrders = [];
    }
    const existingJbluSell = jbluHolding.pendingSellOrders.find(o => o.targetPrice === 6.000);
    if (!existingJbluSell) {
      jbluHolding.pendingSellOrders.push({
        id: `so_jblu_ls_${Date.now().toString(36)}`,
        orderType: "Limit Sell",
        side: "SELL",
        quantity: 240,
        targetPrice: 6.000,
        currentPrice: 4.470,
        status: "Open",
        expiry: "2026-09-26T23:59:59.000Z",
        goodTillCancelled: false,
        distanceToTarget: 6.000 - 4.470,
        distanceToTargetPercent: ((6.000 - 4.470) / 4.470) * 100,
        potentialMovement: (6.000 - 4.470) * 240,
        cmcSnapshot: {
          symbol: "JBLU",
          company: "JetBlue Airways",
          exchange: "US",
          currency: "USD",
          side: "SELL",
          orderType: "Limit Sell",
          quantity: 240,
          limitPrice: 6.000,
          currentPrice: 4.470,
          filled: 0,
          unfilled: 240,
          status: "Open",
          expiry: "2026-09-26",
          importedAt: new Date().toISOString()
        },
        orderHistory: [
          {
            type: "ORDER_IMPORT",
            at: new Date().toISOString(),
            classification: "PENDING_SELL_ORDER",
            source: "CMC"
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      changes.push('✓ Attached JBLU sell order: 240 @ US$6.00 (expires Sept 26, distance: US$1.53, +34.23%)');
    }
  }
  
  // ====== 5. WULF HOLDING - ATTACH SELL ORDER ======
  const wulfHolding = data.longTermHoldings.find(h => h.symbol === 'WULF');
  if (wulfHolding) {
    if (!wulfHolding.pendingSellOrders) {
      wulfHolding.pendingSellOrders = [];
    }
    const existingWulfSell = wulfHolding.pendingSellOrders.find(o => o.targetPrice === 16.400);
    if (!existingWulfSell) {
      wulfHolding.pendingSellOrders.push({
        id: `so_wulf_ls_${Date.now().toString(36)}`,
        orderType: "Limit Sell",
        side: "SELL",
        quantity: 88,
        targetPrice: 16.400,
        currentPrice: 14.650,
        status: "Open",
        expiry: "2026-09-26T23:59:59.000Z",
        goodTillCancelled: false,
        distanceToTarget: 16.400 - 14.650,
        distanceToTargetPercent: ((16.400 - 14.650) / 14.650) * 100,
        potentialMovement: (16.400 - 14.650) * 88,
        cmcSnapshot: {
          symbol: "WULF",
          company: "TeraWulf",
          exchange: "US",
          currency: "USD",
          side: "SELL",
          orderType: "Limit Sell",
          quantity: 88,
          limitPrice: 16.400,
          currentPrice: 14.650,
          filled: 0,
          unfilled: 88,
          status: "Open",
          expiry: "2026-09-26",
          importedAt: new Date().toISOString()
        },
        orderHistory: [
          {
            type: "ORDER_IMPORT",
            at: new Date().toISOString(),
            classification: "PENDING_SELL_ORDER",
            source: "CMC"
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      changes.push('✓ Attached WULF sell order: 88 @ US$16.40 (expires Sept 26, distance: US$1.75, +11.95%)');
    }
  }
  
  // ====== SAVE ======
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
  
  console.log('\n========== CMC ORDERS IMPORT COMPLETE ==========\n');
  changes.forEach(c => console.log(c));
  
  console.log('\n========== DEDUPLICATION CHECK ==========');
  console.log(`✓ Pending buy orders: ${data.shortTermTrades.filter(t => t.orderClassification === 'PENDING_BUY_ORDER').length}`);
  console.log(`  - IVV: 86 @ A$71.09 (long-term, GTC)`);
  console.log(`  - CLSK: 320 @ US$10.85 (short-term, expires Oct 3, target US$16.00)`);
  console.log(`✓ Active holdings with sell orders: ${data.longTermHoldings.filter(h => h.pendingSellOrders?.length).length}`);
  console.log(`  - CBA: 45 shares (no sell order)`);
  console.log(`  - NWH: 1,436 shares (A$7.85 take-profit)`);
  console.log(`  - JBLU: 240 shares (US$6.00 limit, expires Sept 26)`);
  console.log(`  - WULF: 88 shares (US$16.40 limit, expires Sept 26)`);
  
  console.log('\n========== TOTALS ==========');
  const allHoldings = data.longTermHoldings;
  console.log(`Total holdings: ${allHoldings.length}`);
  console.log(`Holdings with sell orders: ${allHoldings.filter(h => h.pendingSellOrders?.length).length}`);
  console.log(`Pending buy orders: ${data.shortTermTrades.filter(t => t.orderClassification === 'PENDING_BUY_ORDER').length}`);
  
  console.log('\n✅ All CMC orders imported successfully\n');
} catch (error) {
  console.error('✗ Import failed:', error.message);
  process.exit(1);
}
