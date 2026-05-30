import { withAuth } from "../../../lib/withWorkspace";
// /pages/api/ai/generate-product.js

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { title, category, tags, price, currentDescription, mode } = req.body;

  if (!title) {
    return res.status(400).json({ error: "Product title is required." });
  }

  try {
    const safeCurrentDescription = String(currentDescription || "").trim();
    const isEditMode = String(mode || "").toLowerCase() === "edit";

    const userPrompt = isEditMode
      ? `
Rewrite and improve this ecommerce product description while preserving the core meaning and details.

Product Title: ${title}
Category: ${category}
Price: ${price}
Tags: ${tags}
Current Description: ${safeCurrentDescription || "(none provided)"}

Requirements:
- Return 150-220 words.
- Keep it clear, persuasive, and benefit-driven.
- Do not invent fake guarantees or compliance claims.
      `
      : `
Write a compelling ecommerce product description (150-220 words).

Product Title: ${title}
Category: ${category}
Price: ${price}
Tags: ${tags}

Make it engaging, benefit-driven, and suitable for an online marketplace.
      `;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an expert ecommerce copywriter who writes high-converting product descriptions. Focus on benefits, emotion, and persuasive language.",
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: 0.85,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "AI generation failed.");
    }

    const description = data.choices?.[0]?.message?.content;

    if (!description) {
      throw new Error("No description returned from AI.");
    }

    return res.status(200).json({ description });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Something went wrong generating description.",
    });
  }
}

export default withAuth(handler);
