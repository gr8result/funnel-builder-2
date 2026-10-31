// /pages/api/email/log-broadcast.js
// Retired 2026-10-15. It wrote email_broadcasts rows for a userId taken from the request body (any signed-in user
// could create rows owned by someone else) and without a workspace. Nothing in the app calls it.
// Broadcasts are recorded by /api/email/send-broadcast and /api/email/schedule-broadcast.

export default function handler(req, res) {
  return res.status(410).json({
    success: false,
    error: "This endpoint has been retired. Use /api/email/send-broadcast or /api/email/schedule-broadcast.",
  });
}
