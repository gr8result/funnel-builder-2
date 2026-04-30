import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { buildHostedWebsiteUrl, buildWebsitePath, buildWebsiteUrl, getCustomDomainTargetHost, normalizeDomain } from "../../../lib/website-builder/publishConfig";

function getBearerToken(req) {
  const header = String(req.headers.authorization || req.headers.Authorization || "").trim();
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

function buildInstructions(record) {
  const targetHost = getCustomDomainTargetHost();
  return {
    domain: record?.custom_domain || "",
    type: "CNAME",
    name: "www",
    value: targetHost,
    apexHint: `ALIAS/ANAME -> ${targetHost}`,
  };
}

function isMissingPublishedWebsitesTable(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("published_websites") && (message.includes("schema cache") || message.includes("does not exist") || message.includes("could not find the table"));
}

function serialize(record) {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    projectId: record.project_id,
    primaryDomain: record.primary_domain,
    customDomain: record.custom_domain,
    domainStatus: record.domain_status,
    published: !!record.published,
    publishedAt: record.published_at,
    updatedAt: record.updated_at,
    sitePath: buildWebsitePath(record.slug),
    defaultUrl: buildHostedWebsiteUrl({ slug: record.slug }),
    liveUrl: record.custom_domain
      ? buildWebsiteUrl({ slug: record.slug, domain: record.custom_domain })
      : buildHostedWebsiteUrl({ slug: record.slug }),
    dnsTargetHost: getCustomDomainTargetHost(),
    customDomainInstructions: buildInstructions(record),
  };
}

export default async function handler(req, res) {
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ ok: false, error: "Missing Bearer token" });

  const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !userData?.user?.id) {
    return res.status(401).json({ ok: false, error: authError?.message || "Authentication failed" });
  }

  const userId = userData.user.id;

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("published_websites")
      .select("id, project_id, name, slug, primary_domain, custom_domain, domain_status, published, published_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      if (isMissingPublishedWebsitesTable(error)) {
        return res.status(200).json({ ok: true, websites: [], setupRequired: true });
      }
      return res.status(500).json({ ok: false, error: error.message || "Could not load domains" });
    }
    return res.status(200).json({ ok: true, websites: (data || []).map(serialize) });
  }

  if (req.method === "PATCH") {
    const publicationId = String(req.body?.id || "").trim();
    if (!publicationId) return res.status(400).json({ ok: false, error: "Publication id is required" });

    const customDomain = normalizeDomain(req.body?.customDomain || "");
    if (customDomain) {
      const { data: conflicting } = await supabaseAdmin
        .from("published_websites")
        .select("id, user_id")
        .eq("custom_domain", customDomain)
        .neq("id", publicationId)
        .limit(1)
        .maybeSingle();

      if (conflicting && conflicting.user_id !== userId) {
        return res.status(409).json({ ok: false, error: "That custom domain is already connected to another site" });
      }
    }

    const nextPatch = {
      custom_domain: customDomain || null,
      domain_status: customDomain ? "pending_verification" : "generated",
    };

    const { data, error } = await supabaseAdmin
      .from("published_websites")
      .update(nextPatch)
      .eq("id", publicationId)
      .eq("user_id", userId)
      .select("id, project_id, name, slug, primary_domain, custom_domain, domain_status, published, published_at, updated_at")
      .maybeSingle();

    if (error || !data) {
      return res.status(500).json({ ok: false, error: error?.message || "Could not update domain" });
    }

    return res.status(200).json({ ok: true, website: serialize(data) });
  }

  res.setHeader("Allow", "GET, PATCH");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}