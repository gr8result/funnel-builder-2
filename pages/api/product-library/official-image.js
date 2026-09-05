const ALLOWED_HOSTS = new Set([
  "www.bradnams.com.au",
  "bradnams.com.au",
]);

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const rawUrl = String(req.query?.url || "").trim();
    const imageUrl = new URL(rawUrl);
    if (imageUrl.protocol !== "https:" || !ALLOWED_HOSTS.has(imageUrl.hostname)) {
      return res.status(400).json({ ok: false, error: "Unsupported image host." });
    }

    const upstream = await fetch(imageUrl.href, {
      headers: {
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "user-agent": "Mozilla/5.0 Client Selections official image verifier",
      },
    });
    if (!upstream.ok) {
      return res.status(upstream.status).json({ ok: false, error: "Official image could not be loaded." });
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return res.status(415).json({ ok: false, error: "Official URL did not return an image." });
    }

    const bytes = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(bytes);
  } catch (error) {
    return res.status(400).json({ ok: false, error: error?.message || "Invalid image URL." });
  }
}
