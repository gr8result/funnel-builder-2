// pages/api/funnels/import-html.js
// POST { url?: string, html?: string } -> { blocks: [...] }
// Fetches HTML (if url provided) or uses pasted HTML, then converts to a simple block array.
// This is intentionally basic — good for public WordPress/ClickBank-style pages.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    let { url, html } = req.body || {};
    if (!html && !url) return res.status(400).json({ error: "Provide url or html" });

    if (url) {
      const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 FunnelsImporter" } });
      if (!r.ok) return res.status(400).json({ error: `Fetch failed (${r.status})` });
      html = await r.text();
    }
    html = String(html || "").slice(0, 1_500_000); // safety cap

    // Very light extraction
    const blocks = [];
    const getAll = (re) => [...html.matchAll(re)];
    const strip = (s) => String(s||"").replace(/<[^>]*>/g,"").trim();

    // H1 hero
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1) {
      blocks.push({
        id: rid(), type: "hero",
        props: { heading: strip(h1[1]), sub: "", align: "centre", bg: "#0f1116", colour: "#eaeaea" }
      });
    }

    // H2 and P as text blocks
    for (const m of getAll(/<(h2|p)[^>]*>([\s\S]*?)<\/\1>/gi)) {
      blocks.push({ id: rid(), type: "text", props: { html: `<${m[1]}>${m[2]}</${m[1]}>`, align: "left", colour: "#d1d5db" } });
    }

    // Images
    for (const m of getAll(/<img[^>]*src=["']([^"']+)["'][^>]*alt=["']?([^"']*)["']?[^>]*>/gi)) {
      blocks.push({ id: rid(), type: "image", props: { url: m[1], alt: strip(m[2]||"image"), width: 960, height: 540, rounded: true } });
    }

    // First couple of prominent links as buttons
    const anchors = getAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi).slice(0, 2);
    for (const a of anchors) {
      blocks.push({ id: rid(), type: "button", props: { label: strip(a[2]) || "Learn more", href: a[1], style: "primary" } });
    }

    return res.status(200).json({ blocks });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Import failed" });
  }
}

function rid(){ return Math.random().toString(36).slice(2,9); }
