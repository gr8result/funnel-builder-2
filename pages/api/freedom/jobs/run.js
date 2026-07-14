import { supabaseAdmin } from "../../../../lib/freedom-terminal/core";

const JOBS = {
  daily_update_prices: {
    cadence: "daily",
    description: "Refresh live prices from Finnhub.",
  },
  daily_update_valuation: {
    cadence: "daily",
    description: "Recalculate valuation models from stored assumptions and latest prices.",
  },
  daily_update_company_scores: {
    cadence: "daily",
    description: "Refresh company scores from stored financial, valuation, and research data.",
  },
  daily_update_committee_review: {
    cadence: "daily",
    description: "Refresh committee reviews from stored research data.",
  },
  weekly_update_financials: {
    cadence: "weekly",
    description: "Refresh yearly financial history.",
  },
  quarterly_update_earnings: {
    cadence: "quarterly",
    description: "Refresh earnings records and transcript analysis.",
  },
  nightly_watch_engine: {
    cadence: "daily",
    description: "Create alerts from prices, valuation targets, score changes, and committee changes.",
  },
};

async function markJob(jobName, status, lastError = null) {
  const job = JOBS[jobName];
  const { data, error } = await supabaseAdmin
    .from("background_jobs")
    .upsert(
      {
        job_name: jobName,
        cadence: job?.cadence || "manual",
        status,
        last_run_at: new Date().toISOString(),
        last_error: lastError,
      },
      { onConflict: "job_name" }
    )
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function runWatchEngine() {
  const { data: rows, error } = await supabaseAdmin
    .from("watchlist_items")
    .select("*, companies(id, ticker, company_name), live_prices(price), company_scores(overall_score), committee_reviews(final_recommendation)");

  if (error) throw error;

  const created = [];

  for (const item of rows || []) {
    const price = item.live_prices?.[0]?.price;
    if (Number.isFinite(Number(price)) && Number.isFinite(Number(item.target_buy)) && Number(price) < Number(item.target_buy)) {
      created.push({
        company_id: item.company_id,
        alert_type: "price_below_buy",
        priority: "normal",
        message: `${item.companies?.ticker} is below target buy price.`,
        trigger_payload: { price, target_buy: item.target_buy },
      });
    }

    if (Number.isFinite(Number(price)) && Number.isFinite(Number(item.strong_buy)) && Number(price) < Number(item.strong_buy)) {
      created.push({
        company_id: item.company_id,
        alert_type: "price_below_strong_buy",
        priority: "high",
        message: `${item.companies?.ticker} is below strong-buy price.`,
        trigger_payload: { price, strong_buy: item.strong_buy },
      });
    }
  }

  if (created.length) {
    const { error: insertError } = await supabaseAdmin.from("alerts").insert(created);
    if (insertError) throw insertError;
  }

  return { createdAlerts: created.length };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const jobName = String(req.body?.job || req.query.job || "").trim();
  if (!JOBS[jobName]) {
    return res.status(400).json({
      error: "Unknown job.",
      jobs: Object.keys(JOBS),
    });
  }

  try {
    let result = { status: "recorded", description: JOBS[jobName].description };
    if (jobName === "nightly_watch_engine") result = await runWatchEngine();

    const job = await markJob(jobName, "success");
    return res.status(200).json({ ok: true, job, result });
  } catch (error) {
    const job = await markJob(jobName, "failed", error.message || "Job failed.").catch(() => null);
    return res.status(500).json({
      ok: false,
      job,
      error: error.message || "Unable to run Freedom Terminal job.",
    });
  }
}
