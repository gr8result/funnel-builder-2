// pages/api/notify-signup.js
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { userId, email, fullName, company, phone, address = {}, tax = {} } = req.body || {};

    // If email creds not configured, just succeed silently.
    if (!resend || !process.env.SIGNUP_NOTIFY_TO || !process.env.SIGNUP_NOTIFY_FROM) {
      return res.status(200).json({ ok: true, skippedEmail: true });
    }

    const html = `
      <h2>New signup</h2>
      <p><b>User ID:</b> ${escapeHtml(userId || "")}</p>
      <p><b>Name:</b> ${escapeHtml(fullName || "")}</p>
      <p><b>Company:</b> ${escapeHtml(company || "")}</p>
      <p><b>Email:</b> ${escapeHtml(email || "")}</p>
      <p><b>Phone:</b> ${escapeHtml(phone || "")}</p>
      <h3>Address</h3>
      <p>
        ${escapeHtml(address.addr1 || "")}<br/>
        ${escapeHtml(address.addr2 || "")}<br/>
        ${escapeHtml(address.city || "")} ${escapeHtml(address.region || "")} ${escapeHtml(address.postcode || "")}<br/>
        ${escapeHtml(address.country || "")}
      </p>
      <h3>Tax</h3>
      <p><b>Type:</b> ${escapeHtml(tax.type || "")}<br/><b>ID:</b> ${escapeHtml(tax.id || "")}</p>
    `;

    await resend.emails.send({
      from: process.env.SIGNUP_NOTIFY_FROM,
      to: process.env.SIGNUP_NOTIFY_TO,
      subject: `New signup: ${company || fullName || email}`,
      html,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
