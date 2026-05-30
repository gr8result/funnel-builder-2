// /pages/api/crm/contacts/[id]/notes.js
// GET: list notes for a contact
// POST: add a note { type: 'phone'|'text'|'whatsapp'|'email'|'other', text, sentiment?: 'good'|'bad' }

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { withAuth } from "../../../../lib/withWorkspace";

async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing contact id" });

  // Verify the authenticated user owns this contact (prevents IDOR)
  const { data: contact, error: contactError } = await supabaseAdmin
    .from("contacts")
    .select("id")
    .eq("id", id)
    .eq("user_id", req.user.id)
    .maybeSingle();

  if (contactError || !contact) return res.status(403).json({ error: "Not found" });

  // ---------- GET ----------
  if (req.method === "GET") {
    try {
      const { data, error } = await supabaseAdmin
        .from("contact_notes")
        .select("id,type,text,sentiment,created_at")
        .eq("contact_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return res.status(200).json({ ok: true, notes: data || [] });
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

      const { data: note, error } = await supabaseAdmin
        .from("contact_notes")
        .insert({
          contact_id: id,
          type,
          text: text || "",
          sentiment: sentiment || null,
          owner: req.user.id,
        })
        .select("*")
        .single();
      if (error) throw error;

      // keep contact "last contact" fields fresh (best-effort)
      await supabaseAdmin
        .from("contacts")
        .update({
          last_contact_at: new Date().toISOString(),
          last_contact_type: type,
          sentiment: sentiment || null,
        })
        .eq("id", id);

      return res.status(200).json({ ok: true, note });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Failed to save note" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default withAuth(handler);