// /pages/api/vendor/get-vendor.js
// Get authenticated user's vendor - handles marketplace/auth user mismatch
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withWorkspace";

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = String(req.headers.authorization || "").trim();
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!token) {
      return res.status(401).json({ error: "Missing authorization token" });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(
      token
    );
    if (userError || !userData?.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const authUserId = userData.user.id;
    const authEmail = (userData.user.email || "").toLowerCase().trim();

    // 1. Look up vendor by auth user_id
    let vendor = null;
    const { data: byUser, error: userErr } = await supabaseAdmin
      .from("vendors")
      .select("*")
      .eq("user_id", authUserId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!userErr && byUser?.[0]) {
      vendor = byUser[0];
    }

    // 2. If not found, look up by email and RELINK to auth user
    if (!vendor && authEmail) {
      const { data: byEmail, error: emailErr } = await supabaseAdmin
        .from("vendors")
        .select("*")
        .ilike("email", authEmail)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!emailErr && byEmail?.[0]) {
        const existingVendor = byEmail[0];

        // If found but different user_id, relink to auth user
        if (existingVendor.user_id !== authUserId) {
          const { data: updated, error: updateErr } = await supabaseAdmin
            .from("vendors")
            .update({ user_id: authUserId })
            .eq("id", existingVendor.id)
            .select("*")
            .single();

          if (!updateErr && updated) {
            vendor = updated;
          } else if (!updateErr) {
            vendor = existingVendor; // fallback to unchanged
          }
        } else {
          vendor = existingVendor;
        }
      }
    }

    // 3. If still not found, create bootstrap vendor
    if (!vendor) {
      const bootstrapPayload = {
        user_id: authUserId,
        full_name: authEmail.split("@")[0] || "Vendor",
        business_name: authEmail.split("@")[0] || "Business",
        email: authEmail || userData.user.email || "",
        phone: "",
        verified: false,
      };

      const { data: bootstrap, error: bootstrapErr } = await supabaseAdmin
        .from("vendors")
        .insert({
          ...bootstrapPayload,
          created_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (bootstrapErr) {
        console.error("Bootstrap vendor creation failed:", bootstrapErr);
        return res.status(500).json({
          error: "Failed to create vendor profile",
          details: bootstrapErr.message,
        });
      }

      vendor = bootstrap;
    }

    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found and creation failed" });
    }

    return res.status(200).json({ vendor });
  } catch (err) {
    console.error("Get vendor error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}

export default withAuth(handler);
