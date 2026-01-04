export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Use POST" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "Missing OPENAI_API_KEY in .env.local (restart dev server after adding it)",
      });
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
You generate a ONE-PAGE website draft for a simple block website builder.

Return ONLY valid JSON (no markdown, no extra text).

The JSON MUST match this exact schema and keys:

{
  "pageName": string,
  "theme": { "accent": string, "maxWidth": 980 },
  "blocks": [
    {
      "preset": "hero",
      "props": {
        "paddingY": 64,
        "paddingX": 20,
        "background": "transparent",
        "radius": 14,
        "align": "left",
        "eyebrow": string,
        "heading": string,
        "subheading": string,
        "primaryText": string,
        "primaryHref": "#"
      }
    },
    {
      "preset": "text",
      "props": {
        "paddingY": 48,
        "paddingX": 20,
        "background": "transparent",
        "radius": 14,
        "align": "left",
        "heading": string,
        "body": string
      }
    },
    {
      "preset": "features",
      "props": {
        "paddingY": 48,
        "paddingX": 20,
        "background": "transparent",
        "radius": 14,
        "align": "left",
        "heading": string,
        "items": [
          { "title": string, "body": string },
          { "title": string, "body": string },
          { "title": string, "body": string }
        ]
      }
    },
    {
      "preset": "image",
      "props": {
        "paddingY": 48,
        "paddingX": 20,
        "background": "transparent",
        "radius": 14,
        "align": "left",
        "heading": "Gallery / Product Image",
        "imageUrl": "",
        "imageAlt": ""
      }
    },
    {
      "preset": "cta",
      "props": {
        "paddingY": 48,
        "paddingX": 20,
        "background": "transparent",
        "radius": 14,
        "align": "left",
        "heading": string,
        "body": string,
        "primaryText": string,
        "primaryHref": "#"
      }
    },
    {
      "preset": "footer",
      "props": {
        "paddingY": 28,
        "paddingX": 20,
        "background": "transparent",
        "radius": 14,
        "align": "left",
        "smallText": string
      }
    }
  ]
}

Business info:
- Name: ${businessName}
- What it does: ${whatYouDo}
- Audience: ${audience}
- Goal (CTA): ${goal}

Style mood: ${style}
Accent colour: ${color}

Rules:
- Use normal English only. No random characters. No placeholders like "asdf".
- Make the copy simple and clear.
- Use theme.accent = "${color}" and theme.maxWidth = 980.
- Make hero eyebrow the business name (or a short category label).
- primaryText should match the goal (e.g. "Book a demo", "Buy now", "Join now").
`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.4,
        messages: [
          { role: "system", content: "You return strict JSON only." },
          { role: "user", content: prompt },
        ],
      }),
    });

    const data = await openaiRes.json();

    if (!openaiRes.ok) {
      console.error("OpenAI error:", data);
      return res.status(500).json({
        error: "OpenAI request failed",
        detail: data?.error?.message || data,
      });
    }

    const text = data?.choices?.[0]?.message?.content || "";
    if (!text) {
      return res.status(500).json({ error: "No content returned from OpenAI" });
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      console.error("AI returned non-JSON:", text);
      return res.status(500).json({
        error: "AI returned invalid JSON",
        rawText: text,
      });
    }

    if (!json?.blocks || !Array.isArray(json.blocks)) {
      return res.status(500).json({ error: "Invalid structure from AI", json });
    }

    return res.status(200).json({ ok: true, draft: json });
  } catch (err) {
    console.error("ai-generate fatal error:", err);
    return res.status(500).json({
      error: "Server error",
      detail: err?.message || String(err),
    });
  }
}
