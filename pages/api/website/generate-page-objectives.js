import OpenAI from "openai";
import { withAuth } from "../../../lib/withWorkspace";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function safeTrim(value) {
  return String(value || "").trim();
}

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "OPENAI_API_KEY not configured" });

  const {
    businessName = "",
    offer = "",
    targetAudience = "",
    goal = "",
    notes = "",
    primaryKeywords = "",
    serviceAreas = "",
    differentiators = "",
    proofPoints = "",
    tone = "",
    mustIncludeSections = "",
    pages = [],
  } = req.body || {};

  const pageNames = Array.isArray(pages)
    ? pages.map((p) => String(p || "").trim()).filter(Boolean)
    : [];

  if (!pageNames.length) return res.status(400).json({ error: "No pages provided" });

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You write concise conversion-focused website page objectives. Respond with valid JSON only.",
        },
        {
          role: "user",
          content: `Create one objective sentence for each page name below.

Business Name: ${safeTrim(businessName) || "(not provided)"}
Offer: ${safeTrim(offer) || "(not provided)"}
Target Audience: ${safeTrim(targetAudience) || "(not provided)"}
Main Goal: ${safeTrim(goal) || "(not provided)"}
SEO Keywords: ${safeTrim(primaryKeywords) || "(not provided)"}
Service Areas: ${safeTrim(serviceAreas) || "(not provided)"}
Differentiators: ${safeTrim(differentiators) || "(not provided)"}
Proof Points: ${safeTrim(proofPoints) || "(not provided)"}
Brand Tone: ${safeTrim(tone) || "(not provided)"}
Must-Have Sections: ${safeTrim(mustIncludeSections) || "(not provided)"}
Notes: ${safeTrim(notes) || "(none)"}

Pages: ${pageNames.join(", ")}

Return JSON with this exact shape:
{
  "objectives": [
    { "name": "Page Name", "objective": "One clear conversion-focused sentence." }
  ]
}

Rules:
- Keep each objective under 14 words when possible.
- Keep language specific and benefit-oriented.
- Weave in likely buyer or SEO intent when relevant.
- Preserve the page names exactly as provided.`,
        },
      ],
    });

    const content = completion?.choices?.[0]?.message?.content || "";
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(502).json({ error: "Invalid AI response format" });
    }

    const objectives = Array.isArray(parsed?.objectives)
      ? parsed.objectives
          .map((item) => ({
            name: String(item?.name || "").trim(),
            objective: String(item?.objective || "").trim(),
          }))
          .filter((item) => item.name && item.objective)
      : [];

    if (!objectives.length) return res.status(502).json({ error: "No objectives returned" });

    return res.status(200).json({ ok: true, objectives });
  } catch (err) {
    console.error("website generate-page-objectives error:", err);
    return res.status(500).json({ error: "Failed to generate page objectives" });
  }
}

export default withAuth(handler);
