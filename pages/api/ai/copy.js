// /pages/api/ai/copy.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const key = process.env.OPENAI_API_KEY;
    if (!key) return res.status(200).json({ text: `[[AI disabled]] ${prompt}` });

    // Minimal OpenAI chat call; keep it cheap and short.
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You write concise, high-converting marketing copy." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 220
      })
    });
    const j = await r.json();
    const text = j?.choices?.[0]?.message?.content?.trim() || "";
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: e.message || "AI error" });
  }
}
