// pages/api/templates/read.js
import fs from "fs";
import path from "path";

const SRC_BASE = path.join(process.cwd(), "templates", "gallery");
const PUB_BASE = path.join(process.cwd(), "public", "templates", "gallery");

// Resolve a web path like "/templates/gallery/lee/file.html" safely to disk
function resolveSafe(webPath) {
  if (!webPath || typeof webPath !== "string") {
    throw new Error("Missing path");
  }
  const clean = webPath.replace(/^\/+/, ""); // strip leading slashes
  if (!clean.startsWith("templates/gallery/")) {
    throw new Error("Path must start with /templates/gallery/");
  }
  const rel = clean.replace(/^templates\/gallery\//, "");
  const srcPath = path.join(SRC_BASE, rel);
  const pubPath = path.join(PUB_BASE, rel);

  // Normalise and enforce containment to block traversal
  const normSrc = path.normalize(srcPath);
  const normPub = path.normalize(pubPath);
  if (!normSrc.startsWith(SRC_BASE) || !normPub.startsWith(PUB_BASE)) {
    throw new Error("Invalid path");
  }
  return { srcPath: normSrc, pubPath: normPub };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const webPath = req.query.path;
    const { srcPath, pubPath } = resolveSafe(webPath);

    let filePath = srcPath;
    if (!fs.existsSync(filePath)) {
      // fall back to public mirror if source missing
      if (!fs.existsSync(pubPath)) throw new Error("File not found");
      filePath = pubPath;
    }

    const content = await fs.promises.readFile(filePath, "utf8");
    res.status(200).json({ content });
  } catch (err) {
    res.status(400).json({ error: err?.message || "Read failed" });
  }
}

