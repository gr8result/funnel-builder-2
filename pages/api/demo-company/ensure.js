import { isDeveloperEmail } from "../../../lib/adminUsers";
import { ensureDemoCompanyForUser, DEMO_WORKSPACE_SLUG } from "../../../lib/demoWorkspace";
import { withAuth } from "../../../lib/withWorkspace";

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!isDeveloperEmail(req.user?.email || "")) {
    return res.status(403).json({ ok: false, error: "Developer access required" });
  }

  try {
    const workspace = await ensureDemoCompanyForUser(req.user.id);
    return res.status(200).json({
      ok: true,
      workspace,
      slug: DEMO_WORKSPACE_SLUG,
      message: "Demo Company workspace ensured and current developer user attached as owner.",
    });
  } catch (error) {
    console.error("[demo-company/ensure]", error);
    return res.status(500).json({ ok: false, error: error?.message || "Could not ensure demo company" });
  }
}

export default withAuth(handler);
