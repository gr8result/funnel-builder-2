import fs from "node:fs/promises";
import path from "node:path";
import { withAuth } from "../../../../lib/withWorkspace";

const EXPORT_ROOT = path.join(process.cwd(), "email", "sendgrid-export");

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeThumb(url) {
  if (!url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

function cleanName(value) {
  return String(value || "")
    .replace(/^duplicate:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function makeId(parts) {
  return parts.join("-").replace(/[^a-zA-Z0-9_-]/g, "-");
}

async function collectDesignTemplates() {
  const out = [];
  const designsRoot = path.join(EXPORT_ROOT, "designs");
  if (!(await exists(designsRoot))) return out;

  const dirs = await fs.readdir(designsRoot, { withFileTypes: true });
  for (const entry of dirs) {
    if (!entry.isDirectory()) continue;

    const baseDir = path.join(designsRoot, entry.name);
    const jsonPath = path.join(baseDir, "design.json");
    const htmlPath = path.join(baseDir, "design.html");

    if (!(await exists(htmlPath))) continue;

    const meta = (await readJson(jsonPath)) || {};
    const html = await fs.readFile(htmlPath, "utf8");

    out.push({
      id: makeId(["sg", "design", String(meta.id || entry.name)]),
      name: cleanName(meta.name || entry.name),
      type: "sendgrid-design",
      thumbUrl: normalizeThumb(meta.thumbnail_url || ""),
      tags: Array.isArray(meta.categories) ? meta.categories : [],
      html,
    });
  }

  return out;
}

async function collectTransactionalTemplates() {
  const out = [];
  const txRoot = path.join(EXPORT_ROOT, "transactional");
  if (!(await exists(txRoot))) return out;

  const dirs = await fs.readdir(txRoot, { withFileTypes: true });
  for (const entry of dirs) {
    if (!entry.isDirectory()) continue;

    const baseDir = path.join(txRoot, entry.name);
    const idx = (await readJson(path.join(baseDir, "index.json"))) || {};
    const files = await fs.readdir(baseDir, { withFileTypes: true });

    for (const f of files) {
      if (!f.isFile() || !f.name.endsWith(".html")) continue;
      const htmlPath = path.join(baseDir, f.name);
      const html = await fs.readFile(htmlPath, "utf8");

      out.push({
        id: makeId(["sg", "tx", String(idx.id || entry.name), f.name.replace(".html", "")]),
        name: cleanName(`${idx.name || entry.name} - ${f.name.replace(".html", "")}`),
        type: "sendgrid-transactional",
        thumbUrl: "",
        tags: [],
        html,
      });
    }
  }

  return out;
}

async function collectSingleSends() {
  const out = [];
  const root = path.join(EXPORT_ROOT, "single-sends");
  if (!(await exists(root))) return out;

  const dirs = await fs.readdir(root, { withFileTypes: true });
  for (const entry of dirs) {
    if (!entry.isDirectory()) continue;

    const baseDir = path.join(root, entry.name);
    const json = (await readJson(path.join(baseDir, "single-send.json"))) || {};
    const htmlPath = path.join(baseDir, "single-send.html");

    if (!(await exists(htmlPath))) continue;

    const html = await fs.readFile(htmlPath, "utf8");
    out.push({
      id: makeId(["sg", "single", String(json.id || entry.name)]),
      name: cleanName(json.name || entry.name),
      type: "sendgrid-single-send",
      thumbUrl: "",
      tags: Array.isArray(json.categories) ? json.categories : [],
      html,
    });
  }

  return out;
}

async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const id = String(req.query.id || "").trim();
    const format = String(req.query.format || "json").toLowerCase();

    const [designs, transactional, singleSends] = await Promise.all([
      collectDesignTemplates(),
      collectTransactionalTemplates(),
      collectSingleSends(),
    ]);

    const templates = [...designs, ...transactional, ...singleSends].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""))
    );

    if (id) {
      const found = templates.find((tpl) => String(tpl.id) === id);
      if (!found) {
        return res.status(404).json({ ok: false, error: "Template not found" });
      }

      if (format === "html") {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.status(200).send(found.html || "");
      }

      return res.status(200).json({ ok: true, template: found });
    }

    const summarized = templates.map(({ html, ...tpl }) => ({
      ...tpl,
      htmlUrl: `/api/email/sendgrid/templates?id=${encodeURIComponent(String(tpl.id))}&format=html`,
    }));

    return res.status(200).json({ ok: true, templates: summarized });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "Failed to load SendGrid templates",
    });
  }
}

export default withAuth(handler);
