// pages/api/subscribers/import.js
import formidable from "formidable";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

export const config = { api: { bodyParser: false } };

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function normaliseRow(row) {
  // Safe, explicit scan for common columns
  const keys = Object.keys(row || {}).map(k => String(k));

  const findKey = (regex) => {
    for (const k of keys) {
      if (regex.test(k.toLowerCase())) return k;
    }
    return null;
  };

  const emailK = findKey(/email/);
  const nameK  = findKey(/^(name|full.?name|first.?name)$/);
  const phoneK = findKey(/^(phone|mobile|tel|telephone)$/);

  const val = (k) => (k && row[k] != null ? String(row[k]).trim() : "");

  return {
    name:  val(nameK),
    email: val(emailK).toLowerCase(),
    phone: val(phoneK),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });

  const dataDir = path.join(process.cwd(), "data", "subscribers");
  ensureDir(dataDir);
  const masterPath = path.join(dataDir, "master.json");

  const { files } = await new Promise((resolve, reject) => {
    const form = formidable({ multiples: false });
    form.parse(req, (err, _f, fls) => (err ? reject(err) : resolve({ files: fls })));
  }).catch((e) => ({ error: e }));

  if (!files?.file) return res.status(400).json({ ok: false, error: "No file" });

  try {
    const csv = fs.readFileSync(files.file.filepath, "utf8");
    const rows = parse(csv, { columns: true, skip_empty_lines: true });
    const add = rows.map(normaliseRow).filter(r => r.email);

    let master = [];
    if (fs.existsSync(masterPath)) master = JSON.parse(fs.readFileSync(masterPath, "utf8"));
    // de-dupe by email
    const map = new Map(master.map(m => [m.email, m]));
    add.forEach(r => map.set(r.email, { ...map.get(r.email), ...r, source: r.source || "import" }));
    const merged = Array.from(map.values());
    fs.writeFileSync(masterPath, JSON.stringify(merged, null, 2));

    // also store the raw CSV as an archive
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.writeFileSync(path.join(dataDir, `import-${stamp}.csv`), csv, "utf8");

    return res.json({ ok: true, added: add.length, total: merged.length });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "Parse failed" });
  }
}




