// /pages/api/dev/spreadsheet-data.js
import { supabase } from "../../../utils/supabase-client";

export default async function handler(req, res) {
  try {
    // helper
    const get = async (table, cols = "*") => {
      const { data, error } = await supabase.from(table).select(cols);
      if (error) {
        console.error(`❌ ${table} error:`, error.message);
        return [];
      }
      return data || [];
    };

    // fetch tables
    const accounts = await get("accounts", "*");
    const subscriptions = await get("subscriptions", "*");
    const payments = await get("payments", "*");
    const sessions = await get("sessions", "*");

    // find approved accounts (fallback logic)
    const approvedAccounts = accounts.filter(
      (a) =>
        a.is_approved === true ||
        a.approved === true ||
        a.status === "approved" ||
        a.status === "active"
    );

    const totalSubs = approvedAccounts.length;

    // active session count
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const activeNow = sessions.filter((s) => new Date(s.created_at) > dayAgo).length;

    // MRR
    const activeSubs = subscriptions.filter((s) =>
      approvedAccounts.map((a) => a.id || a.user_id).includes(s.account_id || s.user_id)
    );
    const totalMRR = activeSubs.reduce((sum, s) => sum + (s.price || 0), 0);
    const arpu = totalSubs ? totalMRR / totalSubs : 0;

    // signups
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const signups7d = approvedAccounts.filter(
      (a) => new Date(a.created_at) > weekAgo
    ).length;

    // module revenue
    const modules = {};
    activeSubs.forEach((s) => {
      const mod = s.module || "Unknown";
      if (!modules[mod]) modules[mod] = { name: mod, count: 0, mrr: 0 };
      modules[mod].count++;
      modules[mod].mrr += s.price || 0;
    });

    // monthly payments
    const months = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];
    const mrrSeries = months.map((m, i) => ({
      label: m,
      y: payments.reduce((sum, p) => sum + (p.amount || 0), 0) / 6,
    }));

    // 24h usage
    const usersSeries = Array.from({ length: 24 }, (_, h) => ({
      label: `${h}h`,
      y: sessions.filter((s) => new Date(s.created_at).getHours() === h).length,
    }));

    // subscriber list
    const grouped = {};
    activeSubs.forEach((s) => {
      const id = s.account_id || s.user_id;
      if (!grouped[id]) grouped[id] = [];
      grouped[id].push(s);
    });

    const subscribers = approvedAccounts.map((a) => {
      const id = a.id || a.user_id;
      const subs = grouped[id] || [];
      const total = subs.reduce((sum, s) => sum + (s.price || 0), 0);
      return {
        id,
        name: a.full_name || a.name || "—",
        email: a.email,
        company: a.business_name || a.company || "—",
        mrr: total,
        active: true,
        modules: subs.map((s) => ({
          name: s.module,
          price: s.price,
        })),
      };
    });

    return res.status(200).json({
      totals: {
        totalSubs,
        activeNow,
        mrr: totalMRR,
        arpu,
        signups7d,
        churn: 0,
      },
      revenueByModule: Object.values(modules),
      mrrSeries,
      usersSeries,
      subscribers,
    });
  } catch (err) {
    console.error("❌ Dashboard API failed:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
