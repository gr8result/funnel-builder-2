// pages/api/paypal/capture-order.js
// Captures a LIVE PayPal order after the user approves payment

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token, emailPlan, smsPlan, calendarPlan, selected } = req.query;
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_SECRET;

  try {
    // Get live OAuth token
    const tokenRes = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(clientId + ":" + clientSecret).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Capture order
    const captureRes = await fetch(
      `https://api-m.paypal.com/v2/checkout/orders/${token}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const captureData = await captureRes.json();

    if (!captureRes.ok) {
      console.error("PayPal capture error:", captureData);
      return res.status(500).json({ error: "PayPal capture failed" });
    }

    // Redirect to success page with selected plan metadata
    const params = new URLSearchParams();
    if (typeof emailPlan === "string" && emailPlan) params.set("emailPlan", emailPlan);
    if (typeof smsPlan === "string" && smsPlan) params.set("smsPlan", smsPlan);
    if (typeof calendarPlan === "string" && calendarPlan) params.set("calendarPlan", calendarPlan);
    if (typeof selected === "string" && selected) params.set("selected", selected);

    const suffix = params.toString();
    res.redirect(`/checkout/success${suffix ? `?${suffix}` : ""}`);
  } catch (err) {
    console.error("PayPal capture failed:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
