// ============================================
// /pages/api/email/builder-doc-list.js
// FULL REPLACEMENT — List builder docs (metadata)
// Lists: email-user-assets/{userId}/builder-docs/*.json
// ============================================

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE || ANON);
const BUCKET = "email-user-assets";

async function downloadJson(path) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  const text = await data.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    const userId = String(req.query?.userId || "").trim();
    if (!userId) return res.status(400).json({ ok: false, error: "Missing userId" });

    const folder = `${userId}/builder-docs`;
    const { data: files, error } = await supabase.storage.from(BUCKET).list(folder, {
      limit: 200,
      sortBy: { column: "created_at", order: "desc" },
    });

    if (error) return res.status(500).json({ ok: false, error: "List failed", detail: error.message });

    const jsonFiles = (files || []).filter((f) => String(f.name || "").endsWith(".json"));

    // read small metadata from each doc
    const docs = [];
    for (const f of jsonFiles.slice(0, 60)) {
      const path = `${folder}/${f.name}`;
      const j = await downloadJson(path);
      if (!j) continue;
      docs.push({
        docId: j.docId || f.name.replace(".json", ""),
        name: j.name || "Untitled Email",
        updatedAt: j.updatedAt || null,
        createdAt: j.createdAt || null,
      });
    }

    docs.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

    return res.status(200).json({ ok: true, docs });
  } catch (e) {
    console.error("builder-doc-list error:", e);
    return res.status(500).json({ ok: false, error: "List failed", detail: e?.message || String(e) });
  }
}
