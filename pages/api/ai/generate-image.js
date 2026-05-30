import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withWorkspace";

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return res.status(500).json({ ok: false, error: "OPENAI_API_KEY not configured" });
  }

  const { prompt, size = "1024x1024", style = "clean" } = req.body || {};
  const userId = req.user.id;
  if (!prompt || !`${prompt}`.trim()) {
    return res.status(400).json({ ok: false, error: "Prompt is required" });
  }

  const safeSize = ["1024x1024", "1536x1024", "1024x1536"].includes(size) ? size : "1024x1024";

  try {
    const styleHint = style === "icon"
      ? "Flat vector icon style, simple shapes, transparent-looking background feel, high contrast."
      : style === "photo"
        ? "Photorealistic marketing image, clean composition, clear focal subject."
        : "Clean modern marketing graphic style, brand-safe, high clarity.";

    const fullPrompt = [
      "Create a production-ready marketing image.",
      styleHint,
      "No gibberish text, no watermarks, no logos unless explicitly requested.",
      `User request: ${`${prompt}`.trim()}`,
    ].join("\n");

    const genRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: fullPrompt,
        size: safeSize,
        n: 1,
      }),
    });

    const genJson = await genRes.json();
    if (!genRes.ok) {
      return res.status(502).json({ ok: false, error: genJson?.error?.message || "AI image generation failed" });
    }

    const item = genJson?.data?.[0];
    const directUrl = item?.url || null;
    const b64 = item?.b64_json || null;

    if (!directUrl && !b64) {
      return res.status(502).json({ ok: false, error: "No image returned from AI" });
    }

    // If no authenticated user context is supplied, return direct OpenAI URL/data URL.
    if (!userId) {
      const fallbackUrl = directUrl || `data:image/png;base64,${b64}`;
      return res.status(200).json({ ok: true, url: fallbackUrl, stored: false });
    }

    // Persist to the main assets bucket so generated images behave like normal uploads.
    let bytes;
    if (b64) {
      bytes = Buffer.from(b64, "base64");
    } else {
      const download = await fetch(directUrl);
      if (!download.ok) {
        return res.status(502).json({ ok: false, error: "Failed to download generated image" });
      }
      bytes = Buffer.from(await download.arrayBuffer());
    }

    const filePath = `${userId}/ai-images/${Date.now()}-generated.png`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("assets")
      .upload(filePath, bytes, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      // Fall back to direct URL if storage fails so feature still works.
      const fallbackUrl = directUrl || `data:image/png;base64,${b64}`;
      return res.status(200).json({ ok: true, url: fallbackUrl, stored: false, warning: uploadError.message });
    }

    const { data: pub } = supabaseAdmin.storage.from("assets").getPublicUrl(filePath);
    return res.status(200).json({ ok: true, url: pub?.publicUrl || null, stored: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "AI image generation failed" });
  }
}

export default withAuth(handler);
