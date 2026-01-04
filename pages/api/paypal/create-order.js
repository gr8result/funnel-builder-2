// pages/api/paypal/create-order.js
// Creates a LIVE PayPal order for the selected modules

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { items, total } = req.body;
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(400).json({ error: "PayPal credentials missing" });
  }

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

    // Create PayPal order
    const orderRes = await fetch("https://api-m.paypal.com/v2/checkout/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            description: "Gr8 Result Digital Solutions Subscription",
            amount: {
              currency_code: "AUD",
              value: total.toFixed(2),
              breakdown: {
                item_total: { currency_code: "AUD", value: total.toFixed(2) },
              },
            },
            items: items.map((i) => ({
              name: i.name,
              unit_amount: { currency_code: "AUD", value: i.price.toFixed(2) },
              quantity: "1",
            })),
          },
        ],
        application_context: {
          brand_name: "Gr8 Result Digital Solutions",
          landing_page: "LOGIN",
          user_action: "PAY_NOW",
          return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/paypal/capture-order`,
          cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout?cancelled=true`,
        },
      }),
    });

    const orderData = await orderRes.json();

    if (!orderRes.ok) {
      console.error("PayPal order error:", orderData);
      return res.status(500).json({ error: "PayPal order creation failed" });
    }

    res.status(200).json(orderData);
  } catch (err) {
    console.error("PayPal order creation failed:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
