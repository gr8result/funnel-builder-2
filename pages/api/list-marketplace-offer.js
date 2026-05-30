// /pages/api/list-marketplace-offer.js
import sgMail from "@sendgrid/mail";
import { withAuth } from "../../lib/withWorkspace";

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, business, phone, email, comments } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: "Name and Email required." });
  }

  const html = `
    <h2>New Marketplace Offer Submission</h2>
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Business Name:</strong> ${business || "—"}</p>
    <p><strong>Phone:</strong> ${phone || "—"}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Comments:</strong> ${comments || "—"}</p>
    <hr />
    <p>This message was submitted via the Xchange Marketplace form.</p>
  `;

  const msg = {
    to: "support@gr8result.com",
    from: "no-reply@gr8result.com", // must be a verified sender in SendGrid!
    subject: "New Marketplace Listing Request",
    html,
  };

  try {
    await sgMail.send(msg);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("SendGrid error:", error?.response?.body || error.message);
    res.status(500).json({ error: "Email failed to send." });
  }
}

export default withAuth(handler);
