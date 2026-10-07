import { isDeveloperEmail } from "../../../lib/adminUsers";
import { DEMO_WORKSPACE_ID, isDemoWorkspace } from "../../../lib/demoWorkspace";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withWorkspace";

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!isDeveloperEmail(req.user?.email || "")) {
    return res.status(403).json({ ok: false, error: "Developer access required" });
  }

  if (!(await isDemoWorkspace(DEMO_WORKSPACE_ID))) {
    return res.status(409).json({ ok: false, error: "Known Demo Company workspace is missing or not marked as demo." });
  }

  const { data, error } = await supabaseAdmin.rpc("reset_demo_company_stage2");
  if (error) {
    return res.status(500).json({ ok: false, error: error.message || "Demo reset failed" });
  }

  return res.status(200).json({ ok: true, result: data });
}

export default withAuth(handler);
