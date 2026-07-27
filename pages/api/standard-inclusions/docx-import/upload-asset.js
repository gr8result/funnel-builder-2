import { withWorkspace } from "../../../../lib/withWorkspace";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import {
  STANDARD_INCLUSIONS_BUCKET,
  createOnlyOfficeId,
  uploadStandardInclusionsAsset,
} from "../../../../lib/standard-inclusions/onlyoffice";

export const config = {
  api: {
    bodyParser: { sizeLimit: "15mb" },
  },
};

const MAX_ASSET_BYTES = 12 * 1024 * 1024;

const EXTENSION_BY_CONTENT_TYPE = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

function parseImageDataUrl(value) {
  const match = /^data:(image\/(?:png|jpeg|gif|webp|svg\+xml));base64,([a-z0-9+/=]+)$/i.exec(String(value || "").trim());
  if (!match) return null;
  return { contentType: match[1].toLowerCase(), buffer: Buffer.from(match[2], "base64") };
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const parsed = parseImageDataUrl(req.body?.dataUrl);
  if (!parsed) return res.status(400).json({ ok: false, error: "A supported image data URL is required." });
  if (!parsed.buffer.length) return res.status(400).json({ ok: false, error: "The extracted image was empty." });
  if (parsed.buffer.length > MAX_ASSET_BYTES) {
    return res.status(413).json({ ok: false, error: `Extracted image exceeds the ${Math.round(MAX_ASSET_BYTES / 1024 / 1024)} MB per-asset limit.` });
  }

  const ext = EXTENSION_BY_CONTENT_TYPE[parsed.contentType] || "png";
  const storagePath = `${req.user.id}/standard-inclusions/${req.workspaceId}/docx-import/${createOnlyOfficeId("asset")}.${ext}`;

  try {
    await uploadStandardInclusionsAsset(storagePath, parsed.buffer, parsed.contentType, false);
  } catch (error) {
    console.error("[standard-inclusions/docx-import/upload-asset] upload failed", error?.message || error);
    return res.status(500).json({ ok: false, error: "Could not store the extracted image." });
  }

  const { data } = supabaseAdmin.storage.from(STANDARD_INCLUSIONS_BUCKET).getPublicUrl(storagePath);
  return res.status(200).json({ ok: true, url: data.publicUrl, storagePath });
}

export default withWorkspace(handler);
