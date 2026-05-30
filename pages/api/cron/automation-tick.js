// /pages/api/cron/automation-tick.js
// FULL REPLACEMENT
//
// ✅ Single endpoint your cron can hit every minute
// ✅ Calls the SAME logic as /api/automation/engine/tick by just re-running it here
// ✅ Optional query passthrough: flow_id, limit, force
//
// GET /api/cron/automation-tick?flow_id=...&limit=50&force=1

import tick from "../automation/engine/tick";

async function handler(req, res) {
  // Reuse the tick handler directly
  return tick(req, res);
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
