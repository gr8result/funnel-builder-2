#!/usr/bin/env node
/**
 * Migrate existing holdings to include targetPrice and safetyExit fields
 */

const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(process.cwd(), 'tmp', 'freedom-trades.json');

try {
  const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  
  // Migrate each holding to add missing fields
  let migrated = 0;
  data.longTermHoldings = data.longTermHoldings.map(holding => {
    if (!holding.hasOwnProperty('targetPrice')) {
      holding.targetPrice = null;
      migrated++;
    }
    if (!holding.hasOwnProperty('safetyExit')) {
      holding.safetyExit = null;
      migrated++;
    }
    return holding;
  });
  
  if (migrated > 0) {
    data.updatedAt = new Date().toISOString();
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
    console.log(`✓ Migrated ${data.longTermHoldings.length} holdings to include new fields`);
  } else {
    console.log('✓ All holdings already have new fields');
  }
  
  // Verify
  const holdings = data.longTermHoldings;
  const allHaveFields = holdings.every(h => 
    h.hasOwnProperty('targetPrice') && h.hasOwnProperty('safetyExit')
  );
  
  console.log(`✓ Migration verification: ${allHaveFields ? 'PASS' : 'FAIL'}`);
  
  const cmcHoldings = holdings.filter(h => h.broker === 'CMC Invest');
  console.log(`\nCMC Holdings Updated: ${cmcHoldings.length}`);
  cmcHoldings.forEach(h => {
    console.log(`  ✓ ${h.symbol}: targetPrice=${h.targetPrice}, safetyExit=${h.safetyExit}`);
  });
  
} catch (error) {
  console.error('✗ Migration failed:', error.message);
  process.exit(1);
}
