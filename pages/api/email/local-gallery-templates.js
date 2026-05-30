import fs from "node:fs/promises";
import path from "node:path";
import { withAuth } from "../../../lib/withWorkspace";

const GALLERY_ROOT = path.join(process.cwd(), "public", "templates", "gallery");
const LEGACY_EMAIL_ROOT = path.join(process.cwd(), "email");

async function walkHtmlFiles(dir) {
  let out = [];
  let entries = [];

  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await walkHtmlFiles(full);
      out = out.concat(nested);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".html")) {
      out.push(full);
    }
  }

  return out;
}

function makeId(v) {
  return String(v).replace(/[^a-zA-Z0-9_-]/g, "-");
}

async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const files = await walkHtmlFiles(GALLERY_ROOT);

    let legacyFiles = [];
    try {
      const entries = await fs.readdir(LEGACY_EMAIL_ROOT, { withFileTypes: true });
      legacyFiles = entries
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".html"))
        .map((e) => path.join(LEGACY_EMAIL_ROOT, e.name));
    } catch {
      legacyFiles = [];
    }

    const publicTemplates = files
      .map((absPath) => {
        const rel = path.relative(path.join(process.cwd(), "public"), absPath).replaceAll("\\", "/");
        const name = path.basename(absPath, ".html");
        const group = rel.split("/")[2] || "gallery";

        return {
          id: makeId(`local-${group}-${name}`),
          name: `${group} - ${name}`,
          type: "local-gallery",
          htmlUrl: `/${rel}`,
          thumbUrl: "",
        };
      });

    const legacyTemplates = await Promise.all(
      legacyFiles.map(async (absPath) => {
        const name = path.basename(absPath, ".html");
        const html = await fs.readFile(absPath, "utf8");
        return {
          id: makeId(`legacy-email-${name}`),
          name: `legacy - ${name}`,
          type: "legacy-email",
          html,
          thumbUrl: "",
        };
      })
    );

    const templates = [...publicTemplates, ...legacyTemplates].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    return res.status(200).json({ ok: true, templates });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "Failed to load local gallery" });
  }
}

export default withAuth(handler);
