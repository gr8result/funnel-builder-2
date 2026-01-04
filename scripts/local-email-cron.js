// /scripts/local-email-cron.js
// FULL REPLACEMENT — Local campaign queue runner (Windows-safe)
// Run: node scripts/local-email-cron.js
// It calls your worker every 60 seconds.

const WORKER_URL = "http://localhost:3000/api/email/process-campaign-queue";

async function tick() {
  const ts = new Date().toLocaleTimeString();
  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 50 }),
    });

    const raw = await res.text();
    if (!res.ok) {
      console.log(`[${ts}] Queue flush -> ${res.status} ERROR: ${raw}`);
      return;
    }

    console.log(`[${ts}] Queue flush -> ${raw}`);
  } catch (e) {
    console.log(`[${ts}] Queue flush -> FETCH ERROR: ${e?.message || e}`);
  }
}

console.log("Local email queue runner started (every 60s)");
tick();
setInterval(tick, 60_000);
