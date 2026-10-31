import { resolveTxt } from "node:dns/promises";
import { withAuth } from "../../../lib/withWorkspace";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

function isValid(value) {
  return value === true || value === 1 || String(value || "").toLowerCase() === "true" || String(value || "").toLowerCase() === "valid";
}

function hasDmarcRecord(records = []) {
  return records.flat().some((record) => /^v=DMARC1(?:\s*;|\s|$)/i.test(String(record || "").trim()));
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Use POST." });
  }

  const domain = String(req.body?.domain || "").trim().toLowerCase().replace(/\.$/, "");
  if (!domain || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
    return res.status(400).json({ success: false, error: "Provide a valid sending domain." });
  }

  const apiKey = process.env.SENDGRID_API_KEY || process.env.GR8_MAIL_SEND_ONLY;
  if (!apiKey) return res.status(503).json({ success: false, error: "SendGrid provider credentials are not configured." });

  try {
    const userId = req.user.id;
    const { data: account, error: accountError } = await supabaseAdmin
      .from("accounts")
      .select("dkim_domain,sendgrid_from_email,from_email")
      .eq("user_id", userId)
      .maybeSingle();
    if (accountError) return res.status(500).json({ success: false, error: "Could not load sender settings." });
    if (!account) return res.status(404).json({ success: false, error: "No sender settings were found for this account." });

    const configuredDomain = String(account.dkim_domain || "").trim().toLowerCase().replace(/\.$/, "");
    if (configuredDomain && configuredDomain !== domain) {
      return res.status(403).json({ success: false, error: "The requested domain does not match this account's configured sending domain." });
    }
    const senderEmail = String(account.sendgrid_from_email || process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM || "").trim().toLowerCase();
    const senderDomain = senderEmail.split("@").pop() || "";
    if (!senderEmail.includes("@") || !(senderDomain === domain || senderDomain.endsWith(`.${domain}`))) {
      return res.status(400).json({ success: false, error: "Configure a sender email on the requested sending domain before verification." });
    }

    const response = await fetch(`https://api.sendgrid.com/v3/whitelabel/domains?domain=${encodeURIComponent(domain)}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    if (!response.ok) {
      return res.status(response.status === 404 ? 404 : 502).json({
        success: false,
        error: response.status === 404 ? "Domain not found in SendGrid." : "SendGrid could not verify this domain right now.",
        providerStatus: response.status,
      });
    }
    const payload = await response.json();
    const records = Array.isArray(payload) ? payload : [payload];
    const record = records.find((item) => String(item?.domain || "").trim().toLowerCase() === domain);
    if (!record) return res.status(404).json({ success: false, error: "No matching SendGrid domain record was found." });

    const dkim = isValid(record.dns?.dkim1?.valid) && isValid(record.dns?.dkim2?.valid);
    const spf = isValid(record.dns?.mail_cname?.valid)
      || isValid(record.dns?.subdomain_spf?.valid)
      || isValid(record.dns?.domain_spf?.valid);
    let dmarc = false;
    try {
      dmarc = hasDmarcRecord(await resolveTxt(`_dmarc.${domain}`));
    } catch {
      dmarc = false;
    }
    const verified = isValid(record.valid) && dkim && spf && dmarc;

    const { error: updateError } = await supabaseAdmin
      .from("accounts")
      .update({ dkim_verified: verified, dkim_domain: domain })
      .eq("user_id", userId);
    if (updateError) return res.status(500).json({ success: false, error: "Could not save the verification result." });

    return res.status(200).json({
      success: true,
      verified,
      domain,
      checks: { sendgrid: isValid(record.valid), dkim, spf, dmarc, spfRecord: record.dns?.mail_cname?.valid ? "sendgrid-return-path-cname" : "txt-or-subdomain-spf" },
      message: verified
        ? "Sending domain authentication passed SendGrid, DKIM, SPF, and DMARC checks."
        : "Domain is not ready. Resolve each failed check before sending.",
    });
  } catch (error) {
    console.error("DKIM verification check failed:", error?.message || error);
    return res.status(502).json({ success: false, error: "Domain verification could not be completed. Check provider access and retry." });
  }
}

export default withAuth(handler);