import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getAppHost, getCustomDomainTargetHost, normalizeDomain } from "../../../lib/website-builder/publishConfig";
import { withAuth } from "../../../lib/withWorkspace";
import { getRequestDemoState, requestWorkspaceId, demoSimulationResult } from "../../../lib/demoWorkspace";
import {
  assertWebsiteUnlockedForMutation,
  getWebsiteUnlockTokenFromRequest,
  markWebsiteMutationCommitted,
  websiteLockedResponse,
} from "../../../lib/website-builder/contentLock";

function getBearerToken(req) {
  const header = String(req.headers.authorization || req.headers.Authorization || "").trim();
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

async function resolveDns(name, type) {
  const url = `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`;
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const json = await response.json().catch(() => ({}));
  return Array.isArray(json?.Answer) ? json.Answer.map((entry) => String(entry?.data || "").replace(/\.$/, "")) : [];
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ ok: false, error: "Missing Bearer token" });

  const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !userData?.user?.id) {
    return res.status(401).json({ ok: false, error: authError?.message || "Authentication failed" });
  }

  const publicationId = String(req.body?.id || "").trim();
  if (!publicationId) return res.status(400).json({ ok: false, error: "Publication id is required" });
  const unlockToken = getWebsiteUnlockTokenFromRequest(req);
  const workspaceId = requestWorkspaceId(req);
  const demoState = await getRequestDemoState(req);

  let recordQuery = supabaseAdmin
    .from("published_websites")
    .select("id, user_id, workspace_id, project_id, primary_domain, custom_domain, domain_status")
    .eq("id", publicationId)
    .eq("user_id", userData.user.id)
    .limit(1);

  if (workspaceId) {
    recordQuery = recordQuery.eq("workspace_id", workspaceId);
  }

  const { data: record, error } = await recordQuery.maybeSingle();

  if (error || !record) return res.status(404).json({ ok: false, error: error?.message || "Website not found" });
  if (!record.custom_domain) return res.status(400).json({ ok: false, error: "No custom domain set for this site" });
  const lock = assertWebsiteUnlockedForMutation({
    projectId: record.project_id || "",
    userId: userData.user.id,
    unlockToken,
    action: "domain-verify",
  });
  if (!lock.ok) return websiteLockedResponse(res, lock);

  if (demoState.isDemo) {
    const customDomain = normalizeDomain(record.custom_domain);
    const simulated = await demoSimulationResult({
      workspaceId,
      userId: userData.user.id,
      actionType: "custom-domain-verify",
      provider: "website-builder",
      target: customDomain,
      payload: { publicationId, customDomain },
      message: "Demo custom domain verification simulated - no DNS lookup or real verification performed.",
    });
    markWebsiteMutationCommitted({ projectId: record.project_id || "", unlockToken, action: "save" });
    return res.status(200).json({
      ok: true,
      demo: true,
      simulated: true,
      verified: false,
      status: "demo_simulated",
      cnameAnswers: [],
      aAnswers: [],
      message: simulated.message,
    });
  }

  const customDomain = normalizeDomain(record.custom_domain);
  const primaryDomain = normalizeDomain(record.primary_domain);
  const appHost = getAppHost();
  const customDomainTarget = getCustomDomainTargetHost();

  try {
    const cnameAnswers = await resolveDns(customDomain, "CNAME");
    const aAnswers = await resolveDns(customDomain, "A");

    const verifiedByCname = cnameAnswers.some((value) => {
      const normalized = normalizeDomain(value);
      return normalized === customDomainTarget || normalized === primaryDomain || normalized === appHost;
    });

    const nextStatus = verifiedByCname
      ? "verified"
      : aAnswers.length
        ? "manual_review_required"
        : "pending_verification";

    let updateQuery = supabaseAdmin
      .from("published_websites")
      .update({ domain_status: nextStatus })
      .eq("id", record.id)
      .eq("user_id", userData.user.id);

    if (workspaceId) {
      updateQuery = updateQuery.eq("workspace_id", workspaceId);
    }

    await updateQuery;
    markWebsiteMutationCommitted({ projectId: record.project_id || "", unlockToken, action: "save" });

    return res.status(200).json({
      ok: true,
      verified: verifiedByCname,
      status: nextStatus,
      cnameAnswers,
      aAnswers,
      message: verifiedByCname
        ? "Custom domain verified."
        : aAnswers.length
          ? "A records were found, but this may need ALIAS/ANAME support or manual review."
          : "No matching DNS records found yet.",
    });
  } catch (verifyError) {
    return res.status(500).json({ ok: false, error: verifyError?.message || "Could not verify DNS" });
  }
}

export default withAuth(handler);
