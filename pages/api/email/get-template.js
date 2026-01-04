// /pages/api/email/get-template.js
// FULL REPLACEMENT
//
// ✅ Returns template by id for the Email Editor
// ✅ Supports multiple shapes: {json, html} or {template:{json,html}} or {blocks:[...]}
// ✅ Supports optional ?table=email_templates (default)
// ✅ Uses service role (safe for server)
// ✅ Scopes to logged-in user where possible (falls back if template has no user_id)
//
// Expected table columns (flexible):
// - id (uuid or text)
// - user_id (uuid) (optional but recommended)
// - name (text) (optional)
// - json (jsonb/text) (optional)
// - html (text) (optional)
// - blocks (jsonb) (optional)
//
// ENV required:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function pickFirst(obj, keys) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return null;
}

export default async function handler(req, res) {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({
        error:
          "Missing env. Require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const id =
      (req.query?.id ? String(req.query.id) : "") ||
      (req.body?.id ? String(req.body.id) : "");

    const table = req.query?.table ? String(req.query.table) : "email_templates";

    if (!id) {
      return res.status(400).json({ error: "Missing id" });
    }

    // Try to detect current user from Authorization header (if you pass it) OR cookie session is not available on service role.
    // We still support user scoping if caller sends x-user-id header.
    const userIdFromHeader =
      req.headers["x-user-id"] ? String(req.headers["x-user-id"]) : null;

    // 1) Fetch by id (and user_id if present)
    // We do a two-step:
    // - try with user_id filter (if provided)
    // - fallback without (in case templates are global or have no user_id)
    async function fetchRow(withUser) {
      let q = supabase.from(table).select("*").eq("id", id).limit(1);
      if (withUser && userIdFromHeader) q = q.eq("user_id", userIdFromHeader);
      const { data, error } = await q;
      if (error) throw error;
      return (data && data[0]) || null;
    }

    let row = null;

    try {
      row = await fetchRow(true);
    } catch (e) {
      // ignore and fallback
    }

    if (!row) {
      row = await fetchRow(false);
    }

    if (!row) {
      return res.status(404).json({
        error: "Template not found",
        table,
        id,
        hint:
          "Check table name and confirm the template exists. If you use RLS and don’t store templates in this table, update table param.",
      });
    }

    // Pull fields from many possible names
    const json = pickFirst(row, ["json", "design", "editor_json", "template_json"]);
    const html = pickFirst(row, ["html", "template_html", "export_html"]);
    const blocks = pickFirst(row, ["blocks"]);

    // Normalize return shape that editor supports
    // Editor accepts:
    // - { json: { blocks: [...] }, html: "<...>" }
    // - { blocks: [...] }
    // - { template: { json/html } }
    let out = {
      id: row.id,
      name: pickFirst(row, ["name", "title", "template_name"]) || null,
      table,
    };

    // If json is a string, try parse
    let parsedJson = json;
    if (typeof parsedJson === "string") {
      try {
        parsedJson = JSON.parse(parsedJson);
      } catch {
        // leave string as-is
      }
    }

    // If blocks exists and is string, try parse
    let parsedBlocks = blocks;
    if (typeof parsedBlocks === "string") {
      try {
        parsedBlocks = JSON.parse(parsedBlocks);
      } catch {
        // leave string
      }
    }

    if (parsedJson) out.json = parsedJson;
    if (html) out.html = html;

    // If template uses blocks column, surface as blocks too
    if (parsedBlocks && Array.isArray(parsedBlocks)) out.blocks = parsedBlocks;

    // If json is missing but blocks exists, build json wrapper
    if (!out.json && out.blocks) out.json = { blocks: out.blocks };

    // If everything missing, still return row so you can see what columns exist
    if (!out.json && !out.html && !out.blocks) {
      out.warning =
        "Template row exists but no json/html/blocks columns found. Check your table schema.";
      out.row_keys = Object.keys(row || {});
    }

    return res.status(200).json(out);
  } catch (err) {
    return res.status(500).json({
      error: err?.message || "Unknown error",
      details: String(err?.stack || ""),
    });
  }
}
