import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function safeTrim(value) {
  return String(value || "").trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: "OPENAI_API_KEY not configured" });
  }

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
    imageRequests = "",
  } = req.body || {};

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content:
            "You are a conversion copywriter. Write concise, persuasive website brand descriptions in plain English.",
        },
        {
          role: "user",
          content: `Write a 5-7 sentence brand and website creative brief summary for a website builder setup form.\n\nBusiness Name: ${safeTrim(businessName) || "(not provided)"}\nPrimary Offer: ${safeTrim(offer) || "(not provided)"}\nTarget Audience: ${safeTrim(targetAudience) || "(not provided)"}\nMain Goal: ${safeTrim(goal) || "(not provided)"}\nSEO Keywords: ${safeTrim(primaryKeywords) || "(not provided)"}\nService Areas: ${safeTrim(serviceAreas) || "(not provided)"}\nDifferentiators: ${safeTrim(differentiators) || "(not provided)"}\nProof Points: ${safeTrim(proofPoints) || "(not provided)"}\nBrand Tone: ${safeTrim(tone) || "(not provided)"}\nMust-Have Sections: ${safeTrim(mustIncludeSections) || "(not provided)"}\nRequested Images: ${safeTrim(imageRequests) || "(not provided)"}\nExtra Notes: ${safeTrim(notes) || "(none)"}\n\nRules:\n- Mention what the business does, who it serves, and key outcomes.\n- Mention the intended tone and strongest differentiators.\n- Mention the likely content and image direction for the finished website.\n- Keep it specific and commercially useful.\n- Avoid hype and cliches.\n- Return plain text only.`,
        },
      ],
    });

    const description = completion?.choices?.[0]?.message?.content?.trim() || "";
    if (!description) return res.status(502).json({ error: "Empty response from AI" });

    return res.status(200).json({ ok: true, description });
  } catch (err) {
    console.error("website generate-description error:", err);
    return res.status(500).json({ error: "Failed to generate description" });
  }
}
