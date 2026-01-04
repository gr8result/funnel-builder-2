// pages/api/assets/list.js
import fs from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export default async function handler(req, res) {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      res.status(200).json({ assets: [] });
      return;
    }
    const files = fs
      .readdirSync(UPLOAD_DIR)
      .filter((f) => /\.(png|jpe?g|gif|webp|svg)$/i.test(f))
      .map((f) => `/uploads/${f}`);
    res.status(200).json({ assets: files });
  } catch (e) {
    console.error("List assets error:", e);
    res.status(500).send("Failed to list assets");
  }
}

