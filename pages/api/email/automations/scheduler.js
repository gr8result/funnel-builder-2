// ✅ /pages/api/email/automations/scheduler.js
async function handler(req, res) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/email/automations/worker`
    );

    const text = await response.text(); // 👈 Read as text to debug invalid JSON
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON returned from worker: ${text.slice(0, 200)}`);
    }

    console.log("Scheduler triggered worker:", data);

    res.status(200).json({
      message: "✅ Scheduler executed successfully",
      worker_response: data,
    });
  } catch (err) {
    console.error("Scheduler error:", err);
    res.status(500).json({
      message: "❌ Scheduler failed",
      error: err.message || err,
    });
  }
}

function withCronSecret(h) {
  return async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers['x-cron-secret'] !== secret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return h(req, res);
  };
}

export default withCronSecret(handler);
