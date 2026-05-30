import { withAuth } from "../../../lib/withWorkspace";
async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const params = new URLSearchParams();
  params.set("mode", "blank");
  params.set("type", String(req.query.type || "website"));

  if (req.query.name) params.set("name", String(req.query.name));
  if (req.query.theme) params.set("template", String(req.query.theme));

  res.setHeader("Cache-Control", "no-store");
  return res.redirect(307, `/modules/website-builder/visual-builder?${params.toString()}`);
}

export default withAuth(handler);
