import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function asText(v, max = 1600) {
  return String(v || "").trim().slice(0, max);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "OPENAI_API_KEY not configured" });

  const {
    prompt = "",
    mode = "image", // image | icon
    size = "1024x1024",
    style = "vivid", // vivid | natural
    context = {},
  } = req.body || {};

  const safePrompt = asText(prompt);
  if (!safePrompt) return res.status(400).json({ error: "Prompt is required" });

  const safeMode = mode === "icon" ? "icon" : "image";
  const safeSize = ["1024x1024", "1024x1792", "1792x1024"].includes(size) ? size : "1024x1024";
  const safeStyle = style === "natural" ? "natural" : "vivid";

  const projectName = asText(context?.projectName, 160);
  const businessName = asText(context?.brief?.businessName, 160);
  const offer = asText(context?.brief?.offer, 220);
  const audience = asText(context?.brief?.targetAudience, 220);

  const finalPrompt = [
    safeMode === "icon"
      ? "Design a clean, modern app/site icon with strong silhouette, minimal detail, and high legibility at small sizes."
      : "Generate a high-quality website-ready marketing image with strong composition and clear subject focus.",
    `Project: ${projectName || "N/A"}`,
    `Business: ${businessName || "N/A"}`,
    `Offer: ${offer || "N/A"}`,
    `Audience: ${audience || "N/A"}`,
    `User prompt: ${safePrompt}`,
  ].join("\n");

  try {
    const generated = await client.images.generate({
      model: "dall-e-3",
      prompt: finalPrompt,
      size: safeSize,
      style: safeStyle,
      quality: "standard",
      response_format: "b64_json",
      n: 1,
    });

    const item = generated?.data?.[0];
    const b64 = item?.b64_json;
    if (!b64) return res.status(502).json({ error: "Image generation returned no image data" });

    return res.status(200).json({
      ok: true,
      dataUrl: `data:image/png;base64,${b64}`,
      revisedPrompt: item?.revised_prompt || "",
    });
  } catch (err) {
    console.error("website generate-image error:", err);
    return res.status(500).json({ error: "Failed to generate image" });
  }
}