// /pages/api/telephony/twilio-sanity.js
import twilio from "twilio";

export default async function handler(req, res) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const apiKey = process.env.TWILIO_API_KEY;
    const apiSecret = process.env.TWILIO_API_SECRET;

    if (!accountSid) return res.status(500).json({ ok: false, error: "Missing TWILIO_ACCOUNT_SID" });
    if (!authToken) return res.status(500).json({ ok: false, error: "Missing TWILIO_AUTH_TOKEN" });

    // ✅ 1) Confirm account credentials work (AC + AUTH TOKEN)
    const clientAuth = twilio(accountSid, authToken);
    const acct = await clientAuth.api.accounts(accountSid).fetch();

    const result = {
      ok: true,
      auth_ok: true,
      account: {
        sid: acct.sid,
        status: acct.status,
        friendly_name: acct.friendlyName,
      },
    };

    // ✅ 2) Optional: also confirm API KEY works (SK + SECRET)
    if (apiKey && apiSecret) {
      try {
        const clientKey = twilio(apiKey, apiSecret, { accountSid });
        await clientKey.api.accounts(accountSid).fetch();
        result.api_key_ok = true;
      } catch (e) {
        result.api_key_ok = false;
        result.api_key_error = e?.message || String(e);
      }
    } else {
      result.api_key_ok = false;
      result.api_key_error = "Missing TWILIO_API_KEY or TWILIO_API_SECRET";
    }

    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || String(e),
    });
  }
}
