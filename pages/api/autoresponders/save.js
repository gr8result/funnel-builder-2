// pages/api/autoresponders/save.js
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method not allowed" });

    const body = req.body || {};
    const { meta, html, status } = body;
    if (!meta || !html) return res.status(400).json({ ok:false, error:"Missing meta or html" });

    const slug = String(meta.campaignsName || "campaigns")
      .toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"").slice(0,80) || "campaigns";

    const dataDir = path.join(process.cwd(), "public", "data", "autoresponders");
    const templatesDir = path.join(process.cwd(), "public", "templates", "gallery", "custom");
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(templatesDir, { recursive: true });

    const stamp = Date.now();
    const htmlFile = path.join(templatesDir, `${slug}-${stamp}.html`);
    fs.writeFileSync(htmlFile, html, "utf8");

    const record = {
      id: `${slug}-${stamp}`,
      status: status === "active" ? "active" : "draft",
      savedAt: new Date().toISOString(),
      meta,
      htmlFile: `/templates/gallery/custom/${path.basename(htmlFile)}`,
    };

    const jsonFile = path.join(dataDir, `${slug}-${stamp}.json`);
    fs.writeFileSync(jsonFile, JSON.stringify(record, null, 2), "utf8");

    return res.status(200).json({ ok:true, id: record.id, file: record.htmlFile });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error:"Server error" });
  }
}

