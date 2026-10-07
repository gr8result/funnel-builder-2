import { withFreedomApi } from "../../../platform-core/api-guards/freedomApiGuard.js";

import { fetchInvestmentCompanyData, providerCapability } from "../../../lib/freedom-investment/provider.js";
import { analyseInvestmentCandidate, prepareInvestment, rankInvestmentOpportunities } from "../../../lib/freedom-investment/scoring.js";
import { resolveInvestmentUniverse, supportedInvestmentUniverse } from "../../../lib/freedom-investment/universe.js";

function parseBody(req) {
  return req.method === "GET" ? req.query || {} : req.body || {};
}

function parseLimit(value, fallback = 10) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.min(Math.floor(number), 20) : fallback;
}

async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const startedAt = new Date().toISOString();
  const body = parseBody(req);
  const limit = parseLimit(body.limit, body.symbols ? 20 : 10);
  const universe = resolveInvestmentUniverse(body).slice(0, limit);
  const settled = await Promise.allSettled(universe.map(fetchInvestmentCompanyData));
  const analysed = settled.map((result, index) => {
    const source = result.status === "fulfilled"
      ? result.value
      : {
          ...universe[index],
          quote: {},
          metrics: {},
          profile: {},
          warnings: [result.reason?.message || "Provider request failed."],
          sourceStatus: { profile: false, quote: false, fundamentals: false },
        };
    return {
      ...analyseInvestmentCandidate(source),
      sourceStatus: source.sourceStatus,
      warnings: source.warnings,
    };
  });
  const ranked = rankInvestmentOpportunities(analysed);
  const topTen = ranked.slice(0, 10);
  const attractive = ranked.filter((row) => row.status === "ATTRACTIVE");
  const statusCounts = {
    attractive: attractive.length,
    fairValue: ranked.filter((row) => row.status === "FAIR VALUE").length,
    watch: ranked.filter((row) => row.status === "WATCH").length,
    expensive: ranked.filter((row) => row.status === "EXPENSIVE").length,
    avoid: ranked.filter((row) => row.status === "AVOID").length,
    dataInsufficient: ranked.filter((row) => row.status === "DATA INSUFFICIENT").length,
  };
  const bestLongTermCandidate = attractive[0] || null;
  return res.status(200).json({
    ok: true,
    scanner: "Freedom Investment",
    scanSummary: {
      supportedUniverse: supportedInvestmentUniverse().length,
      requested: universe.length,
      successfullyAnalysed: ranked.filter((row) => row.status !== "DATA INSUFFICIENT").length,
      dataUnavailable: statusCounts.dataInsufficient,
      ...statusCounts,
      startedAt,
      completedAt: new Date().toISOString(),
    },
    topTen,
    attractive,
    watchlistCandidates: ranked.filter((row) => ["FAIR VALUE", "WATCH", "EXPENSIVE"].includes(row.status)).slice(0, 10),
    bestLongTermCandidate,
    preparedInvestment: bestLongTermCandidate ? prepareInvestment(bestLongTermCandidate, body.positionSettings || {}) : null,
    providerCapability: providerCapability(),
    error: null,
  });
}

// M2.1: authentication + freedom entitlement enforced before this handler.
export default withFreedomApi(handler);
