// /pages/api/upgrade-email-plan.js
// ✅ Automatic Email Plan Upgrade Handler
// Triggers on usage exceed + daily check
// - Checks Supabase 'accounts' for current usage
// - Compares with plan limits in /data/pricing.js
// - If exceeded: upgrades plan, charges the difference, sends alert via SES

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import nodemailer from "nodemailer";
import PRICING from "../../data/pricing";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// ✅ Amazon SES transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export default async function handler(req, res) {
  try {
    // 1️⃣ Load all accounts with active email marketing
    const { data: accounts, error } = await supabase
      .from("accounts")
      .select("id, email, email_plan_tier, email_subscribers_count, email_emails_sent_month, stripe_customer_id, paypal_subscription_id");

    if (error) throw error;
    if (!accounts || accounts.length === 0) return res.status(200).json({ message: "No accounts found." });

    const upgrades = [];

    for (const acc of accounts) {
      const planKey = acc.email_plan_tier;
      const planData = PRICING[planKey];
      if (!planData || !planData.limits || !planData.upgradeTo) continue;

      const { subscribers, monthlyEmails } = planData.limits;
      const nextTier = planData.upgradeTo ? PRICING[planData.upgradeTo] : null;

      // 2️⃣ Compare usage with limits
      const exceededSubs = subscribers !== "custom" && acc.email_subscribers_count > subscribers;
      const exceededEmails = monthlyEmails !== "custom" && acc.email_emails_sent_month > monthlyEmails;

      if (exceededSubs || exceededEmails) {
        if (!nextTier) continue; // Already at top plan

        // 3️⃣ Charge difference via Stripe or PayPal
        const oldPrice = planData.price;
        const newPrice = nextTier.price;
        const difference = Math.max(newPrice - oldPrice, 0);

        if (difference > 0) {
          if (acc.stripe_customer_id) {
            // Stripe upgrade charge
            await stripe.invoiceItems.create({
              customer: acc.stripe_customer_id,
              amount: Math.round(difference * 100),
              currency: "aud",
              description: `Automatic upgrade to ${nextTier.name}`,
            });
            await stripe.invoices.create({
              customer: acc.stripe_customer_id,
              auto_advance: true,
              description: `Plan upgrade charge difference`,
            });
          } else if (acc.paypal_subscription_id) {
            // PayPal upgrade charge
            await fetch(`https://api-m.paypal.com/v1/billing/subscriptions/${acc.paypal_subscription_id}/revise`, {
              method: "POST",
              headers: {
                Authorization: `Basic ${Buffer.from(
                  process.env.PAYPAL_CLIENT_ID + ":" + process.env.PAYPAL_SECRET
                ).toString("base64")}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                plan: { name: nextTier.name },
                application_context: {
                  brand_name: "Gr8 Result Digital Solutions",
                  user_action: "CONTINUE",
                  return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/billing`,
                },
              }),
            });
          }
        }

        // 4️⃣ Update Supabase with new plan
        await supabase
          .from("accounts")
          .update({
            email_plan_tier: planData.upgradeTo,
            email_plan_effective_date: new Date().toISOString(),
          })
          .eq("id", acc.id);

        // 5️⃣ Send upgrade alert
        await transporter.sendMail({
          from: `"GR8 Result Alerts" <no-reply@yourdomain.com>`,
          to: acc.email,
          subject: `Your plan has been upgraded to ${nextTier.name}`,
          html: `
            <div style="font-family:Arial,sans-serif;padding:20px;">
              <h2>Plan Upgraded Automatically</h2>
              <p>Hi ${acc.email.split("@")[0]},</p>
              <p>You've exceeded your plan limits, so your account has been upgraded to <b>${nextTier.name}</b>.</p>
              <p>The difference of <b>A$${difference.toFixed(2)}</b> has been charged to your payment method.</p>
              <p>You can downgrade again next month if your usage decreases.</p>
              <p>Thank you for being part of GR8 Result Digital Solutions.</p>
              <br/>
              <p style="font-size:13px;opacity:0.8;">This was an automated message. Do not reply.</p>
            </div>
          `,
        });

        upgrades.push({
          accountId: acc.id,
          oldPlan: planKey,
          newPlan: planData.upgradeTo,
          charged: difference,
        });
      }
    }

    return res.status(200).json({
      message: `Upgrade check complete.`,
      upgraded: upgrades.length,
      details: upgrades,
    });
  } catch (err) {
    console.error("❌ Upgrade handler failed:", err);
    return res.status(500).json({ error: err.message });
  }
}
