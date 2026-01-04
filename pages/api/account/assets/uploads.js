// pages/api/assets/upload.js
import fs from "fs";
import path from "path";
import { IncomingForm } from "formidable";

export const config = {
  api: { bodyParser: false }, // we handle multipart ourselves
};

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

function ensureDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  ensureDir();

  const form = new IncomingForm({ multiples: true, keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Upload parse error:", err);
      res.status(500).send("Upload failed");
      return;
    }

    const list = [];
    const move = (fileObj) =>
      new Promise((resolve, reject) => {
        try {
          const f = Array.isArray(fileObj) ? fileObj : [fileObj];
          f.forEach((file) => {
            if (!file || !file.filepath) return;
            const ext = path.extname(file.originalFilename || file.newFilename || ".bin").toLowerCase();
            const safe = (file.originalFilename || file.newFilename || "file")
              .toLowerCase()
              .replace(/[^a-z0-9._-]+/g, "-")
              .replace(/^-+|-+$/g, "");
            const name = `${Date.now()}-${safe}`;
            const dest = path.join(UPLOAD_DIR, name);
            fs.copyFileSync(file.filepath, dest);
            list.push(`/uploads/${name}`);
          });
          resolve();
        } catch (e) {
          reject(e);
        }
      });

    try {
      // Support common field names: files / file / images
      await Promise.all([
        files.files ? move(files.files) : null,
        files.file ? move(files.file) : null,
        files.images ? move(files.images) : null,
      ]);
    } catch (e) {
      console.error("Upload move error:", e);
      res.status(500).send("Save failed");
      return;
    }

    res.status(200).json({ ok: true, assets: list });
  });
}

