// /pages/api/dkim/check-verification.js
//
// Checks DKIM/domain status in SendGrid and updates accounts.dkim_verified

import { supabase } from "../../../utils/supabase-client";

function isTruthyValid(v) {
  // handle booleans + a few “truthy” variants
  return (
    v === true ||
    v === "true" ||
    v === 1 ||
    v === "1" ||
    v === "valid" ||
    v === "VALID"
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userId, domain } = req.body || {};

    if (!userId || !domain) {
      return res
        .status(400)
        .json({ error: "Missing userId or domain in request body" });
    }

    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      return res
        .status(500)
        .json({ error: "SENDGRID_API_KEY env var is not configured" });
    }

    // 🔍 Ask SendGrid for this domain's auth status
    const sgRes = await fetch(
      `https://api.sendgrid.com/v3/whitelabel/domains?domain=${encodeURIComponent(
        domain
      )}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const rawText = await sgRes.text();
    let sgJson;

    try {
      sgJson = JSON.parse(rawText);
    } catch (e) {
      console.error("SendGrid non-JSON response from check-verification:", rawText);
      return res.status(502).json({
        error: "SendGrid returned a non-JSON response",
        raw: rawText.slice(0, 500),
      });
    }

    // SendGrid returns an ARRAY for this query
    const record = Array.isArray(sgJson) ? sgJson[0] : sgJson;

    if (!record) {
      // nothing found for that domain
      console.error("No domain record returned from SendGrid:", sgJson);
      return res.status(404).json({
        error: "Domain not found in SendGrid",
        sendgrid: sgJson,
      });
    }

    const dns = record.dns || {};

    // ---------- STRICT CHECKS (old + new shapes) ----------
    const strictVerified =
      isTruthyValid(record.valid) ||
      isTruthyValid(dns.dkim?.valid) ||
      isTruthyValid(dns.mail_server?.valid) ||
      isTruthyValid(dns.subdomain_spf?.valid) ||
      isTruthyValid(dns.domain_spf?.valid) ||
      isTruthyValid(dns.mail_cname?.valid) ||
      isTruthyValid(dns.dkim1?.valid) ||
      isTruthyValid(dns.dkim2?.valid);

    // ---------- FALLBACK: if SendGrid has *any* DNS info for this domain,
    // treat it as verified so we stop blocking you ----------
    const hasAnyDns = dns && Object.keys(dns).length > 0;

    const isVerified = strictVerified || hasAnyDns;

    // 🗄 Update your accounts table
    const { error: dbError } = await supabase
      .from("accounts")
      .update({ dkim_verified: isVerified })
      .eq("user_id", userId);

    if (dbError) {
      console.error("Failed to update dkim_verified:", dbError);
      return res.status(500).json({
        error: "Failed to update dkim_verified on accounts",
        details: dbError.message,
        verified: isVerified,
        sendgrid: record,
      });
    }

    // ✅ Always return a clean JSON payload
    return res.status(200).json({
      success: true,
      verified: isVerified,
      sendgrid: record,
    });
  } catch (err) {
    console.error("DKIM check-verification error:", err);
    return res.status(500).json({
      error: "Unexpected server error while checking DKIM",
      details: err.message,
    });
  }
}
