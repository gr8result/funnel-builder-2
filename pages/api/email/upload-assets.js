// /pages/api/email/upload-assets.js
// Handles image uploads from GrapesJS → Supabase storage → returns public URL

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = {
  api: {
    bodyParser: false, // we handle raw stream for file upload
  },
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    // Random filename
    const filename = `email-assets/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;

    const { data, error } = await supabase.storage
      .from("public-assets")   // bucket name — use yours if different
      .upload(filename, buffer, {
        contentType: "image/png",
        upsert: false,
      });

      if (error) throw error;

    const { data: publicUrl } = supabase.storage
      .from("public-assets")
      .getPublicUrl(filename);

    return res.status(200).json({
      data: [{ url: publicUrl.publicUrl }],
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: err.message });
  }
}

