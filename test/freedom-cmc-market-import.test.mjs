import assert from "node:assert/strict";
import test from "node:test";

import { extractCmcMarketCandidates } from "../lib/freedom/cmcMarketImport.js";

test("CMC Market Summary rows extract ASX candidates without making recommendations", () => {
  const fixture = `
CMC Invest Australian Market Summary
As at 28 Aug 11:59AM
Code Company Last +/- % Value News
RHC Ramsay Health Care 50.800 +0.740 1.48 124,491,324
CBA Commonwealth Bank 156.530 +1.570 1.01 92,679,477
AD8 Audinate Group 7.138 +2.54 64.41
ALK Alkane Resources 1.925 -0.909 -89.40
Morningstar undervalued and overvalued ratings are visible separately.
`;

  const result = extractCmcMarketCandidates({ sourceType: "text", text: fixture });

  assert.equal(result.ok, true);
  assert.equal(result.privacy.authenticatedCmcScraped, false);
  assert.equal(result.privacy.importedRowsAreCandidatesOnly, true);
  assert.ok(result.candidates.length >= 4);
  assert.equal(result.candidates.find((row) => row.symbol === "AD8").exchange, "ASX");
  assert.equal(result.candidates.find((row) => row.symbol === "AD8").currency, "AUD");
  assert.equal(result.candidates.find((row) => row.symbol === "ALK").cmcPrice, 1.925);
  assert.equal(result.candidates.some((row) => row.action === "BUY"), false);
});

test("CMC CSV exports extract code, company, price, move and volume", () => {
  const csv = `Code,Company,Last,Change,Percent,Volume,Rating
AD8,Audinate Group,7.138,2.54,64.41,2000000,Morningstar undervalued
ALK,Alkane Resources,1.925,-0.909,-89.40,3000000,theScreener downgrade`;

  const result = extractCmcMarketCandidates({ sourceType: "csv", csv });

  assert.deepEqual(result.candidates.map((row) => row.symbol), ["AD8", "ALK"]);
  assert.equal(result.candidates[0].companyName, "Audinate Group");
  assert.equal(result.candidates[0].importedRating, "Morningstar undervalued");
});
