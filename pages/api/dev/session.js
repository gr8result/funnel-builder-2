// pages/api/dev/session.js
export default function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const { key } = req.body || {};
    const want = process.env.ADMIN_DASH_KEY || "";
    if (!want) return res.status(400).json({ error: "ADMIN_DASH_KEY not set on server" });
    if (typeof key !== "string" || key !== want) return res.status(401).json({ error: "Invalid key" });

    res.setHeader("Set-Cookie", `admin_key=${encodeURIComponent(key)}; Path=/; SameSite=Lax; Max-Age=86400;`);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(400).json({ error: e?.message || "Login failed" });
  }
}

