import { Buffer } from "buffer";

export default async function handler(req, res) {
  const sid = Array.isArray(req.query.sid) ? req.query.sid[0] : req.query.sid;
  if (!sid) return res.status(400).json({ error: "Missing 'sid' query parameter" });

  const TW_ACCOUNT = process.env.TWILIO_ACCOUNT_SID;
  const TW_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  if (!TW_ACCOUNT || !TW_TOKEN) {
    return res.status(500).json({ error: "Twilio credentials not configured on server." });
  }

  const baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${TW_ACCOUNT}/Recordings/${encodeURIComponent(sid)}`;
  const tryUrls = [`${baseUrl}.mp3`, baseUrl];

  const auth = "Basic " + Buffer.from(`${TW_ACCOUNT}:${TW_TOKEN}`).toString("base64");

  let upstreamRes = null;
  for (const u of tryUrls) {
    try {
      upstreamRes = await fetch(u, { headers: { Authorization: auth } });
      if (upstreamRes.ok) break;
    } catch (e) {
      upstreamRes = null;
    }
  }

  if (!upstreamRes || !upstreamRes.ok) {
    const status = upstreamRes ? upstreamRes.status : 502;
    return res.status(status).json({ error: "Failed to fetch recording from Twilio" });
  }

  const contentType = upstreamRes.headers.get("content-type") || "audio/mpeg";
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=86400");

  try {
    const ab = await upstreamRes.arrayBuffer();
    res.status(200).send(Buffer.from(ab));
  } catch (err) {
    console.error("Proxy stream error:", err);
    res.status(500).json({ error: "Streaming error" });
  }
}