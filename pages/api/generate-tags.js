import OpenAI from "openai";
import { withAuth } from "../../lib/withWorkspace";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { description } = req.body;

    if (!description) {
      return res.status(400).json({ error: "Missing description" });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Generate 5-10 short ecommerce tags separated by commas. No explanations.",
        },
        {
          role: "user",
          content: description,
        },
      ],
    });

    const tags = completion.choices[0].message.content;

    return res.status(200).json({ tags });

  } catch (error) {
    console.error("TAG ERROR:", error);
    return res.status(500).json({
      error: error.message || "Tag generation failed",
    });
  }
}

export default withAuth(handler);
