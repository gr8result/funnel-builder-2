// pages/api/media/upload.js
import fs from "fs";
import path from "path";
import formidable from "formidable";

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const uploadDir = path.join(process.cwd(), "public", "media", "uploads");
    fs.mkdirSync(uploadDir, { recursive: true });

    const form = formidable({ multiples: false, uploadDir, keepExtensions: true });
    form.parse(req, (err, fields, files) => {
      if (err) {
        console.error(err);
        return res.status(400).json({ ok: false, error: "Bad upload" });
      }
      const f = files.file;
      if (!f) return res.status(400).json({ ok: false, error: "Missing file field" });

      let filename;
      if (Array.isArray(f)) {
        filename = path.basename(f[0].filepath);
      } else {
        filename = path.basename(f.filepath);
      }
      const url = `/media/uploads/${filename}`;
      return res.status(200).json({ ok: true, url });
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}

