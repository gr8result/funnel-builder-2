// /pages/api/website-builder/project.js
// GET  ?id=uuid   -> load project (must belong to user)
// POST { id?, name, template_slug, theme_slug, data, is_published? } -> create/update
//
// Uses service role key, but verifies the user via Supabase access token.

import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getUserFromRequest(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data?.user || null;
}

export default async function handler(req, res) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    if (req.method === "GET") {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "Missing id" });

      const { data, error } = await supabaseAdmin
        .from("site_projects")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (error) return res.status(404).json({ error: error.message });
      return res.status(200).json({ project: data });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const payload = {
        id: body.id || undefined,
        user_id: user.id,
        name: body.name || "Untitled site",
        template_slug: body.template_slug || "blank",
        theme_slug: body.theme_slug || "modern-blue",
        data: body.data || {},
        is_published: !!body.is_published,
      };

      // Upsert by id (only for this user)
      if (payload.id) {
        // Ensure ownership
        const { data: existing } = await supabaseAdmin
          .from("site_projects")
          .select("id,user_id")
          .eq("id", payload.id)
          .single();

        if (!existing || existing.user_id !== user.id) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }

      const { data, error } = await supabaseAdmin
        .from("site_projects")
        .upsert(payload, { onConflict: "id" })
        .select("*")
        .single();

      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ project: data });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
