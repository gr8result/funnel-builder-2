import { Buffer } from "buffer";

export default async function handler(req, res) {
  const encoded = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
  if (!encoded) return res.status(400).json({ error: "Missing 'url' query parameter" });

  const url = decodeURIComponent(encoded);
  const isTwilioApi = url.startsWith("https://api.twilio.com/") || url.includes("twilio.com");

  const TW_ACCOUNT = process.env.TWILIO_ACCOUNT_SID;
  const TW_TOKEN = process.env.TWILIO_AUTH_TOKEN;

  const headers = {};
  if (isTwilioApi) {
    if (!TW_ACCOUNT || !TW_TOKEN) {
      return res.status(500).json({ error: "Twilio credentials not configured on server." });
    }
    headers["Authorization"] = "Basic " + Buffer.from(`${TW_ACCOUNT}:${TW_TOKEN}`).toString("base64");
  }

  try {
    const upstreamRes = await fetch(url, { headers });
    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json({ error: "Failed to fetch audio", statusText: upstreamRes.statusText });
    }

    const contentType = upstreamRes.headers.get("content-type") || "audio/mpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");

    const ab = await upstreamRes.arrayBuffer();
    res.status(200).send(Buffer.from(ab));
  } catch (err) {
    console.error("recording-audio proxy error:", err);
    res.status(500).json({ error: "Proxy fetch failed" });
  }
}