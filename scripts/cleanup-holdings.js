const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(process.cwd(), 'tmp', 'freedom-trades.json');

try {
  const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  
  // Remove null entries from longTermHoldings
  const beforeCount = data.longTermHoldings.length;
  data.longTermHoldings = data.longTermHoldings.filter(h => h !== null);
  const afterCount = data.longTermHoldings.length;
  const nullRemoved = beforeCount - afterCount;
  
  if (nullRemoved > 0) {
    data.updatedAt = new Date().toISOString();
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
    console.log(`✓ Cleaned up ${nullRemoved} null entries from longTermHoldings`);
  }
  
  // Verify the holdings
  const cmcHoldings = data.longTermHoldings.filter(h => h.broker === 'CMC Invest');
  console.log(`\n✓ Active CMC Holdings: ${cmcHoldings.length}`);
  
  let totalCost = 0;
  cmcHoldings.forEach(h => {
    const cost = h.purchasePrice * h.quantity;
    totalCost += cost;
    console.log(`  • ${h.symbol}: ${h.quantity} @ A$${h.purchasePrice} (${h.exchange}/${h.currency}) = A$${cost.toFixed(2)}`);
  });
  
  console.log(`\nTotal Cost Basis: A$${totalCost.toFixed(2)}`);
  console.log(`CMC Snapshot Total: A$10,749.25`);
  console.log(`Difference: A$${Math.abs(totalCost - 10749.25).toFixed(2)}`);
  
  // Check for duplicates
  const symbols = new Set();
  const duplicates = cmcHoldings.filter(h => {
    if (symbols.has(h.symbol)) return true;
    symbols.add(h.symbol);
    return false;
  });
  
  if (duplicates.length === 0) {
    console.log('\n✓ No duplicate holdings found');
  } else {
    console.log('\n✗ Duplicates found:');
    duplicates.forEach(d => console.log(`  - ${d.symbol}`));
  }
  
  console.log(`\nStorage: ${STORE_PATH}`);
  console.log(`Total long-term holdings: ${data.longTermHoldings.length}`);
  
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
