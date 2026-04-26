// /pages/api/ai/generate-tags.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { title, category, description } = req.body;

  if (!title) {
    return res.status(400).json({ error: "Product title is required." });
  }

  try {
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
              "You are an ecommerce SEO expert. Generate clean, high-converting product tags.",
          },
          {
            role: "user",
            content: `
Generate 8-12 high-quality SEO tags for this product.

Product Title: ${title}
Category: ${category}
Description: ${description}

Rules:
- Return only comma separated tags
- No hashtags
- No bullet points
- No extra text
- Lowercase only
            `,
          },
        ],
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "AI generation failed.");
    }

    const tags = data.choices?.[0]?.message?.content?.trim();

    if (!tags) {
      throw new Error("No tags returned from AI.");
    }

    return res.status(200).json({ tags });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Something went wrong generating tags.",
    });
  }
}
