import formidable from "formidable";
import { readFile } from "node:fs/promises";
import { withWorkspace } from "../../../lib/withWorkspace";
import {
  archiveStandardInclusionsSchedule,
  createStandardInclusionsScheduleWithPdf,
  listStandardInclusionsSchedules,
  replaceStandardInclusionsSchedulePdf,
  restoreStandardInclusionsVersion,
} from "../../../lib/standard-inclusions/pdfLibrary";

export const config = {
  api: { bodyParser: false },
};

function firstField(fields, key, fallback = "") {
  const value = fields?.[key];
  if (Array.isArray(value)) return value[0] == null ? fallback : String(value[0]);
  return value == null ? fallback : String(value);
}

function firstFile(files, key = "file") {
  const value = files?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function parseMultipartForm(req) {
  const form = formidable({
    multiples: false,
    keepExtensions: true,
    maxFileSize: 100 * 1024 * 1024,
    filter: (part) => part.name === "file" || part.mimetype === "application/pdf",
  });
  return new Promise((resolve, reject) => {
    form.parse(req, (error, fields, files) => {
      if (error) reject(error);
      else resolve({ fields, files });
    });
  });
}

async function parseJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function handler(req, res) {
  const workspaceId = req.workspaceId;
  const userId = req.user?.id;

  try {
    if (req.method === "GET") {
      const schedules = await listStandardInclusionsSchedules({
        workspaceId,
        includeArchived: String(req.query?.includeArchived || "") === "true",
      });
      return res.status(200).json({ ok: true, schedules });
    }

    if (req.method === "POST") {
      const contentType = String(req.headers["content-type"] || "");
      if (!contentType.includes("multipart/form-data")) {
        return res.status(415).json({ ok: false, error: "Standard Inclusions PDF uploads must use multipart/form-data." });
      }
      const { fields, files } = await parseMultipartForm(req);
      const uploadedFile = firstFile(files);
      if (!uploadedFile?.filepath) return res.status(400).json({ ok: false, error: "No PDF file was received." });
      const fileName = uploadedFile.originalFilename || "standard-inclusions.pdf";
      const mimeType = uploadedFile.mimetype || "application/pdf";
      if (mimeType !== "application/pdf" && !/\.pdf$/i.test(fileName)) {
        return res.status(400).json({ ok: false, error: "The selected file is not a valid PDF." });
      }
      const action = firstField(fields, "action", "create");
      const buffer = await readFile(uploadedFile.filepath);
      const scheduleId = firstField(fields, "scheduleId").trim();
      const schedule = action === "replace"
        ? await replaceStandardInclusionsSchedulePdf({ workspaceId, userId, scheduleId, fileName, buffer })
        : await createStandardInclusionsScheduleWithPdf({
            workspaceId,
            userId,
            name: firstField(fields, "name", fileName),
            description: firstField(fields, "description"),
            tierKey: firstField(fields, "tierKey"),
            fileName,
            buffer,
          });
      return res.status(200).json({ ok: true, schedule });
    }

    if (req.method === "PATCH") {
      const body = await parseJsonBody(req);
      const action = String(body.action || "").trim();
      const scheduleId = String(body.scheduleId || "").trim();
      if (action === "restore") {
        const schedule = await restoreStandardInclusionsVersion({
          workspaceId,
          userId,
          scheduleId,
          versionId: String(body.versionId || "").trim(),
        });
        return res.status(200).json({ ok: true, schedule });
      }
      if (action === "archive") {
        await archiveStandardInclusionsSchedule({ workspaceId, userId, scheduleId });
        const schedules = await listStandardInclusionsSchedules({ workspaceId });
        return res.status(200).json({ ok: true, schedules });
      }
      return res.status(400).json({ ok: false, error: "Unsupported Standard Inclusions action." });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    console.error("[standard-inclusions/pdf-library]", error);
    return res.status(error?.statusCode || 500).json({ ok: false, error: error?.message || "Standard Inclusions PDF library failed." });
  }
}

export default withWorkspace(handler);
