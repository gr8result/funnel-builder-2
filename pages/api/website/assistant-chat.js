import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function asText(v, max = 1200) {
  return String(v || "").trim().slice(0, max);
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((m) => ({
      role: m?.role === "assistant" ? "assistant" : "user",
      content: asText(m?.content, 4000),
    }))
    .filter((m) => m.content)
    .slice(-14);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "OPENAI_API_KEY not configured" });

  const { messages = [], context = {} } = req.body || {};
  const safeMessages = sanitizeMessages(messages);

  if (!safeMessages.length) return res.status(400).json({ error: "No messages provided" });

  const projectName = asText(context?.projectName);
  const activePage = asText(context?.activePage);
  const currentObjective = asText(context?.currentObjective, 2000);
  const businessName = asText(context?.brief?.businessName);
  const offer = asText(context?.brief?.offer);
  const targetAudience = asText(context?.brief?.targetAudience);
  const goal = asText(context?.brief?.goal);
  const notes = asText(context?.brief?.notes, 2000);

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "You are an expert website-building copilot. Give practical, implementation-ready guidance for page structure, conversion copy, visual direction, and section instructions. Keep answers concise, clear, and action-oriented.",
        },
        {
          role: "system",
          content: `Current website context:\nProject: ${projectName || "(unknown)"}\nPage: ${activePage || "(unknown)"}\nPage Objective: ${currentObjective || "(none)"}\nBusiness: ${businessName || "(unknown)"}\nOffer: ${offer || "(unknown)"}\nAudience: ${targetAudience || "(unknown)"}\nGoal: ${goal || "(unknown)"}\nNotes: ${notes || "(none)"}`,
        },
        ...safeMessages,
      ],
    });

    const reply = String(completion?.choices?.[0]?.message?.content || "").trim();
    if (!reply) return res.status(502).json({ error: "AI returned an empty response" });

    return res.status(200).json({ ok: true, reply });
  } catch (err) {
    console.error("website assistant-chat error:", err);
    return res.status(500).json({ error: "Failed to get assistant response" });
  }
}