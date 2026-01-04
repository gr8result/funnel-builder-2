// pages/api/media/list.js
import fs from "fs";
import path from "path";

function safeList(dir) {
  try { return fs.readdirSync(dir).filter(n => /\.(png|jpe?g|gif|webp|svg)$/i.test(n)); }
  catch { return []; }
}
function toHref(abs) {
  const rel = abs.split(path.join(process.cwd(), "public")).pop().replace(/\\/g, "/");
  return rel.startsWith("/") ? rel : `/${rel}`;
}

export default function handler(req, res) {
  try {
    const root = path.join(process.cwd(), "public", "media");
    const stock = path.join(root, "stock");
    const uploads = path.join(root, "uploads");

    const out = [];
    for (const dir of [stock, uploads]) {
      const names = safeList(dir);
      for (const name of names) out.push(toHref(path.join(dir, name)));
    }
    res.status(200).json({ ok: true, assets: out });
  } catch (e) {
    res.status(200).json({ ok: true, assets: [] });
  }
}


