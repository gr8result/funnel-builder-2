// /pages/api/connect-sendgrid.js
// ✅ FINAL FIXED VERSION — handles missing env vars + secure upload to Supabase Storage

import { createClient } from "@supabase/supabase-js";
import axios from "axios";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase environment variables:");
  console.error("URL:", supabaseUrl ? "✅ set" : "❌ missing");
  console.error(
    "Service key:",
    supabaseServiceKey
      ? `✅ loaded (${supabaseServiceKey.substring(0, 6)}...${supabaseServiceKey.slice(-6)})`
      : "❌ missing"
  );
  throw new Error("Supabase environment variables are not loaded");
}

// ✅ Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  try {
    console.log("📡 /api/connect-sendgrid.js triggered");

    const { account_id, account_name } = req.body;
    if (!account_id || !account_name)
      return res.status(400).json({ error: "Missing account_id or account_name" });

    // 1️⃣ Create a new SendGrid API key
    console.log("⚙️ Creating SendGrid API key...");
    const sgResponse = await axios.post(
      "https://api.sendgrid.com/v3/api_keys",
      {
        name: `gr8result_${account_name}_${account_id}`,
        scopes: ["mail.send"],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SENDGRID_MASTER_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const api_key = sgResponse.data.api_key;
    const api_key_id = sgResponse.data.api_key_id;
    console.log("✅ SendGrid key created:", api_key_id);

    // 2️⃣ Prepare payload
    const payload = {
      account_id,
      account_name,
      api_key,
      api_key_id,
      created_at: new Date().toISOString(),
    };

    // 3️⃣ Upload securely to Supabase Storage
    const folder = `sendgrid-keys/${account_id}`;
    const filePath = `${folder}/sendgrid-key.json`;

    const { error: uploadError } = await supabase.storage
      .from("Private-assets")
      .upload(filePath, JSON.stringify(payload), {
        contentType: "application/json",
        upsert: true,
      });

    if (uploadError) {
      console.error("❌ Upload failed:", uploadError.message);
      return res.status(500).json({ error: uploadError.message });
    }

    console.log("✅ Key stored in Supabase:", filePath);

    // 4️⃣ Return key for UI display
    return res.status(200).json({
      success: true,
      message: "SendGrid API key created and stored securely.",
      api_key,
    });
  } catch (err) {
    console.error("❌ SendGrid key creation error:", err.response?.data || err.message);
    return res.status(500).json({
      error: err.response?.data || err.message || "Unknown error",
    });
  }
}
