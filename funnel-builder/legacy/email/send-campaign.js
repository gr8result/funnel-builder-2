import nodemailer from "nodemailer";
import { supabase } from "@/services/supabase-client";

/**
 * Very simple send:
 * - Loads campaigns + template HTML
 * - Sends to ALL active subscribers (org_id scoping can be added when you pass it)
 * - Records a basic event row per send (optional)
 */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { campaignsId } = req.body;
    if (!campaignsId) return res.status(400).json({ error: "campaignsId required" });

    // Load campaigns
    const { data: campaigns, error: cErr } = await supabase
      .from("email_campaigns")
      .select("*")
      .eq("id", campaignsId)
      .single();
    if (cErr || !campaigns) throw new Error(cErr?.message || "campaigns not found");

    // Load template if any
    let html = "<p>Hello.</p>";
    if (campaigns.template_id) {
      const { data: t } = await supabase
        .from("email_templates")
        .select("html")
        .eq("id", campaigns.template_id)
        .single();
      if (t?.html) html = t.html;
    }

    // Load recipients â€” here we keep it simple: all active subscribers
    const { data: recipients, error: rErr } = await supabase
      .from("subscribers")
      .select("email")
      .eq("status", "active");
    if (rErr) throw new Error(rErr.message);

    if (!recipients || recipients.length === 0) {
      return res.status(200).json({ ok: true, sent: 0 });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    let sent = 0;
    for (const r of recipients) {
      await transporter.sendMail({
        from: `"${campaigns.from_name}" <${campaigns.from_email}>`,
        to: r.email,
        subject: campaigns.name || "Newsletter",
        html,
      });
      sent++;
      // Optional event record (simplified)
      await supabase.from("email_events").insert([{
        campaigns_id: campaigns.id,
        subscriber_id: null,
        type: "delivered",
      }]);
    }

    await supabase.from("email_campaigns").update({ status: "sent" }).eq("id", campaigns.id);
    return res.status(200).json({ ok: true, sent });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}




