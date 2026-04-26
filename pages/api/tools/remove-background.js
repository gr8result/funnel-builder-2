// pages/api/tools/remove-background.js
// Calls remove.bg API to remove the background from a base64 image.
// Requires REMOVEBG_API_KEY in .env.local — get a free key at https://www.remove.bg/api

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = String(process.env.REMOVEBG_API_KEY || "").trim();
  const normalizedApiKey = apiKey.toLowerCase();
  const invalidApiKey = !apiKey
    || apiKey === "your_remove_bg_api_key_here"
    || apiKey === "real_key_from_remove_bg"
    || normalizedApiKey.includes("placeholder")
    || normalizedApiKey.includes("your_remove_bg")
    || normalizedApiKey.includes("real_key_from_remove_bg");
  if (invalidApiKey) {
    return res.status(503).json({
      error: "REMOVEBG_API_KEY is not configured with a real remove.bg key. Update .env.local and restart Next.js.",
    });
  }

  const { image } = req.body;
  if (!image || typeof image !== "string") {
    return res.status(400).json({ error: "Missing image field (base64 data URL)" });
  }

  try {
    // Strip data URL prefix — remove.bg expects raw base64
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    const formData = new URLSearchParams();
    formData.append("image_file_b64", base64Data);
    formData.append("size", "auto");
    formData.append("format", "png");

    const upstream = await fetch("https://api.remove.bg/v1.0/removebg", {
      method:  "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return res.status(upstream.status).json({ error: `remove.bg error: ${errText}` });
    }

    const buffer  = await upstream.arrayBuffer();
    const b64Out  = Buffer.from(buffer).toString("base64");
    const dataUrl = `data:image/png;base64,${b64Out}`;

    return res.status(200).json({ base64: dataUrl });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Background removal failed" });
  }
}
