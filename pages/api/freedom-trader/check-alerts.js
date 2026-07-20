import { createSupabaseAdmin } from "../../../lib/supabaseAdmin";

function getSupabase() {
  try {
    return createSupabaseAdmin();
  } catch (error) {
    console.error("Freedom Trader Supabase unavailable:", error);
    return null;
  }
}

function cleanNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function fetchQuote(symbol) {
  const apiKey = process.env.FINNHUB_API_KEY?.trim();
  if (!apiKey) return null;
  try {
    const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`);
    const data = await response.json().catch(() => null);
    if (!response.ok) return null;
    return cleanNumber(data?.c);
  } catch (error) {
    console.error("Freedom Trader alert quote failed:", error);
    return null;
  }
}

function shouldTrigger(alert, currentPrice) {
  const triggerPrice = cleanNumber(alert.trigger_price);
  if (!Number.isFinite(currentPrice) || !Number.isFinite(triggerPrice)) return false;
  const type = String(alert.alert_type || "").toUpperCase();
  const direction = String(alert.direction || "").toLowerCase();
  if (type === "TARGET REACHED") return currentPrice >= triggerPrice;
  if (type === "STOP REACHED") return currentPrice <= triggerPrice;
  if (type === "ENTRY REACHED") return direction === "below" ? currentPrice <= triggerPrice : currentPrice >= triggerPrice;
  if (type === "BREAKOUT") return currentPrice >= triggerPrice;
  if (type === "BREAKDOWN") return currentPrice <= triggerPrice;
  if (type === "RSI OVERSOLD" || type === "RSI OVERBOUGHT" || type === "VOLUME SPIKE" || type === "SETUP EXPIRED") return false;
  return false;
}

function alertMessage(alert, currentPrice) {
  return `${alert.alert_type} for ${alert.symbol}: current price ${currentPrice} reached planned level ${alert.trigger_price}. Review the setup manually; no trade was executed.`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const supabase = getSupabase();
  if (!supabase) return res.status(503).json({ ok: false, error: "Alerts database temporarily unavailable.", checked: 0, triggered: [] });

  try {
    const { data: alerts, error } = await supabase.from("freedom_trader_alerts").select("*").eq("status", "active");
    if (error) throw error;

    const triggered = [];
    const failed = [];
    for (const alert of alerts || []) {
      try {
        const currentPrice = await fetchQuote(alert.symbol);
        if (!Number.isFinite(currentPrice)) {
          failed.push({ id: alert.id, symbol: alert.symbol, error: "Live quote unavailable." });
          continue;
        }
        const baseUpdate = { last_checked_price: currentPrice, updated_at: new Date().toISOString() };
        if (shouldTrigger(alert, currentPrice)) {
          const triggeredAt = new Date().toISOString();
          const message = alertMessage(alert, currentPrice);
          const { error: updateError } = await supabase
            .from("freedom_trader_alerts")
            .update({ ...baseUpdate, status: "triggered", triggered_at: triggeredAt, message })
            .eq("id", alert.id);
          if (updateError) throw updateError;
          if (alert.position_id) {
            const { error: journalError } = await supabase.from("freedom_trader_journal").insert({
              position_id: alert.position_id,
              symbol: alert.symbol,
              event_type: alert.alert_type,
              price: currentPrice,
              notes: message,
            });
            if (journalError) console.error("Freedom Trader alert journal failed:", journalError);
          }
          triggered.push({ id: alert.id, symbol: alert.symbol, alertType: alert.alert_type, currentPrice, triggerPrice: cleanNumber(alert.trigger_price), message });
        } else {
          const { error: updateError } = await supabase.from("freedom_trader_alerts").update(baseUpdate).eq("id", alert.id);
          if (updateError) throw updateError;
        }
      } catch (alertError) {
        console.error("Freedom Trader single alert check failed:", alertError);
        failed.push({ id: alert.id, symbol: alert.symbol, error: "Alert check failed." });
      }
    }

    return res.status(200).json({ ok: true, checked: (alerts || []).length, triggered, failed, error: null });
  } catch (error) {
    console.error("Freedom Trader check-alerts failed:", error);
    return res.status(500).json({ ok: false, checked: 0, triggered: [], error: "Unable to check alerts right now." });
  }
}
