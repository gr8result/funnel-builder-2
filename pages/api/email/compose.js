import { randomUUID } from "crypto";
import sendEmail from "../../../lib/sendEmail";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../lib/withWorkspace";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "25mb",
    },
  },
};

const BUCKET = "email-user-assets";
const PUBLIC_ASSET_BUCKET = "public-assets";
const STANDARD_LEGAL_NOTICE =
  "This email and any attachments are intended only for the named recipient. They may contain confidential or privileged information. If you received this email in error, please notify the sender and delete it. Any views expressed are those of the sender unless expressly stated otherwise.";

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function cleanEmail(value) {
  return String(value || "").trim().toLowerCase();
}

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

function storageRoot(userId, workspaceId) {
  return `${userId}/workspaces/${workspaceId}/compose`;
}

async function readJson(path, fallback) {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path);
  if (error || !data) return fallback;
  try {
    const text = typeof data.text === "function" ? await data.text() : String(data);
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function writeJson(path, payload) {
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, JSON.stringify(payload, null, 2), {
      contentType: "application/json",
      upsert: true,
    });
  if (error) throw error;
}

async function listJson(prefix) {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).list(prefix, {
    limit: 100,
    sortBy: { column: "updated_at", order: "desc" },
  });
  if (error || !Array.isArray(data)) return [];

  const rows = [];
  for (const item of data) {
    if (!item?.name || !item.name.endsWith(".json")) continue;
    const row = await readJson(`${prefix}/${item.name}`, null);
    if (row) rows.push(row);
  }
  return rows.sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
}

function normaliseRecipients(input) {
  const list = Array.isArray(input) ? input : [];
  const seen = new Set();
  return list
    .map((entry) => ({
      email: cleanEmail(entry?.email || entry),
      name: String(entry?.name || "").trim(),
      contactId: String(entry?.contactId || entry?.id || "").trim(),
      source: String(entry?.source || "").trim() || (entry?.contactId ? "crm" : "manual"),
    }))
    .filter((entry) => {
      if (!isEmail(entry.email) || seen.has(entry.email)) return false;
      seen.add(entry.email);
      return true;
    });
}

async function getAccountProfile(userId) {
  const { data } = await supabaseAdmin
    .from("accounts")
    .select("business_name, brand_name, company_name, sendgrid_from_name, from_name, sendgrid_from_email, from_email, email, business_phone, phone, website, business_logo_url, business_logo, logo_url")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

function defaultProfiles(user, account) {
  const fromName =
    account?.sendgrid_from_name ||
    account?.from_name ||
    account?.brand_name ||
    account?.business_name ||
    account?.company_name ||
    user?.email ||
    "Business Email";
  const fromEmail =
    account?.sendgrid_from_email ||
    account?.from_email ||
    account?.email ||
    user?.email ||
    process.env.SENDGRID_FROM_EMAIL ||
    "";
  const phone = account?.business_phone || account?.phone || "";
  const website = account?.website || "";
  const logoUrl = account?.business_logo_url || account?.business_logo || account?.logo_url || "";

  return {
    senders: [
      {
        id: "default",
        label: "Default sender",
        fromName,
        fromEmail,
        replyTo: fromEmail,
      },
    ],
    signatures: [
      {
        id: "default",
        label: "Default signature",
        name: fromName,
        title: "",
        phone,
        website,
        logoUrl,
        avatarUrl: "",
        socialLinks: [],
        legalFooter: STANDARD_LEGAL_NOTICE,
      },
    ],
  };
}

function signatureHtml(signature) {
  if (!signature || signature.id === "none") return "";
  const logo = String(signature.logoUrl || signature.avatarUrl || "").trim();
  const socials = Array.isArray(signature.socialLinks) ? signature.socialLinks : [];
  const rows = [
    signature.name,
    signature.title,
    signature.phone,
    signature.website,
  ].filter(Boolean);

  const logoHtml = /^https?:\/\//i.test(logo)
    ? `<td style="padding-right:12px;vertical-align:top;"><img src="${escapeHtml(logo)}" alt="" width="56" style="display:block;width:56px;height:56px;object-fit:cover;border-radius:6px;border:0;" /></td>`
    : "";
  const links = socials
    .filter((link) => link?.url)
    .map((link) => `<a href="${escapeHtml(link.url)}" style="color:#2563eb;text-decoration:none;margin-right:8px;">${escapeHtml(link.label || link.url)}</a>`)
    .join("");
  const legal = signature.legalFooter
    ? `<div style="margin-top:10px;color:#64748b;font-size:12px;line-height:1.4;">${escapeHtml(signature.legalFooter)}</div>`
    : "";

  if (!rows.length && !logoHtml && !links && !legal) return "";

  return `<div style="margin-top:22px;padding-top:14px;border-top:1px solid #e2e8f0;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
      <tr>${logoHtml}<td style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#0f172a;vertical-align:top;">
        ${rows.map((row, index) => `<div style="${index === 0 ? "font-weight:700;" : ""}">${escapeHtml(row)}</div>`).join("")}
        ${links ? `<div style="margin-top:8px;">${links}</div>` : ""}
        ${legal}
      </td></tr>
    </table>
  </div>`;
}

function wrapHtml({ bodyHtml, signature }) {
  const sig = signatureHtml(signature);
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f8fb;font-family:Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f8fb;">
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table role="presentation" width="720" cellspacing="0" cellpadding="0" border="0" style="width:720px;max-width:720px;background:#ffffff;border:1px solid #dbe4ee;">
            <tr>
              <td style="padding:28px;font-size:15px;line-height:1.6;">
                ${String(bodyHtml || "")}
                ${sig}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function appendLeadNotes(workspaceId, sentRecord) {
  const linkedIds = new Set();
  for (const group of ["to", "cc", "bcc"]) {
    for (const recipient of sentRecord.recipients?.[group] || []) {
      if (recipient.contactId) linkedIds.add(recipient.contactId);
    }
  }
  if (!linkedIds.size) return;

  const note = `One-off email sent: "${sentRecord.subject || "(no subject)"}"`;
  for (const leadId of linkedIds) {
    try {
      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("id, notes")
        .eq("id", leadId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (!lead) continue;
      const timestamp = new Date().toISOString();
      const merged = lead.notes ? `${lead.notes}\n\n[${timestamp}] ${note}` : `[${timestamp}] ${note}`;
      await supabaseAdmin
        .from("leads")
        .update({ notes: merged, updated_at: new Date().toISOString() })
        .eq("id", leadId)
        .eq("workspace_id", workspaceId);
    } catch {
      // CRM linking is best-effort; sending should not fail because notes are unavailable.
    }
  }
}

async function linkExistingCrmRecipients(workspaceId, recipients) {
  const all = [...(recipients.to || []), ...(recipients.cc || []), ...(recipients.bcc || [])];
  const emails = [...new Set(all.map((recipient) => cleanEmail(recipient.email)).filter(Boolean))];
  if (!emails.length) return recipients;

  let byEmail = new Map();
  try {
    const { data } = await supabaseAdmin
      .from("leads")
      .select("id, name, email")
      .eq("workspace_id", workspaceId)
      .in("email", emails);
    byEmail = new Map((data || []).map((lead) => [cleanEmail(lead.email), lead]));
  } catch {
    return recipients;
  }

  const enrich = (list = []) =>
    list.map((recipient) => {
      const lead = byEmail.get(cleanEmail(recipient.email));
      if (!lead || recipient.contactId) return recipient;
      return {
        ...recipient,
        name: recipient.name || lead.name || "",
        contactId: lead.id,
        source: "crm",
      };
    });

  return {
    to: enrich(recipients.to),
    cc: enrich(recipients.cc),
    bcc: enrich(recipients.bcc),
  };
}

async function logEmailSends(userId, subject, recipients, messageId) {
  const rows = recipients.map((recipient) => ({
    user_id: userId,
    email: recipient.email,
    recipient_email: recipient.email,
    email_type: "one_off",
    subject,
    status: "sent",
    sent_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    sendgrid_message_id: messageId || null,
  }));
  if (!rows.length) return;
  try {
    await supabaseAdmin.from("email_sends").insert(rows);
  } catch {
    // The compose history JSON remains the source for this screen if analytics schema differs.
  }
}

async function handler(req, res) {
  const userId = req.user.id;
  const workspaceId = req.workspaceId;
  const root = storageRoot(userId, workspaceId);

  if (req.method === "GET") {
    const type = String(req.query?.type || "bootstrap");
    if (type === "profiles" || type === "bootstrap") {
      const account = await getAccountProfile(userId);
      const defaults = defaultProfiles(req.user, account);
      const saved = await readJson(`${root}/profiles.json`, null);
      const profiles = {
        senders: Array.isArray(saved?.senders) && saved.senders.length ? saved.senders : defaults.senders,
        signatures: Array.isArray(saved?.signatures) && saved.signatures.length ? saved.signatures : defaults.signatures,
      };
      if (type === "profiles") return res.status(200).json({ ok: true, profiles });
      const drafts = await listJson(`${root}/drafts`);
      const sent = await listJson(`${root}/sent`);
      return res.status(200).json({ ok: true, profiles, drafts, sent });
    }
    if (type === "drafts") return res.status(200).json({ ok: true, drafts: await listJson(`${root}/drafts`) });
    if (type === "sent") return res.status(200).json({ ok: true, sent: await listJson(`${root}/sent`) });
    return res.status(400).json({ ok: false, error: "Unknown compose list type." });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const action = String(req.body?.action || "").trim();
  const now = new Date().toISOString();

  if (action === "saveProfiles") {
    const profiles = {
      senders: Array.isArray(req.body?.senders) ? req.body.senders : [],
      signatures: Array.isArray(req.body?.signatures) ? req.body.signatures : [],
      updatedAt: now,
    };
    await writeJson(`${root}/profiles.json`, profiles);
    return res.status(200).json({ ok: true, profiles });
  }

  if (action === "uploadLogo") {
    const filename = String(req.body?.filename || "logo.png").replace(/[^a-zA-Z0-9._-]+/g, "-");
    const contentType = String(req.body?.contentType || "image/png");
    const content = String(req.body?.content || "");
    if (!content) return res.status(400).json({ ok: false, error: "Missing logo file." });
    if (!contentType.startsWith("image/")) {
      return res.status(400).json({ ok: false, error: "Logo must be an image file." });
    }

    const extension = filename.includes(".") ? filename.split(".").pop() : "png";
    const path = `email-compose-logos/${userId}/${workspaceId}/${Date.now()}-${randomUUID()}.${extension}`;
    const { error } = await supabaseAdmin.storage
      .from(PUBLIC_ASSET_BUCKET)
      .upload(path, Buffer.from(content, "base64"), {
        contentType,
        upsert: false,
      });
    if (error) return res.status(500).json({ ok: false, error: error.message || "Logo upload failed." });

    const { data } = supabaseAdmin.storage.from(PUBLIC_ASSET_BUCKET).getPublicUrl(path);
    return res.status(200).json({ ok: true, url: data?.publicUrl || "" });
  }

  if (action === "saveDraft") {
    const draft = req.body?.draft || {};
    const id = String(draft.id || randomUUID());
    const payload = {
      ...draft,
      id,
      status: "draft",
      userId,
      workspaceId,
      createdAt: draft.createdAt || now,
      updatedAt: now,
    };
    await writeJson(`${root}/drafts/${id}.json`, payload);
    return res.status(200).json({ ok: true, draft: payload });
  }

  if (action === "deleteDraft") {
    const id = String(req.body?.id || "").trim();
    if (!id) return res.status(400).json({ ok: false, error: "Missing draft id." });
    await supabaseAdmin.storage.from(BUCKET).remove([`${root}/drafts/${id}.json`]);
    return res.status(200).json({ ok: true });
  }

  if (action === "send") {
    const compose = req.body?.compose || {};
    const mode = req.body?.mode === "test" ? "test" : "send";
    const sender = compose.sender || {};
    const signature = compose.signature || null;
    const subject = String(compose.subject || "").trim();
    const bodyHtml = String(compose.bodyHtml || "").trim();
    const previewText = String(compose.previewText || "").trim();
    const recipients = {
      to: normaliseRecipients(compose.recipients?.to),
      cc: normaliseRecipients(compose.recipients?.cc),
      bcc: normaliseRecipients(compose.recipients?.bcc),
    };
    const testTo = cleanEmail(req.body?.testTo);
    const linkedRecipients = mode === "test"
      ? { to: [{ email: testTo, name: "", source: "manual" }], cc: [], bcc: [] }
      : await linkExistingCrmRecipients(workspaceId, recipients);
    const to = linkedRecipients.to;
    const cc = linkedRecipients.cc;
    const bcc = linkedRecipients.bcc;

    if (!subject) return res.status(400).json({ ok: false, error: "Subject is required." });
    if (!bodyHtml || bodyHtml === "<br>") return res.status(400).json({ ok: false, error: "Message body is required." });
    if (!to.length || !to.every((entry) => isEmail(entry.email))) {
      return res.status(400).json({ ok: false, error: mode === "test" ? "Enter a valid test recipient." : "Add at least one valid To recipient." });
    }

    const account = await getAccountProfile(userId);
    const defaults = defaultProfiles(req.user, account);
    const fallbackSender = defaults.senders[0];
    const fromEmail = cleanEmail(sender.fromEmail) || cleanEmail(fallbackSender.fromEmail) || cleanEmail(process.env.SENDGRID_FROM_EMAIL);
    const fromName = String(sender.fromName || fallbackSender.fromName || process.env.SENDGRID_FROM_NAME || "Business Email").trim();
    const replyTo = cleanEmail(sender.replyTo) || fromEmail;

    if (!isEmail(fromEmail)) return res.status(400).json({ ok: false, error: "A valid sender email is required." });

    const html = wrapHtml({ bodyHtml, signature });
    const attachments = (Array.isArray(compose.attachments) ? compose.attachments : [])
      .filter((file) => file?.content && file?.filename)
      .map((file) => ({
        content: String(file.content),
        filename: String(file.filename),
        type: String(file.type || "application/octet-stream"),
        disposition: "attachment",
      }));

    const result = await sendEmail({
      to: to.map((entry) => entry.email),
      cc: cc.map((entry) => entry.email),
      bcc: bcc.map((entry) => entry.email),
      from: { email: fromEmail, name: fromName },
      replyTo,
      subject,
      html,
      text: stripHtml(html),
      attachments,
    });

    if (!result?.ok) {
      return res.status(500).json({ ok: false, error: result?.error || "Email send failed." });
    }

    const id = String(compose.id || randomUUID());
    const sentRecord = {
      ...compose,
      id,
      status: mode === "test" ? "test_sent" : "sent",
      sender: { ...sender, fromEmail, fromName, replyTo },
      recipients: linkedRecipients,
      subject,
      previewText,
      bodyHtml,
      renderedHtml: html,
      attachments: attachments.map(({ content, ...meta }) => ({ ...meta, size: meta.size || null })),
      userId,
      workspaceId,
      sentAt: now,
      createdAt: compose.createdAt || now,
      updatedAt: now,
    };

    await writeJson(`${root}/sent/${id}.json`, sentRecord);
    if (mode !== "test") {
      await appendLeadNotes(workspaceId, sentRecord);
      await logEmailSends(userId, subject, [...to, ...cc, ...bcc], null);
      if (compose.draftId) {
        await supabaseAdmin.storage.from(BUCKET).remove([`${root}/drafts/${compose.draftId}.json`]);
      }
    }

    return res.status(200).json({ ok: true, sent: sentRecord });
  }

  return res.status(400).json({ ok: false, error: "Unknown compose action." });
}

export default withWorkspace(handler);
