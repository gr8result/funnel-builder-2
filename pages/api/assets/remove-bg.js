// /pages/api/assets/remove-bg.js
//
// Removes background for a given imageUrl using remove.bg
// - Downloads the imageUrl server-side
// - Calls remove.bg API
// - Uploads result PNG into Supabase assets bucket under <userId>/
// - Returns { publicUrl }
//
// REQUIRED env:
//   REMOVEBG_API_KEY=xxxx
//
// Notes:
// - Uses Service Role key for uploading to storage securely (server-side only).
// - Make sure you have these env vars set:
//   NEXT_PUBLIC_SUPABASE_URL=...
//   SUPABASE_SERVICE_ROLE_KEY=...

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { imageUrl } = req.body || {};
    if (!imageUrl) return res.status(400).json({ error: "Missing imageUrl" });

    const apiKey = process.env.REMOVEBG_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing REMOVEBG_API_KEY" });

    // Get current user (via Supabase auth cookie)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: "Missing Supabase env vars" });

    // lazy import (keeps this file self-contained)
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Try to read user from JWT in cookie (best-effort). If you already have your own auth middleware,
    // you can replace this with your existing userId lookup.
    const authHeader = req.headers.authorization || "";
    let userId = null;

    // If you don't send Authorization header, we fallback to an "anonymous" folder.
    // (Works, but your assets won't be per-user)
    if (authHeader.startsWith("Bearer ")) {
      const jwt = authHeader.replace("Bearer ", "").trim();
      const { data } = await supabaseAdmin.auth.getUser(jwt);
      userId = data?.user?.id || null;
    }

    if (!userId) userId = "anonymous";

    // Download source image
    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) return res.status(400).json({ error: "Could not download imageUrl" });
    const imgBuf = Buffer.from(await imgResp.arrayBuffer());

    // Call remove.bg
    const form = new FormData();
    form.append("image_file", new Blob([imgBuf]), "image.png");
    form.append("size", "auto");

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

    // Upload result to Supabase assets bucket
    const filePath = `${userId}/${Date.now()}-removed-bg.png`;
    const { error: upErr } = await supabaseAdmin.storage.from("assets").upload(filePath, outBuf, {
      contentType: "image/png",
      upsert: true,
    });

    if (upErr) return res.status(500).json({ error: "Upload failed" });

    const { data: pub } = supabaseAdmin.storage.from("assets").getPublicUrl(filePath);

    return res.status(200).json({ publicUrl: pub.publicUrl });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}
