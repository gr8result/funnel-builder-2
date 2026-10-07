import { withWorkspace } from "../../../lib/withWorkspace";
import {
  assignCurrentStandardInclusionsToProject,
  getAssignedProjectInclusions,
  NO_ACTIVE_STANDARD_INCLUSIONS_MASTER_CODE,
} from "../../../lib/builders/projectInclusionsAssignment";

async function handler(req, res) {
  const { workspaceId, user } = req;
  const projectId = String(req.method === "GET" ? req.query.projectId || "" : req.body?.projectId || "").trim();
  const estimateId = String(req.method === "GET" ? req.query.estimateId || "" : req.body?.estimateId || "").trim();

  if (!projectId) return res.status(400).json({ ok: false, error: "projectId is required." });

  try {
    if (req.method === "GET") {
      const document = await getAssignedProjectInclusions({ workspaceId, projectId });
      return res.status(200).json({ ok: true, document });
    }

    if (req.method === "POST") {
      const action = String(req.body?.action || "").trim();
      if (action !== "useCurrentStandard") {
        return res.status(400).json({ ok: false, error: "Unsupported project inclusions action." });
      }
      if (!req.body?.confirmed) {
        return res.status(400).json({ ok: false, error: "Use Current Standard requires explicit confirmation." });
      }
      const document = await assignCurrentStandardInclusionsToProject({
        workspaceId,
        projectId,
        estimateId,
        userId: user.id,
        force: true,
      });
      return res.status(200).json({ ok: true, document });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    const code = error?.code || "";
    const statusCode = code === NO_ACTIVE_STANDARD_INCLUSIONS_MASTER_CODE
      ? 409
      : Number(error?.statusCode || 500);
    return res.status(statusCode).json({
      ok: false,
      error: error?.message || "Project inclusions request failed.",
      ...(code ? { code } : {}),
    });
  }
}

export default withWorkspace(handler);
