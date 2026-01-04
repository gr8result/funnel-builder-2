// /pages/api/dkim/generate.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userId, domain } = req.body || {};

    if (!domain || typeof domain !== "string") {
      return res.status(400).json({ error: "Domain is required" });
    }

    // 1. Get SendGrid API key
    //    EITHER: from env var (recommended)
    const apiKey = process.env.SENDGRID_API_KEY;

    if (!apiKey) {
      return res
        .status(500)
        .json({ error: "SENDGRID_API_KEY is not set in .env.local" });
    }

    // 2. Call SendGrid DKIM / domain auth endpoint
    const sgResponse = await fetch(
      "https://api.sendgrid.com/v3/whitelabel/domains",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domain,
          // These flags are the usual defaults; adjust if needed
          automatic_security: true,
          custom_spf: false,
          default: true,
        }),
      }
    );

    const body = await sgResponse.json().catch(() => ({}));

    // 3. Handle errors clearly so you see what SendGrid is saying
    if (!sgResponse.ok) {
      console.error("SendGrid DKIM error:", sgResponse.status, body);

      return res.status(sgResponse.status).json({
        error: body?.errors || body || "Unknown SendGrid error",
        status: sgResponse.status,
      });
    }

    // 4. Success – return records back to the frontend
    // SendGrid returns the DKIM + SPF records in "dns" usually
    const records = body?.dns || [];

    return res.status(200).json({
      success: true,
      domain: body?.domain || domain,
      records,
      raw: body,
    });
  } catch (err) {
    console.error("DKIM handler crashed:", err);
    return res.status(500).json({
      error: err.message || "Unexpected server error",
    });
  }
}
