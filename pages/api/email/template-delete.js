import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE || "";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "POST only" });
    }

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return res.status(500).json({ ok: false, error: "Missing Supabase env" });
    }

    const path = String(req.body?.path || "").trim();
    const scope = String(req.body?.scope || "public").trim().toLowerCase();
    const userId = String(req.body?.userId || "").trim();

    if (!path) return res.status(400).json({ ok: false, error: "Missing path" });
    if (!userId) return res.status(400).json({ ok: false, error: "Missing userId" });

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const bucket = scope === "user" ? "email-user-assets" : "email-assets";
    const removePaths = [path];

    if (/\.html$/i.test(path)) {
      removePaths.push(path.replace(/\.html$/i, ".png"));
      removePaths.push(path.replace(/\.html$/i, ".jpg"));
      removePaths.push(path.replace(/\.html$/i, ".jpeg"));
      removePaths.push(path.replace(/\.html$/i, ".webp"));
    }

    const { error } = await supabase.storage.from(bucket).remove(removePaths);
    if (error) {
      return res.status(500).json({ ok: false, error: error.message || "Delete failed" });
    }

    return res.status(200).json({ ok: true, deleted: removePaths, bucket, scope });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Delete failed" });
  }
}
