import { createClient } from "@supabase/supabase-js";
import sendEmail from "../../../lib/sendEmail";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function stripHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeFileName(value) {
  return String(value || "quotation")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "quotation";
}

function multilineToHtml(value) {
  const lines = String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return "";
  return lines.map((line) => `<div style=\"margin:0 0 8px;\">${escapeHtml(line)}</div>`).join("");
}

function buildEmailBody({ recipientName, customMessage, signature, companyName, logoUrl, quoteNumber }) {
  const safeName = escapeHtml(recipientName || "there");
  const intro = multilineToHtml(customMessage) || `<div style=\"margin:0 0 8px;\">Hi ${safeName},</div><div style=\"margin:0 0 8px;\">Please find your quotation attached as a PDF.</div>`;
  const sig = multilineToHtml(signature);
  const safeLogo = /^https?:\/\//i.test(String(logoUrl || "")) ? String(logoUrl) : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f7fb;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="680" cellspacing="0" cellpadding="0" border="0" style="width:680px;max-width:680px;background:#ffffff;border:1px solid #dbe4ee;">
            <tr>
              <td style="padding:18px 22px;background:#1d4ed8;color:#ffffff;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    ${safeLogo ? `<td width="130" valign="middle"><img src="${escapeHtml(safeLogo)}" alt="${escapeHtml(companyName || "Company logo")}" width="120" style="display:block;max-width:120px;height:auto;border:0;outline:none;text-decoration:none;" /></td>` : ""}
                    <td valign="middle" style="font-size:20px;font-weight:700;line-height:1.3;">${escapeHtml(companyName || "Quotation")}<div style="font-size:13px;font-weight:400;opacity:0.92;">Quote ${escapeHtml(quoteNumber || "")}</div></td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;font-size:15px;line-height:1.6;">
                ${intro}
                <div style="margin-top:16px;padding:12px 14px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;">
                  Your quotation is attached as a PDF for easy viewing and forwarding.
                </div>
                ${sig ? `<div style="margin-top:20px;padding-top:14px;border-top:1px solid #e2e8f0;">${sig}</div>` : ""}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function makePdfFriendlyHtml(html) {
  return String(html || "")
    .replace(/<img\b[^>]*src=["']data:image\/[^"']{2000000,}["'][^>]*>/gi, "")
    .replace(/url\((['"]?)data:image\/[^)'"]{2000000,}\1\)/gi, "none");
}

async function renderPdfBuffer(html) {
  let puppeteer = null;
  try {
    const reqq = eval("require"); // eslint-disable-line no-eval
    puppeteer = reqq("puppeteer");
  } catch {
    try {
      const reqq = eval("require"); // eslint-disable-line no-eval
      puppeteer = reqq("puppeteer-core");
    } catch {
      puppeteer = null;
    }
  }

  if (!puppeteer) {
    throw new Error("PDF rendering is unavailable on this server.");
  }

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: "new",
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 2000 });
    await page.setContent(String(html || ""), { waitUntil: "networkidle0" });
    await page.emulateMediaType("screen");
    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" },
    });
  } finally {
    await browser.close();
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "POST only" });
  }

  try {
    const { to, subject, html, userId, leadName, quoteNumber, message, signature, companyName: companyNameFromBody, companyEmail: companyEmailFromBody, companyPhone: companyPhoneFromBody, companyWebsite: companyWebsiteFromBody, companyLogoUrl: companyLogoUrlFromBody } = req.body || {};

    if (!to || !String(to).includes("@")) {
      return res.status(400).json({ ok: false, error: "A valid recipient email is required." });
    }

    if (!subject || !String(subject).trim()) {
      return res.status(400).json({ ok: false, error: "Email subject is required." });
    }

    if (!html || !String(html).trim()) {
      return res.status(400).json({ ok: false, error: "Email HTML is required." });
    }

    let fromEmail = process.env.SENDGRID_FROM_EMAIL || "no-reply@gr8result.com";
    let fromName = process.env.SENDGRID_FROM_NAME || "GR8 RESULT";
    let companyPhone = String(companyPhoneFromBody || "").trim();
    let companyWebsite = String(companyWebsiteFromBody || "").trim();
    let logoUrl = String(companyLogoUrlFromBody || "").trim();

    if (SUPABASE_URL && SERVICE_KEY && userId) {
      try {
        const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: account } = await admin
          .from("accounts")
          .select("business_name, brand_name, company_name, sendgrid_from_name, from_name, sendgrid_from_email, from_email, email, business_phone, phone, website, business_logo_url, business_logo, logo_url")
          .eq("user_id", userId)
          .maybeSingle();

        fromEmail =
          account?.sendgrid_from_email ||
          account?.from_email ||
          companyEmailFromBody ||
          process.env.SENDGRID_FROM_EMAIL ||
          "no-reply@gr8result.com";

        fromName =
          account?.sendgrid_from_name ||
          account?.from_name ||
          account?.brand_name ||
          account?.business_name ||
          account?.company_name ||
          companyNameFromBody ||
          process.env.SENDGRID_FROM_NAME ||
          "GR8 RESULT";

        companyPhone = account?.business_phone || account?.phone || companyPhone;
        companyWebsite = account?.website || companyWebsite;
        logoUrl = account?.business_logo_url || account?.business_logo || account?.logo_url || logoUrl;
      } catch (err) {
        console.warn("CRM email branding lookup failed:", err?.message || err);
      }
    }

    const pdfHtml = makePdfFriendlyHtml(String(html));
    const pdfBuffer = await renderPdfBuffer(pdfHtml);
    const resolvedSignature =
      String(signature || "").trim() ||
      [fromName, fromEmail, companyPhone, companyWebsite].filter(Boolean).join("\n");

    const emailHtml = buildEmailBody({
      recipientName: leadName,
      customMessage: message,
      signature: resolvedSignature,
      companyName: companyNameFromBody || fromName,
      logoUrl,
      quoteNumber,
    });

    const result = await sendEmail({
      to,
      from: { email: fromEmail, name: fromName },
      subject: String(subject).trim(),
      html: emailHtml,
      text: stripHtml(emailHtml),
      attachments: [
        {
          content: Buffer.from(pdfBuffer).toString("base64"),
          filename: `${safeFileName(quoteNumber || subject)}.pdf`,
          type: "application/pdf",
          disposition: "attachment",
        },
      ],
    });

    if (!result?.ok) {
      return res.status(500).json({
        ok: false,
        error: result?.error || "Email send failed.",
      });
    }

    return res.status(200).json({ ok: true, pdfAttached: true });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "Server error",
    });
  }
}
