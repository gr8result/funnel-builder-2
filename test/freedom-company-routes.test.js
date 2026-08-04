import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  canonicalCompanyTicker,
  investmentCompanyHref,
  isValidCompanyTicker,
  traderCompanyHref,
} from "../lib/freedom/companyRoutes.js";

const requiredCompanyRoutes = [
  "/freedom/company/MSFT",
  "/freedom/company/AAPL",
  "/freedom/company/AVGO",
  "/freedom/company/CBA",
  "/freedom/company/msft",
  "/freedom-trader/company/MSFT",
  "/freedom-trader/company/AVGO",
];

test("authoritative company route files exist in the Pages Router", () => {
  assert.equal(fs.existsSync("pages/freedom/company/[symbol].js"), true);
  assert.equal(fs.existsSync("pages/freedom-trader/company/[symbol].js"), true);
});

test("company tickers are normalized without dropping ASX suffixes", () => {
  assert.equal(canonicalCompanyTicker("msft"), "MSFT");
  assert.equal(canonicalCompanyTicker(" CBA.AX "), "CBA.AX");
  assert.equal(canonicalCompanyTicker("CBA"), "CBA.AX");
  assert.equal(canonicalCompanyTicker("BHP"), "BHP.AX");
  assert.equal(canonicalCompanyTicker("CSL"), "CSL.AX");
});

test("supported company route examples resolve to valid route-shaped hrefs", () => {
  for (const route of requiredCompanyRoutes) {
    const ticker = route.split("/").pop();
    assert.equal(isValidCompanyTicker(ticker), true);
  }

  assert.equal(investmentCompanyHref("MSFT"), "/freedom/company/MSFT");
  assert.equal(investmentCompanyHref("msft"), "/freedom/company/MSFT");
  assert.equal(investmentCompanyHref("CBA"), "/freedom/company/CBA.AX");
  assert.equal(traderCompanyHref("AVGO"), "/freedom-trader/company/AVGO");
  assert.equal(traderCompanyHref("CBA", "from=scanner"), "/freedom-trader/company/CBA.AX?from=scanner");
});
