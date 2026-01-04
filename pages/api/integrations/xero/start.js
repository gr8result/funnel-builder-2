// /pages/api/integrations/xero/start.js
// Starts Xero OAuth flow: redirects user to Xero auth URL

import { supabase } from "../../../../utils/supabase-client";

export default async function handler(req, res) {
  try {
    const {
      XERO_CLIENT_ID,
      XERO_REDIRECT_URI,
      XERO_SCOPES = "openid profile email accounting.transactions accounting.contacts offline_access",
    } = process.env;

    if (!XERO_CLIENT_ID || !XERO_REDIRECT_URI) {
      return res.status(500).json({ error: "Missing Xero env vars" });
    }

    // Optional: You could read session here to confirm logged-in user
    // const { data } = await supabase.auth.getSession(); // can't use in API directly like client, so usually check via auth cookie / service key

    const state = encodeURIComponent("gr8-result-xero"); // later you can add user info etc.
    const scope = encodeURIComponent(XERO_SCOPES);
    const redirectUri = encodeURIComponent(XERO_REDIRECT_URI);

    const url = `https://login.xero.com/identity/connect/authorize?response_type=code&client_id=${XERO_CLIENT_ID}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;

    // Redirect to Xero
    res.writeHead(302, { Location: url });
    res.end();
  } catch (err) {
    console.error("Xero start error:", err);
    res.status(500).json({ error: "Failed to start Xero OAuth" });
  }
}
