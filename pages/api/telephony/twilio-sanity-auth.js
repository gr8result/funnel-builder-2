// /pages/api/telephony/twilio-sanity-auth.js
// ✅ Uses ACCOUNT_SID + AUTH_TOKEN to prove Twilio + account are correct (independent of API Keys)

export default async function handler(req, res) {
  try {
    const accountSid = String(process.env.TWILIO_ACCOUNT_SID || "").trim();
    const authToken = String(process.env.TWILIO_AUTH_TOKEN || "").trim();

    if (!accountSid || !authToken) {
      return res.status(500).json({
        ok: false,
        error: "Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN",
      });
    }

    const basic = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
      method: "GET",
      headers: { Authorization: `Basic ${basic}` },
    });

    const body = await r.text();

    return res.status(200).json({
      ok: r.ok,
      status: r.status,
      body: body.slice(0, 400),
      using: { accountSid: `${accountSid.slice(0, 6)}...${accountSid.slice(-4)}` },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
