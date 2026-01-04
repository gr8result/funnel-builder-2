import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { title, category } = req.body;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are an AI that writes engaging product descriptions." },
        {
          role: "user",
          content: `Write a persuasive product description in Australian spelling.
          Title: ${title}
          Category: ${category}`,
        },
      ],
    });

    res.status(200).json({ description: completion.choices[0].message.content });
  } catch (err) {
    console.error("AI error:", err);
    res.status(500).json({ error: "Failed to generate description" });
  }
}
