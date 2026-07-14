import dotenv from "dotenv";
import { importCompany } from "../lib/freedom-terminal/importEngine.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

const INITIAL_TICKERS = ["MSFT", "NVDA", "V", "AMZN", "COST", "GOOGL", "AVGO", "MA", "ASML", "TSM"];

async function main() {
  const tickers = process.argv.slice(2).length ? process.argv.slice(2) : INITIAL_TICKERS;

  for (const ticker of tickers) {
    const result = await importCompany(ticker);
    const imported = result.imported || {};
    console.log(
      [
        `Imported ${result.company?.ticker || result.company?.symbol || ticker}`,
        `history=${imported.historicalPriceRows || 0}`,
        `competitors=${imported.competitors || 0}`,
        `estimates=${imported.analystEstimateRows || 0}`,
        `warnings=${result.warnings?.length || 0}`,
      ].join(" ")
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
