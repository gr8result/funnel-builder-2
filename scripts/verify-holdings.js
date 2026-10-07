const fs = require('fs');
const data = JSON.parse(fs.readFileSync('tmp/freedom-trades.json', 'utf8'));
console.log('shortTermTrades:', data.shortTermTrades.length);
console.log('longTermHoldings:', data.longTermHoldings.length);
if (data.longTermHoldings.length > 0) {
  console.log('\nHoldings:');
  data.longTermHoldings.forEach(h => {
    console.log(`- ${h.symbol} (${h.exchange}/${h.currency}) - ${h.quantity} @ A$${h.purchasePrice} - Broker: ${h.broker}`);
  });
}
