/**
 * Example: Onboarding Approval Endpoint
 * 
 * When a user's application is approved, call this to:
 * 1. Create their SMS subaccount in SMSGlobal
 * 2. Fund the subaccount with initial credit
 * 3. Store their subaccount credentials
 * 4. Enable SMS for their account
 * 
 * This is a reference implementation showing the full workflow
 */

import { createSmsGlobalSubaccount } from "../../../lib/smsglobal/create-subaccount.js";
import { topupSubaccount } from "../../../lib/smsglobal/topup-subaccount.js";
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";

// Amount of initial SMS credit to give each new user (in your account currency, e.g., AUD)
const INITIAL_SMS_CREDIT = 50;  // $50 AUD or equivalent

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { userId, businessName, email, applicationId } = req.body;

  if (!userId || !businessName || !email) {
    return res.status(400).json({
      ok: false,
      error: "Missing userId, businessName, or email",
    });
  }

  try {
    console.log("🎯 Processing application approval:", {
      userId,
      businessName,
      email,
    });

    // Step 1: Create SMS subaccount in SMSGlobal
    console.log("📡 Creating SMSGlobal subaccount...");
    const {
      ok: smsOk,
      sender_id,
      sms_api_key,
      sms_api_secret,
      error: smsError,
    } = await createSmsGlobalSubaccount(
      businessName,
      email,
      process.env.SMSGLOBAL_API_KEY,
      process.env.SMSGLOBAL_API_SECRET
    );

    if (!smsOk) {
      console.error("❌ Failed to create SMS subaccount:", smsError);
      return res.status(500).json({
        ok: false,
        error: "Failed to create SMS subaccount",
        detail: smsError,
      });
    }

    console.log("✅ SMS subaccount created:", { sender_id });

    // Step 2: Fund the subaccount with initial credit
    console.log(`💰 Topping up subaccount with $${INITIAL_SMS_CREDIT}...`);
    const { ok: topupOk, new_balance, error: topupError } = await topupSubaccount(
      sender_id,
      INITIAL_SMS_CREDIT,
      process.env.SMSGLOBAL_API_KEY,
      process.env.SMSGLOBAL_API_SECRET
    );

    if (!topupOk) {
      console.error("❌ Failed to fund subaccount:", topupError);
      // Don't fail the whole approval - let them know but allow SMS setup to continue
      console.warn("⚠️  Subaccount created but funding failed. Will need manual top-up.");
    } else {
      console.log("✅ Subaccount funded:", { new_balance, initial_credit: INITIAL_SMS_CREDIT });
    }

    // Step 3: Update user's account with SMS credentials
    console.log("💾 Storing SMS credentials in user account...");
    const { error: updateErr } = await supabaseAdmin
      .from("accounts")
      .update({
        sender_id,  // Subaccount ID (for routing/billing)
        sms_api_key,  // Subaccount API key
        sms_api_secret,  // Subaccount API secret
        sms_initial_credit: INITIAL_SMS_CREDIT,  // Record of initial funding
        sms_current_balance: topupOk ? new_balance : 0,  // Current balance
        sms_activated: topupOk ? true : false,  // Only activate if funded
        sms_enabled_at: topupOk ? new Date().toISOString() : null,
      })
      .eq("user_id", userId);

    if (updateErr) {
      console.error("❌ Failed to update account with SMS credentials:", updateErr);
      return res.status(500).json({
        ok: false,
        error: "Failed to store SMS credentials",
        detail: updateErr.message,
      });
    }

    console.log("✅ SMS credentials stored");

    // Step 4: Mark application as approved (in your applications table)
    if (applicationId) {
      try {
        await supabaseAdmin
          .from("applications")  // Adjust table name as needed
          .update({
            status: "approved",
            approved_at: new Date().toISOString(),
            sms_subaccount_id: sender_id,  // Reference for records
          })
          .eq("id", applicationId);

        console.log("✅ Application marked as approved");
      } catch (appErr) {
        console.warn("⚠️ Could not update application record:", appErr);
        // Don't fail the whole flow if this fails
      }
    }

    const successMessage = topupOk
      ? `SMS activated with $${INITIAL_SMS_CREDIT} initial credit`
      : "SMS created but funding failed - requires manual top-up";

    return res.status(200).json({
      ok: true,
      message: "Application approved and SMS " + (topupOk ? "activated" : "setup incomplete"),
      user_id: userId,
      business_name: businessName,
      sms_subaccount: sender_id,
      sms_status: topupOk ? "ready" : "pending_funding",
      sms_balance: topupOk ? new_balance : 0,
      initial_credit: INITIAL_SMS_CREDIT,
      details: {
        user_can_send: topupOk ? "Yes - SMS are funded and ready" : "No - requires manual funding",
        sms_origin: `${businessName} (from their subaccount)`,
        fallback_origin: "gr8result (approved parent account sender)",
        funding_status: topupOk ? "Funded automatically" : "Requires manual top-up",
      },
    });
  } catch (err) {
    console.error("❌ Unexpected error in approval handler:", err);
    return res.status(500).json({
      ok: false,
      error: "Internal server error",
      detail: err.message,
    });
  }
}

/**
 * USAGE:
 * 
 * When user's application is approved (from your dashboard/admin endpoint):
 * 
 *   const approvalRes = await fetch('/api/onboarding/approve-application', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({
 *       userId: 'user-123',
 *       businessName: 'Waite and Sea Health',
 *       email: 'owner@waiteandseahealth.com',
 *       applicationId: 'app-456',  // Optional, for your records
 *     }),
 *   });
 *   
 *   const result = await approvalRes.json();
 *   if (result.ok) {
 *     console.log('User SMS is ready!', {
 *       sms_status: result.sms_status,
 *       balance: result.sms_balance
 *     });
 *   }
 * 
 * 
 * WHAT HAPPENS NEXT:
 * 
 * 1. SMSGlobal subaccount created
 * 2. Credit transferred from your master account → subaccount
 * 3. User's credentials stored in accounts table
 * 4. SMS immediately available with $50 balance
 * 5. User can send campaigns/single SMS
 * 6. SMS charged to their subaccount balance
 * 
 * 
 * CUSTOMIZATION:
 * 
 * Change INITIAL_SMS_CREDIT at top of file to adjust initial funding:
 * - $20 for limited testing
 * - $50-100 for active users
 * - $200+ for heavy SMS users
 * 
 * You could also make this configurable per user type:
 *   import { determineSmsCredit } from '../services/user-service.js';
 *   const credit = determineSmsCredit(userTier, businessType);
 *   const { ok } = await topupSubaccount(sender_id, credit, key, secret);
 */
