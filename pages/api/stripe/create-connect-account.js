import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { withAuth } from "../../../lib/withWorkspace";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

// 🔐 Admin Supabase client (REQUIRED for auth.admin)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const userId = req.user.id;

    // 🌍 Resolve base URL safely
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.APP_URL ||
      process.env.BASE_URL ||
      "http://localhost:3000";

    // 👤 Fetch user from Supabase Auth
    const { data: userData, error } =
      await supabaseAdmin.auth.admin.getUserById(userId);

    if (error || !userData?.user) {
      console.error("Supabase user fetch error:", error);
      return res.status(404).json({ error: "User not found" });
    }

    const userEmail = userData.user.email;

    if (!userEmail) {
      return res.status(400).json({ error: "User has no email" });
    }

    // 💳 Create Stripe Express account
    const account = await stripe.accounts.create({
      type: "express",
      country: "AU",
      email: userEmail,
      capabilities: {
        transfers: { requested: true },
      },
    });

    // 💾 Save Stripe account ID in user metadata
    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          stripe_account_id: account.id,
          stripe_account_type: "affiliate",
        },
      });

    if (updateError) {
      console.error("Supabase update error:", updateError);
      return res.status(500).json({ error: "Failed to update user metadata" });
    }

    // 🔗 Create Stripe onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${baseUrl}/modules/affiliates/affiliate-dashboard`,
      return_url: `${baseUrl}/modules/affiliates/affiliate-dashboard`,
      type: "account_onboarding",
    });

    return res.status(200).json({ url: accountLink.url });
  } catch (err) {
    console.error("Stripe onboarding error:", err);
    return res.status(500).json({ error: err.message });
  }
}

export default withAuth(handler);
