// /pages/api/assets/remove-bg.js
//
// Removes background for a given imageUrl using remove.bg
// - Downloads the imageUrl server-side
// - Calls remove.bg API
// - Persists result PNG into the shared assets library for the user
// - Returns { publicUrl }

import { createClient } from "@supabase/supabase-js";
import { persistImageForUser } from "../social/save-image";
import { withAuth } from "../../../lib/withWorkspace";

async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { imageUrl, base64: bodyBase64 } = req.body || {};
    if (!imageUrl && !bodyBase64) return res.status(400).json({ error: "Missing imageUrl or base64" });

    // SSRF protection: only allow https:// URLs to public hosts
    if (imageUrl && !bodyBase64) {
      let parsedUrl;
      try { parsedUrl = new URL(imageUrl); } catch { return res.status(400).json({ error: "Invalid imageUrl" }); }
      if (parsedUrl.protocol !== "https:") return res.status(400).json({ error: "imageUrl must use https" });
      // Block private/internal IP ranges
      const host = parsedUrl.hostname.toLowerCase();
      if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1|0\.0\.0\.0)/.test(host)) {
        return res.status(400).json({ error: "imageUrl must be a public URL" });
      }
    }

    const apiKey = String(process.env.REMOVEBG_API_KEY || "").trim();
    const normalizedApiKey = apiKey.toLowerCase();
    const invalidApiKey = !apiKey
      || apiKey === "your_remove_bg_api_key_here"
      || apiKey === "real_key_from_remove_bg"
      || normalizedApiKey.includes("placeholder")
      || normalizedApiKey.includes("your_remove_bg")
      || normalizedApiKey.includes("real_key_from_remove_bg");
    if (invalidApiKey) {
      return res.status(500).json({ error: "REMOVEBG_API_KEY is not configured with a real remove.bg key in .env.local" });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: "Missing Supabase env vars" });

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const userId = req.user.id || "anonymous";

    let imgBuf;
    if (bodyBase64) {
      const cleaned = String(bodyBase64).replace(/^data:[^;]+;base64,/, "");
      imgBuf = Buffer.from(cleaned, "base64");
    } else {
      const imgResp = await fetch(imageUrl);
      if (!imgResp.ok) return res.status(400).json({ error: "Could not download imageUrl" });
      imgBuf = Buffer.from(await imgResp.arrayBuffer());
    }

    const form = new FormData();
    form.append("image_file", new Blob([imgBuf]), "image.png");
    form.append("size", "auto");
    form.append("format", "png");
    form.append("type", "product");

    const rb = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: form,
    });

    if (!rb.ok) {
      const txt = await rb.text().catch(() => "");
      return res.status(400).json({ error: `remove.bg failed: ${txt || rb.statusText}` });
    }

    const outBuf = Buffer.from(await rb.arrayBuffer());

    const sharedImage = await persistImageForUser(
      { user: { id: userId }, admin: supabaseAdmin },
      {
        imageUrl: `data:image/png;base64,${outBuf.toString("base64")}`,
        description: "Background removed image",
        tags: ["edited", "background-removed"],
        source: "remove-bg",
      }
    );

    return res.status(200).json({ publicUrl: sharedImage?.url || null, image: sharedImage || null });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}

export default withAuth(handler);
