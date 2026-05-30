// API route for listing and loading external website builder templates (server-only)
import fs from "fs";
import path from "path";
import { withAuth } from "../../../lib/withWorkspace";

async function handler(req, res) {
  const base = path.join(process.cwd(), "lib", "website-builder", "external-templates");
  if (req.method === "GET") {
    // List all templates
    if (!fs.existsSync(base)) return res.status(200).json([]);
    const templates = fs
      .readdirSync(base, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => {
        const slug = d.name;
        const jsonPath = path.join(base, slug, "template.json");
        if (fs.existsSync(jsonPath)) {
          try {
            const raw = fs.readFileSync(jsonPath, "utf8");
            const meta = JSON.parse(raw);
            return { slug, ...meta };
          } catch {}
        }
        return null;
      })
      .filter(Boolean);
    return res.status(200).json(templates);
  }
  if (req.method === "POST") {
    // Load a specific template by slug
    const { slug } = req.body || {};
    if (!slug) return res.status(400).json({ error: "Missing slug" });
    const templatePath = path.join(base, slug, "template.json");
    if (fs.existsSync(templatePath)) {
      try {
        const raw = fs.readFileSync(templatePath, "utf8");
        const meta = JSON.parse(raw);
        return res.status(200).json(meta);
      } catch (e) {
        return res.status(500).json({ error: "Failed to parse template" });
      }
    }
    return res.status(404).json({ error: "Template not found" });
  }
  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}

export default withAuth(handler);
