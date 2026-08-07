import { withWorkspace } from "../../../../lib/withWorkspace";
import { storeCanvaRenderedPages } from "../../../../lib/standard-inclusions/canvaFirstSchedule";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "80mb",
    },
  },
};

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  try {
    const documentId = String(req.body?.documentId || "");
    if (!documentId) return res.status(400).json({ ok: false, code: "STANDARD_INCLUSIONS_DOCUMENT_REQUIRED", error: "A Standard Inclusions Canva document is required." });
    const result = await storeCanvaRenderedPages({
      workspaceId: req.workspaceId,
      userId: req.user.id,
      documentId,
      pages: Array.isArray(req.body?.pages) ? req.body.pages : [],
      refreshMode: req.body?.refreshMode === "replace-all" ? "replace-all" : "keep-compatible",
    });
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      code: error.code || "CANVA_RENDERED_PAGES_FAILED",
      error: error.message || "Could not store rendered Canva schedule pages.",
    });
  }
}

export default withWorkspace(handler, { roles: ["owner", "admin"] });
