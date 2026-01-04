// /pages/api/twilio/recording.js
// FULL REPLACEMENT — proxies Twilio recording audio using API Key (no auth token needed)
// Query: ?sid=RE...   OR ?url=https://api.twilio.com/2010-04-01/Accounts/.../Recordings/RE.../Media
// Requires env:
//  TWILIO_ACCOUNT_SID
//  TWILIO_API_KEY_SID
//  TWILIO_API_KEY_SECRET

export default async function handler(req, res) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKeySid = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;

    const missing = [];
    if (!accountSid) missing.push("TWILIO_ACCOUNT_SID");
    if (!apiKeySid) missing.push("TWILIO_API_KEY_SID");
    if (!apiKeySecret) missing.push("TWILIO_API_KEY_SECRET");
    if (missing.length) return res.status(500).json({ ok: false, error: "Missing Twilio env vars", missing });

    const sid = String(req.query.sid || "").trim();
    const url = String(req.query.url || "").trim();

    let mediaUrl = "";
    if (sid) {
      mediaUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${sid}/Media`;
    } else if (url) {
      mediaUrl = url.startsWith("http") ? url : `https://api.twilio.com${url}`;
      if (!mediaUrl.includes("/Media")) mediaUrl = mediaUrl.replace(".json", "") + "/Media";
    } else {
      return res.status(400).json({ ok: false, error: "Provide sid or url" });
    }

    const basic = Buffer.from(`${apiKeySid}:${apiKeySecret}`).toString("base64");

    const r = await fetch(mediaUrl, {
      headers: {
        Authorization: `Basic ${basic}`,
      },
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return res.status(500).json({ ok: false, error: `Twilio media fetch failed (${r.status}) ${txt}` });
    }

    const contentType = r.headers.get("content-type") || "audio/mpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-store");

    const arr = Buffer.from(await r.arrayBuffer());
    return res.status(200).send(arr);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
