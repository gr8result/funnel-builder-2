// pages/api/templates/rename.js
import fs from "fs";
import path from "path";

const GALLERY_ROOT = path.join(process.cwd(), "public", "templates", "gallery");
const META_PATH = path.join(process.cwd(), "public", "templates", "meta.json");

// Validate and make a slug filename
function toSlug(str) {
  return String(str)
    .trim()
    .replace(/[^a-zA-Z0-9 ]+/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  try {
    const { href, newTitle } = req.body || {};
    if (!href || !newTitle) return res.status(400).send("Missing 'href' or 'newTitle'");

    // href like: /templates/gallery/<folder>/<file>.html
    const parts = href.split("/").filter(Boolean);
    if (parts.length < 4 || parts[0] !== "templates" || parts[1] !== "gallery")
      return res.status(400).send("Invalid href");

    const folder = parts[2];
    const file = parts[3];
    const absDir = path.join(GALLERY_ROOT, folder);
    const oldPath = path.join(absDir, file);
    if (!fs.existsSync(oldPath)) return res.status(404).send("Original file not found");

    // Rename on disk
    const newSlug = toSlug(newTitle);
    const newPath = path.join(absDir, `${newSlug}.html`);
    fs.renameSync(oldPath, newPath);

    // Update meta.json titles
    let meta = {};
    try {
      if (fs.existsSync(META_PATH)) meta = JSON.parse(fs.readFileSync(META_PATH, "utf8"));
    } catch { meta = {}; }

    const oldNameNoExt = file.replace(/\.html$/i, "");
    // Delete any old mapping; set new mapping keyed by NEW slug
    if (meta[oldNameNoExt]) delete meta[oldNameNoExt];
    meta[newSlug] = { title: newTitle, description: meta[newSlug]?.description || "-" };

    fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2), "utf8");

    res.status(200).json({ ok: true, href: `/templates/gallery/${folder}/${newSlug}.html` });
  } catch (err) {
    console.error("Rename error:", err);
    res.status(500).send("Failed to rename template");
  }
}

