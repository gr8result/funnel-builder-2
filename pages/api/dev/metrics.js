// pages/api/dev/metrics.js
// Lightweight metrics endpoint sharing the same detection logic as spreadsheet-data.
// Returns usersOnline, activeSubs, mrr, modules[], revenueSeries[].

import { createClient } from "@supabase/supabase-js";

function sb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function mock() {
  const now = new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const revenueSeries = Array.from({ length: 8 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (7 - i), 1);
    return { x: i, y: 1500 + i * 420, label: months[d.getMonth()] };
  });
  return {
    usersOnline: 7,
    activeSubs: 112,
    mrr: 112 * 29,
    modules: [
      { name: "Website builder", count: 68, mrr: 68 * 19 },
      { name: "Email marketing", count: 54, mrr: 54 * 29 },
      { name: "Funnels", count: 41, mrr: 41 * 15 },
    ],
    revenueSeries,
    _source: "mock",
  };
}

export default async function handler(_req, res) {
  try {
    const client = sb();
    if (!client) return res.status(200).json(mock());

    // Try subscriptions
    const subTables = ["subscription_items", "subscriptions"];
    let subs = null;
    for (const t of subTables) {
      // eslint-disable-next-line no-await-in-loop
      const { data, error } = await client.from(t).select("status, module, product, plan, price, amount").limit(5000);
      if (!error && data) { subs = data; break; }
    }
    if (!subs) return res.status(200).json(mock());

    const active = subs.filter((s) => String(s.status || "").toLowerCase() === "active" || s.status === true);
    const mrr = active.reduce((sum, s) => sum + Number(s.price || s.amount || 0), 0);

    const modulesMap = new Map();
    for (const s of active) {
      const name = s.module || s.product || s.plan || "Unknown";
      const price = Number(s.price || s.amount || 0);
      const cur = modulesMap.get(name) || { name, count: 0, mrr: 0 };
      cur.count += 1; cur.mrr += price;
      modulesMap.set(name, cur);
    }
    const modules = Array.from(modulesMap.values()).sort((a, b) => b.mrr - a.mrr);

    const revenueSeries = Array.from({ length: 8 }).map((_, i) => ({ x: i, y: Math.round(mrr * 0.5 + i * (mrr * 0.08)), label: "" }));

    return res.status(200).json({
      usersOnline: Math.max(1, Math.round(active.length * 0.1)),
      activeSubs: active.length,
      mrr,
      modules,
      revenueSeries,
      _source: "supabase",
    });
  } catch {
    return res.status(200).json(mock());
  }
}

