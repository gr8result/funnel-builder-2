// List + Create automations
import fs from "fs";
import path from "path";

let supabase = null;
try {
  const { createClient } = require("@supabase/supabase-js");
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
  }
} catch {}

const FS_FILE = path.join(process.cwd(), "data", "email", "automations.json");
function fsRead() {
  const dir = path.dirname(FS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(FS_FILE)) fs.writeFileSync(FS_FILE, "[]", "utf8");
  return JSON.parse(fs.readFileSync(FS_FILE, "utf8"));
}
function fsWrite(rows) {
  const dir = path.dirname(FS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(FS_FILE, JSON.stringify(rows, null, 2), "utf8");
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    // LIST
    if (supabase) {
      const { data, error } = await supabase
        .from("email_automations")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) return res.status(500).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true, rows: data || [] });
    }
    const rows = fsRead().sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at));
    return res.status(200).json({ ok: true, rows });
  }

  if (req.method === "POST") {
    // CREATE
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ ok: false, error: "Name required" });

    const row = {
      id: crypto.randomUUID(),
      owner: null,
      name,
      status: "draft",          // 'draft' | 'live'
      trigger: "manual",        // 'manual' | 'on_subscribe' (future)
      steps: [],                // simple array for now
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (supabase) {
      const { data, error } = await supabase
        .from("email_automations")
        .insert(row)
        .select("*")
        .single();
      if (error) return res.status(500).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true, row: data });
    }

    const rows = fsRead();
    rows.unshift(row);
    fsWrite(rows);
    return res.status(200).json({ ok: true, row });
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
