import { createSupabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { DEFAULT_STARTING_BALANCE, cleanNumber } from "../../../lib/freedom-trader/paperTrading.js";
import { updateLocalPaperSettings } from "../../../lib/freedom-trader/localPaperStore.js";
import { loadPaperAccount } from "./paper-account.js";
import { tradesToCsv } from "./paper-orders.js";

async function resetAccount(supabase, account, startingBalance) {
  await supabase.from("freedom_paper_orders").delete().eq("account_id", account.id);
  await supabase.from("freedom_paper_trades").delete().eq("account_id", account.id);
  await supabase.from("freedom_paper_positions").delete().eq("account_id", account.id);
  const balance = cleanNumber(startingBalance) || DEFAULT_STARTING_BALANCE;
  const { data, error } = await supabase
    .from("freedom_paper_accounts")
    .update({ starting_balance: balance, available_cash: balance, closed_profit_loss: 0, updated_at: new Date().toISOString() })
    .eq("id", account.id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export default async function handler(req, res) {
  try {
    const snapshot = await loadPaperAccount(req);
    const account = snapshot.account;
    const supabase = snapshot.storageMode === "local" ? null : createSupabaseAdmin();

    if (req.method === "GET") {
      if (req.query?.export === "csv") {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", "attachment; filename=freedom-paper-trades.csv");
        return res.status(200).send(tradesToCsv(snapshot.trades));
      }
      return res.status(200).json({ ok: true, account, error: null });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ ok: false, error: "Method not allowed." });
    }

    const action = String(req.body?.action || "");
    if (snapshot.storageMode === "local") {
      const data = await updateLocalPaperSettings(action, {
        startingBalance: req.body?.startingBalance,
        confirmation: req.body?.confirmation,
      });
      return res.status(200).json({ ok: true, account: data, storageMode: "local", error: null });
    }
    if (action === "change_starting_balance") {
      const balance = cleanNumber(req.body?.startingBalance);
      if (!Number.isFinite(balance) || balance <= 0) return res.status(400).json({ ok: false, error: "Starting balance must be positive." });
      const { data, error } = await supabase
        .from("freedom_paper_accounts")
        .update({ starting_balance: balance, updated_at: new Date().toISOString() })
        .eq("id", account.id)
        .select("*")
        .single();
      if (error) throw error;
      return res.status(200).json({ ok: true, account: data, error: null });
    }

    if (action === "cancel_pending_orders") {
      const { error } = await supabase
        .from("freedom_paper_orders")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
        .eq("account_id", account.id)
        .eq("status", "pending");
      if (error) throw error;
      return res.status(200).json({ ok: true, error: null });
    }

    if (action === "close_positions") {
      const { error } = await supabase
        .from("freedom_paper_positions")
        .update({ status: "closed", quantity: 0, closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("account_id", account.id)
        .eq("status", "open");
      if (error) throw error;
      return res.status(200).json({ ok: true, error: null });
    }

    if (action === "reset") {
      if (req.body?.confirmation !== "RESET PAPER ACCOUNT") return res.status(400).json({ ok: false, error: "Type RESET PAPER ACCOUNT to confirm." });
      const data = await resetAccount(supabase, account, req.body?.startingBalance || account.startingBalance);
      return res.status(200).json({ ok: true, account: data, error: null });
    }

    return res.status(400).json({ ok: false, error: "Unknown paper settings action." });
  } catch (error) {
    console.error("Freedom paper settings failed:", error);
    return res.status(500).json({ ok: false, error: error.message || "Paper settings failed." });
  }
}
