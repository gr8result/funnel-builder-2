// /pages/api/integrations/xero/callback.js
// Handles Xero OAuth callback: exchanges code for tokens and saves to Supabase

import { createClient } from "@supabase/supabase-js";
import querystring from "querystring";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).send("Missing code");
  }

  try {
    const {
      XERO_CLIENT_ID,
      XERO_CLIENT_SECRET,
      XERO_REDIRECT_URI,
    } = process.env;

    if (!XERO_CLIENT_ID || !XERO_CLIENT_SECRET || !XERO_REDIRECT_URI) {
      return res.status(500).send("Missing Xero env vars");
    }

    // TODO: get the current user id from session or state.
    // For now, you might pass userId in state param or temporary cookie.
    // Here we'll just fail if we don't have it (placeholder).
    // const userId = ...;

    // TEMP: until you wire real user resolution:
    const userId = null;
    if (!userId) {
      console.warn("No userId wired into Xero callback yet.");
      // You can still log success, but not store tokens.
    }

    const tokenUrl = "https://identity.xero.com/connect/token";

    const body = querystring.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: XERO_REDIRECT_URI,
    });

    const basicAuth = Buffer.from(
      `${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`
    ).toString("base64");

    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error("Xero token error:", text);
      return res.status(500).send("Error exchanging code for tokens");
    }

    const tokenJson = await tokenRes.json();
    const {
      access_token,
      refresh_token,
      id_token,
      expires_in,
      scope,
    } = tokenJson;

    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    if (userId) {
      // Upsert into xero_connections
      const { error } = await supabaseAdmin.from("xero_connections").upsert(
        {
          user_id: userId,
          access_token,
          refresh_token,
          id_token,
          scope,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        }
      );

      if (error) {
        console.error("Error saving Xero tokens:", error.message);
      }
    }

    // Redirect back into your app
    res.writeHead(302, { Location: "/modules/accounting?xero=connected" });
    res.end();
  } catch (err) {
    console.error("Xero callback error:", err);
    res.status(500).send("Xero callback failed");
  }
}
