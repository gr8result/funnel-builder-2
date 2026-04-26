import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
          content: `Write a 4-6 sentence brand description for a website builder setup form.\n\nBusiness Name: ${businessName || "(not provided)"}\nPrimary Offer: ${offer || "(not provided)"}\nTarget Audience: ${targetAudience || "(not provided)"}\nMain Goal: ${goal || "(not provided)"}\nExtra Notes: ${notes || "(none)"}\n\nRules:\n- Mention what the business does, who it serves, and key outcomes.\n- Keep it specific and benefit-driven.\n- Avoid hype and cliches.\n- Return plain text only.`,
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
