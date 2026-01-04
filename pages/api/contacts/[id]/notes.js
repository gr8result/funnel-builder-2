// /pages/api/crm/contacts/[id]/notes.js
// GET: list notes for a contact
// POST: add a note { type: 'phone'|'text'|'whatsapp'|'email'|'other', text, sentiment?: 'good'|'bad' }
// Prefers Supabase (SERVICE ROLE). Falls back to local filesystem if env is missing.

import fs from "fs";
import path from "path";

// ---------- Optional Supabase (server-only) ----------
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
} catch { /* no supabase dependency? fallback to FS */ }

// ---------- Filesystem fallback ----------
const NOTES_ROOT = path.join(process.cwd(), "data", "crm", "notes");
function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
function fileFor(contactId) { return path.join(NOTES_ROOT, `${contactId}.json`); }
function readFsNotes(contactId) {
  ensureDir(NOTES_ROOT);
  const f = fileFor(contactId);
  if (!fs.existsSync(f)) return [];
  try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return []; }
}
function writeFsNotes(contactId, notes) {
  ensureDir(NOTES_ROOT);
  fs.writeFileSync(fileFor(contactId), JSON.stringify(notes, null, 2), "utf8");
}

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing contact id" });

  // ---------- GET ----------
  if (req.method === "GET") {
    try {
      // Supabase first
      if (supabase) {
        const { data, error } = await supabase
          .from("contact_notes")
          .select("id,type,text,sentiment,created_at")
          .eq("contact_id", id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return res.status(200).json({ ok: true, notes: data || [] });
      }
      // Filesystem fallback
      const notes = readFsNotes(id).sort((a,b)=> new Date(b.created_at) - new Date(a.created_at));
      return res.status(200).json({ ok: true, notes });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Failed to load notes" });
    }
  }

  // ---------- POST ----------
  if (req.method === "POST") {
    try {
      const { type, text, sentiment } = req.body || {};
      if (!type) return res.status(400).json({ error: "Missing note type" });

      // Supabase path
      if (supabase) {
        const { data: note, error } = await supabase
          .from("contact_notes")
          .insert({
            contact_id: id,
            type,
            text: text || "",
            sentiment: sentiment || null,
            owner: null, // service role bypasses RLS; optional trigger can set owner
          })
          .select("*")
          .single();
        if (error) throw error;

        // keep contact “last contact” fields fresh (best-effort)
        await supabase
          .from("contacts")
          .update({
            last_contact_at: new Date().toISOString(),
            last_contact_type: type,
            sentiment: sentiment || null,
          })
          .eq("id", id);

        return res.status(200).json({ ok: true, note });
      }

      // Filesystem fallback
      const now = new Date().toISOString();
      const note = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        type, text: text || "", sentiment: sentiment || null, created_at: now
      };
      const list = readFsNotes(id);
      list.unshift(note);
      writeFsNotes(id, list);
      return res.status(200).json({ ok: true, note });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Failed to save note" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
