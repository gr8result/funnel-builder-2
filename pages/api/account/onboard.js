// pages/api/account/onboard.js
// Saves onboarding details + generates a unique affiliate code.
// Stores licence images under /uploads/kyc (repo-local) so this works immediately.
// In production you'd replace this with Supabase Storage and DB upserts.

import fs from "fs";
import path from "path";
import crypto from "crypto";

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function writeBase64(dataUrl, destPath) {
  const m = /^data:(.+);base64,(.*)$/.exec(dataUrl || "");
  if (!m) throw new Error("Invalid image data");
  const b64 = m[2];
  fs.writeFileSync(destPath, Buffer.from(b64, "base64"));
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { form, licenceFront, licenceBack } = req.body || {};
    if (!form || typeof form !== "object") throw new Error("Missing form");
    if (!form.firstName || !form.lastName || !form.email) throw new Error("Name/email required");
    if (!form.dob) throw new Error("DOB required");
    if (!licenceFront || !licenceBack) throw new Error("Licence images required");

    // Generate deterministic affiliate code from email + DOB (stable but unique)
    const seed = `${form.email}::${form.dob}`;
    const code = crypto.createHash("sha256").update(seed).digest("hex").slice(0, 10).toUpperCase();

    // Save JSON record
    const root = path.join(process.cwd(), "uploads", "kyc");
    ensureDir(root);
    const safeEmail = form.email.replace(/[^a-z0-9@\.\-_]/gi, "_");
    const folder = path.join(root, safeEmail);
    ensureDir(folder);

    // Save images
    const frontPath = path.join(folder, "licence-front.jpg");
    const backPath = path.join(folder, "licence-back.jpg");
    writeBase64(licenceFront, frontPath);
    writeBase64(licenceBack, backPath);

    // Save the onboarding JSON (you can later import this into DB)
    const rec = { form, affiliateCode: code, savedAt: new Date().toISOString(), files: { front: frontPath, back: backPath } };
    fs.writeFileSync(path.join(folder, "onboarding.json"), JSON.stringify(rec, null, 2), "utf8");

    res.status(200).json({ ok: true, affiliateCode: code });
  } catch (e) {
    res.status(400).json({ error: e?.message || "Onboarding failed" });
  }
}

