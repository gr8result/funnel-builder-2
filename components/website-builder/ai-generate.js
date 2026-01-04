import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Use POST" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const {
      businessName = "",
      whatYouDo = "",
      audience = "",
      goal = "",
      style = "clean",
      color = "#2297c5",
    } = req.body || {};

    const prompt = `
You are generating a ONE-PAGE website draft for a drag-and-drop builder.

Return STRICT JSON ONLY that matches this schema:
{
  "pageName": string,
  "theme": { "accent": string, "maxWidth": number },
  "blocks": [
    { "preset": "hero"|"text"|"features"|"image"|"cta"|"footer", "props": object }
  ]
}

Business:
- Name: ${businessName}
- What it does: ${whatYouDo}
- Audience: ${audience}
- Goal (primary CTA): ${goal}

Style: ${style} (examples: clean, bold, minimal, playful, premium)
Accent colour: ${color}

Rules:
- Make a sensible layout: hero -> value props -> features -> social proof (as text/features) -> CTA -> footer
- Keep copy short and punchy, easy for beginners
- Use the provided accent colour
- For image blocks, set imageUrl to "" (user will upload later)
`;

    // Responses API (recommended) :contentReference[oaicite:3]{index=3}
    const response = await client.responses.create({
      model: "gpt-5.2",
      input: prompt,
      // Keep it deterministic-ish
      reasoning: { effort: "low" },
    });

    const text = response.output_text || "";
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      // Fallback: try to extract JSON if model added extra text (shouldn't, but just in case)
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start >= 0 && end > start) {
        json = JSON.parse(text.slice(start, end + 1));
      } else {
        throw new Error("AI did not return valid JSON");
      }
    }

    // basic validation
    if (!json?.blocks || !Array.isArray(json.blocks)) {
      return res.status(500).json({ error: "Invalid AI output structure" });
    }

    return res.status(200).json({ ok: true, draft: json });
  } catch (err) {
    console.error("ai-generate error:", err?.message || err);
    return res.status(500).json({
      error: "Failed to generate website draft",
      detail: err?.message || String(err),
    });
  }
}
