import crypto from "crypto";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { verifyMarketplaceResetToken } from "../../../lib/marketplacePasswordResetToken";

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = String(req.body?.token || "");
    const password = String(req.body?.password || "");

    if (!token || !password) {
      return res.status(400).json({ error: "Token and password are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const { email } = verifyMarketplaceResetToken(token);
    const passwordHash = hashPassword(password);

    const { data: updated, error } = await supabaseAdmin
      .from("users")
      .update({ password_hash: passwordHash })
      .eq("email", email)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Marketplace password update error:", error);
      return res.status(500).json({ error: "Failed to reset password" });
    }

    if (!updated?.id) {
      return res.status(400).json({ error: "Invalid reset request" });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    const message = error?.message === "Reset token expired" ? "Reset link has expired" : "Invalid or expired reset link";
    return res.status(400).json({ error: message });
  }
}
