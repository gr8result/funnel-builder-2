// /pages/api/assets/remove-bg.js
//
// Removes background for a given imageUrl using remove.bg
// - Downloads the imageUrl server-side
// - Calls remove.bg API
// - Uploads result PNG into Supabase assets bucket under <userId>/
// - Returns { publicUrl }

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { imageUrl, base64: bodyBase64, userId: bodyUserId } = req.body || {};
    if (!imageUrl && !bodyBase64) return res.status(400).json({ error: "Missing imageUrl or base64" });

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

    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    let userId = String(bodyUserId || "").trim() || null;
    if (!userId) {
      const authHeader = req.headers.authorization || "";
      if (authHeader.startsWith("Bearer ")) {
        const jwt = authHeader.replace("Bearer ", "").trim();
        const { data } = await supabaseAdmin.auth.getUser(jwt);
        userId = data?.user?.id || null;
      }
    }
    if (!userId) userId = "anonymous";

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

    const filePath = `${userId}/email-images/${Date.now()}-removed-bg.png`;
    const { error: upErr } = await supabaseAdmin.storage.from("email-user-assets").upload(filePath, outBuf, {
      contentType: "image/png",
      upsert: true,
    });

    if (upErr) return res.status(500).json({ error: "Upload failed: " + upErr.message });

    const { data: pub } = supabaseAdmin.storage.from("email-user-assets").getPublicUrl(filePath);

    return res.status(200).json({ publicUrl: pub.publicUrl });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
