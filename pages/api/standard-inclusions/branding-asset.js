import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import formidable from "formidable";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../lib/withWorkspace";

export const config = { api: { bodyParser: false } };

const ACCEPTED_TYPES = new Map([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/webp", ".webp"],
]);

function parseForm(req) {
  const form = formidable({ multiples: false, maxFileSize: 10 * 1024 * 1024, keepExtensions: true });
  return new Promise((resolve, reject) => form.parse(req, (error, fields, files) => error ? reject(error) : resolve({ fields, files })));
}

function field(value) {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }
  if (!["owner", "admin", "marketing"].includes(req.memberRole)) {
    return res.status(403).json({ ok: false, error: "Branding asset upload permission is required." });
  }

  try {
    const { fields, files } = await parseForm(req);
    const upload = Array.isArray(files.file) ? files.file[0] : files.file;
    const scheduleId = field(fields.scheduleId).trim();
    const kind = field(fields.kind) === "alternateLogo" ? "alternateLogo" : "logo";
    if (!scheduleId) return res.status(400).json({ ok: false, error: "Schedule id is required." });
    if (!upload?.filepath || !ACCEPTED_TYPES.has(upload.mimetype)) return res.status(415).json({ ok: false, error: "Choose a PNG, JPEG, or WebP logo." });

    const { data: schedule, error: scheduleError } = await supabaseAdmin
      .from("standard_inclusions_schedules")
      .select("id")
      .eq("id", scheduleId)
      .eq("workspace_id", req.workspaceId)
      .eq("status", "active")
      .maybeSingle();
    if (scheduleError) return res.status(503).json({ ok: false, error: "Schedule could not be verified." });
    if (!schedule) return res.status(404).json({ ok: false, error: "Schedule not found in this workspace." });

    const extension = ACCEPTED_TYPES.get(upload.mimetype);
    const objectPath = `${req.user.id}/standard-inclusions/${req.workspaceId}/${scheduleId}/branding/${kind}-${randomUUID()}${extension}`;
    const buffer = await readFile(upload.filepath);
    const { error: uploadError } = await supabaseAdmin.storage.from("assets").upload(objectPath, buffer, {
      contentType: upload.mimetype,
      upsert: false,
    });
    if (uploadError) return res.status(503).json({ ok: false, error: "Branding asset could not be stored." });

    const { data } = supabaseAdmin.storage.from("assets").getPublicUrl(objectPath);
    return res.status(201).json({ ok: true, kind, storagePath: objectPath, url: data?.publicUrl || "" });
  } catch (error) {
    console.error("Standard Inclusions branding upload failed:", error?.message || error);
    return res.status(error?.httpCode || 500).json({ ok: false, error: "Branding asset upload failed." });
  }
}

export default withWorkspace(handler);
