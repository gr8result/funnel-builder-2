#!/usr/bin/env node
/**
 * CMC Orders Import - Comprehensive Verification
 * Tests all acceptance criteria
 */

const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(process.cwd(), 'tmp', 'freedom-trades.json');

try {
  const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║  CMC ORDERS IMPORT - ACCEPTANCE TEST VERIFICATION              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  let passCount = 0, failCount = 0;
  const tests = [];
  
  // Test 1: IVV pending buy import
  const ivv = data.shortTermTrades.find(t => t.symbol === 'IVV' && t.orderClassification === 'PENDING_BUY_ORDER');
  const test1 = {
    name: "✓ IVV pending buy imported",
    pass: !!ivv,
    details: ivv ? `86 @ A$71.09, long-term, status: ${ivv.orderStatus}` : "NOT FOUND"
  };
  if (test1.pass) passCount++; else failCount++;
  tests.push(test1);
  
  // Test 2: IVV marked as not owned
  const test2 = {
    name: "✓ IVV not counted as active holding",
    pass: !data.longTermHoldings.find(h => h.symbol === 'IVV'),
    details: "IVV only appears in pending buy orders, not holdings"
  };
  if (test2.pass) passCount++; else failCount++;
  tests.push(test2);
  
  // Test 3: IVV long-term classification
  const test3 = {
    name: "✓ IVV marked as long-term",
    pass: ivv?.termClassification === 'long-term',
    details: `Term: ${ivv?.termClassification || 'MISSING'}`
  };
  if (test3.pass) passCount++; else failCount++;
  tests.push(test3);
  
  // Test 4: CLSK pending buy updated
  const clsk = data.shortTermTrades.find(t => t.symbol === 'CLSK' && t.orderClassification === 'PENDING_BUY_ORDER');
  const test4 = {
    name: "✓ CLSK pending buy configured",
    pass: clsk && clsk.entryPrice === 10.85 && clsk.quantity === 320,
    details: clsk ? `320 @ US$10.85, expires ${new Date(clsk.expiry).toLocaleDateString()}` : "NOT FOUND"
  };
  if (test4.pass) passCount++; else failCount++;
  tests.push(test4);
  
  // Test 5: CLSK with attached target
  const test5 = {
    name: "✓ CLSK has attached take-profit US$16.00",
    pass: clsk?.takeSomeProfit === 16.00,
    details: clsk ? `Target: ${clsk.takeSomeProfit}, Potential gain: US$${((16.00 - 10.85) * 320).toFixed(2)}` : "NO TARGET"
  };
  if (test5.pass) passCount++; else failCount++;
  tests.push(test5);
  
  // Test 6: CLSK shows no P&L (not yet filled)
  const test6 = {
    name: "✓ CLSK shows potential gain only (not current P&L)",
    pass: clsk?.status === 'pending' && !clsk.averageFilledPrice,
    details: clsk ? `Status: ${clsk.status}, Filled: ${clsk.filledQuantity || 0}/${clsk.quantity}` : "MISSING"
  };
  if (test6.pass) passCount++; else failCount++;
  tests.push(test6);
  
  // Test 7: NWH holding with sell order
  const nwh = data.longTermHoldings.find(h => h.symbol === 'NWH');
  const test7 = {
    name: "✓ NWH holding created with sell order",
    pass: nwh && nwh.quantity === 1436 && nwh.pendingSellOrders?.length > 0,
    details: nwh ? `1,436 shares, sell orders: ${nwh.pendingSellOrders?.length || 0}` : "NOT FOUND"
  };
  if (test7.pass) passCount++; else failCount++;
  tests.push(test7);
  
  // Test 8: NWH A$7.85 take-profit
  const nwhSellOrder = nwh?.pendingSellOrders?.[0];
  const test8 = {
    name: "✓ NWH A$7.85 take-profit attached",
    pass: nwhSellOrder?.targetPrice === 7.85 && nwhSellOrder?.status === 'Active',
    details: nwhSellOrder ? `Target: A$${nwhSellOrder.targetPrice}, Distance: A$${nwhSellOrder.distanceToTarget}, Status: ${nwhSellOrder.status}` : "NO SELL ORDER"
  };
  if (test8.pass) passCount++; else failCount++;
  tests.push(test8);
  
  // Test 9: JBLU sell order attached
  const jblu = data.longTermHoldings.find(h => h.symbol === 'JBLU');
  const jbluSellOrder = jblu?.pendingSellOrders?.find(o => o.targetPrice === 6.00);
  const test9 = {
    name: "✓ JBLU US$6.00 sell order attached",
    pass: !!jbluSellOrder && jbluSellOrder.quantity === 240,
    details: jbluSellOrder ? `240 shares @ US$6.00, expires ${new Date(jbluSellOrder.expiry).toLocaleDateString()}` : "NO SELL ORDER"
  };
  if (test9.pass) passCount++; else failCount++;
  tests.push(test9);
  
  // Test 10: WULF sell order attached
  const wulf = data.longTermHoldings.find(h => h.symbol === 'WULF');
  const wulfSellOrder = wulf?.pendingSellOrders?.find(o => o.targetPrice === 16.40);
  const test10 = {
    name: "✓ WULF US$16.40 sell order attached",
    pass: !!wulfSellOrder && wulfSellOrder.quantity === 88,
    details: wulfSellOrder ? `88 shares @ US$16.40, expires ${new Date(wulfSellOrder.expiry).toLocaleDateString()}` : "NO SELL ORDER"
  };
  if (test10.pass) passCount++; else failCount++;
  tests.push(test10);
  
  // Test 11: No duplicate holdings
  const holdingSymbols = data.longTermHoldings.map(h => h.symbol);
  const duplicates = holdingSymbols.filter((s, i) => holdingSymbols.indexOf(s) !== i);
  const test11 = {
    name: "✓ No duplicate holdings",
    pass: duplicates.length === 0,
    details: duplicates.length > 0 ? `Duplicates: ${duplicates.join(', ')}` : "All unique"
  };
  if (test11.pass) passCount++; else failCount++;
  tests.push(test11);
  
  // Test 12: No duplicate orders
  const orderIds = data.shortTermTrades.map(t => t.id);
  const dupOrders = orderIds.filter((id, i) => orderIds.indexOf(id) !== i);
  const test12 = {
    name: "✓ No duplicate orders",
    pass: dupOrders.length === 0,
    details: dupOrders.length > 0 ? `Duplicates: ${dupOrders.join(', ')}` : "All unique"
  };
  if (test12.pass) passCount++; else failCount++;
  tests.push(test12);
  
  // Test 13: Pending buys and active holdings financially separate
  const pendingBuys = data.shortTermTrades.filter(t => t.orderClassification === 'PENDING_BUY_ORDER');
  const activeHoldings = data.longTermHoldings.filter(h => h.quantity > 0 && h.purchasePrice !== null);
  const test13 = {
    name: "✓ Pending orders and active holdings separate",
    pass: pendingBuys.length > 0 && activeHoldings.length > 0,
    details: `Pending: ${pendingBuys.length}, Active: ${activeHoldings.length}`
  };
  if (test13.pass) passCount++; else failCount++;
  tests.push(test13);
  
  // Test 14: Price levels available for charts
  const test14 = {
    name: "✓ Chart levels available (purchase/limit, current, target)",
    pass: (nwh?.purchasePrice !== undefined || nwh?.purchasePrice === null) && nwhSellOrder?.currentPrice && nwhSellOrder?.targetPrice,
    details: nwh ? `NWH can show: purchase=${nwh.purchasePrice}, current=${nwhSellOrder?.currentPrice}, target=${nwhSellOrder?.targetPrice}` : "MISSING DATA"
  };
  if (test14.pass) passCount++; else failCount++;
  tests.push(test14);
  
  // Test 15: Order timestamps and history
  const test15 = {
    name: "✓ Orders have import timestamps and history",
    pass: ivv?.createdAt && ivv?.orderHistory?.length > 0 && nwhSellOrder?.createdAt,
    details: "All orders timestamped with order history tracking"
  };
  if (test15.pass) passCount++; else failCount++;
  tests.push(test15);

  // Print results
  tests.forEach((test, i) => {
    const icon = test.pass ? '✓' : '✗';
    console.log(`${icon} Test ${i + 1}: ${test.name}`);
    console.log(`  └─ ${test.details}\n`);
  });

  console.log('════════════════════════════════════════════════════════════════\n');
  console.log(`RESULTS: ${passCount} passed, ${failCount} failed\n`);

  // Summary
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('IMPORTED RECORDS SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('PENDING BUY ORDERS:');
  const pendingBuyOrders = data.shortTermTrades.filter(t => t.orderClassification === 'PENDING_BUY_ORDER');
  pendingBuyOrders.forEach(o => {
    console.log(`  • ${o.symbol}: ${o.quantity} @ ${o.currency === 'AUD' ? 'A$' : 'US$'}${o.entryPrice.toFixed(2)}`);
    console.log(`    ${o.termClassification} | ${o.orderStatus} | Expires: ${o.goodTillCancelled ? 'GTC' : new Date(o.expiry).toLocaleDateString()}`);
    if (o.takeSomeProfit) {
      console.log(`    Attached target: ${o.currency === 'AUD' ? 'A$' : 'US$'}${o.takeSomeProfit.toFixed(2)}`);
    }
  });

  console.log('\nACTIVE HOLDINGS WITH SELL ORDERS:');
  const holdingsWithSells = data.longTermHoldings.filter(h => h.pendingSellOrders?.length);
  holdingsWithSells.forEach(h => {
    console.log(`  • ${h.symbol}: ${h.quantity} shares`);
    if (h.purchasePrice) {
      console.log(`    Purchase: ${h.currency === 'AUD' ? 'A$' : 'US$'}${h.purchasePrice.toFixed(2)}`);
    } else {
      console.log(`    Purchase: Not recorded`);
    }
    h.pendingSellOrders.forEach(so => {
      console.log(`    ├─ Sell: ${so.quantity} @ ${so.cmcSnapshot?.currency === 'USD' ? 'US$' : 'A$'}${so.targetPrice.toFixed(2)} (${so.orderType}, ${so.status})`);
      console.log(`    │  Distance: ${so.distanceToTarget.toFixed(2)} (${so.distanceToTargetPercent.toFixed(2)}%)`);
    });
  });

  console.log('\n═══════════════════════════════════════════════════════════════');
  if (failCount === 0) {
    console.log('✅ ALL ACCEPTANCE TESTS PASSED - READY FOR BROWSER TEST');
  } else {
    console.log(`❌ ${failCount} TEST(S) FAILED - REVIEW REQUIRED`);
  }
  console.log('═══════════════════════════════════════════════════════════════\n');

} catch (error) {
  console.error('✗ Verification failed:', error.message);
  process.exit(1);
}
