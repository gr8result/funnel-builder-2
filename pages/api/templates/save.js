// pages/api/templates/save.js
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

    const { name, html } = req.body || {};
    if (!name || !html) return res.status(400).json({ ok: false, error: "Missing name or html" });

    const slug = String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 80) || "email";

    const dir = path.join(process.cwd(), "public", "templates", "gallery", "custom");
    fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, `${slug}.html`);
    fs.writeFileSync(filePath, html, "utf8");

    // Minimal metadata
    const meta = {
      title: name,
      description: "Saved from builder",
      category: "Custom",
    };
    fs.writeFileSync(path.join(dir, `${slug}.json`), JSON.stringify(meta, null, 2), "utf8");

    return res.status(200).json({ ok: true, file: `/templates/gallery/custom/${slug}.html` });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}

