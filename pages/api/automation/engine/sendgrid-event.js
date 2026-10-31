export default function handler(req, res) {
  res.setHeader("Allow", "POST");
  return res.status(410).json({
    ok: false,
    error: "This webhook is retired. Configure SendGrid to use /api/webhooks/sendgrid-events.",
  });
}
