require("dotenv").config();

const CRON_KEY =
  process.env.SMSGLOBAL_CRON_KEY ||
  process.env.CRON_SECRET ||
  process.env.AUTOMATION_CRON_KEY ||
  "";

const BASE_URL =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.BASE_URL ||
  "http://localhost:3000";

const POLL_MS = Number(process.env.SMS_FLUSH_INTERVAL_MS || 30_000);

function buildFlushUrl() {
  const params = new URLSearchParams({ limit: "50" });
  if (CRON_KEY) params.set("key", CRON_KEY);
  return `${BASE_URL}/api/smsglobal/flush-queue?${params.toString()}`;
}

async function flushQueue() {
  try {
    const url = buildFlushUrl();
    console.log(`[sms:flush] Flushing queue via ${url}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(CRON_KEY ? { Authorization: `Bearer ${CRON_KEY}` } : {}),
      },
    });

    const raw = await response.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = { raw };
    }

    if (!response.ok) {
      console.error(`[sms:flush] HTTP ${response.status}`, data);
      return;
    }

    console.log("[sms:flush] Result:", data);
  } catch (err) {
    console.error("[sms:flush] Error:", err?.message || err);
  }
}

flushQueue();
setInterval(flushQueue, Number.isFinite(POLL_MS) && POLL_MS > 0 ? POLL_MS : 30_000);
