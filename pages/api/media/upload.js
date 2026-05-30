// pages/api/media/upload.js
import fs from "fs";
import path from "path";
import formidable from "formidable";
import { withAuth } from "../../../lib/withWorkspace";

export const config = {
  api: { bodyParser: false },
};

const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".ico", ".bmp", ".avif",
  ".mp4", ".webm", ".mov", ".mp3", ".wav", ".ogg",
  ".pdf", ".csv",
]);

async function handler(req, res) {
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

      const fileObj = Array.isArray(f) ? f[0] : f;
      const ext = path.extname(fileObj.originalFilename || fileObj.newFilename || ".bin").toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        fs.unlinkSync(fileObj.filepath);
        return res.status(400).json({ ok: false, error: `File type ${ext} is not allowed` });
      }

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

export default withAuth(handler);
