// /pages/api/crm/ai-analyze-lead.js
// Batch-analyzes CRM leads using GPT-4o-mini.
// Returns a priority score, temperature, next action, and stage recommendation per lead.

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { leads = [], stages = [] } = req.body || {};

  if (!Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({ ok: false, error: "No leads provided" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ ok: false, error: "AI not configured" });
  }

  const stageList = stages.map((s) => `${s.id} (${s.title})`).join(", ");

  // Cap at 20 leads per call to control token usage
  const batch = leads.slice(0, 20);

  const leadSummaries = batch.map((l, i) =>
    `Lead ${i + 1}: id=${l.id}, name="${l.name || "Unknown"}", email="${l.email || ""}", source="${l.source || ""}", deal_value=${l.deal_value || 0}, current_stage="${l.stage || "unknown"}", days_in_stage=${l.days_in_stage || 0}, tags="${l.tags || ""}"`
  ).join("\n");

  const systemPrompt = `You are a senior CRM sales analyst AI. Analyze each lead and return a JSON array.

Pipeline stages available: ${stageList || "not_qualified, new_lead, first_contact, follow_up, proposal, won, lost"}

For each lead return exactly this JSON object:
{
  "id": "<lead id>",
  "score": <integer 1-10, where 10 is hottest/most likely to close>,
  "temperature": "<hot|warm|cold>",
  "nextAction": "<one specific, actionable next step in 10 words or less>",
  "insight": "<one sentence insight about this lead's status and potential>",
  "stageRecommendation": "<stage id from the available list that best fits this lead>"
}

Rules:
- Score 8-10 = hot (high deal value, short time in stage, engaged source)
- Score 4-7 = warm (moderate activity or potential)
- Score 1-3 = cold (stale, low value, no engagement signals)
- Be concise and direct. No fluff.
- Return ONLY a valid JSON array, no markdown, no explanation.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: leadSummaries },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "[]";

    let results;
    try {
      // Strip any accidental markdown code fences
      const cleaned = raw.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();
      results = JSON.parse(cleaned);
    } catch {
      console.error("AI response parse error:", raw);
      return res.status(500).json({ ok: false, error: "AI returned invalid JSON" });
    }

    if (!Array.isArray(results)) {
      return res.status(500).json({ ok: false, error: "Unexpected AI response shape" });
    }

    return res.status(200).json({ ok: true, results });
  } catch (err) {
    console.error("ai-analyze-lead error:", err);
    return res.status(500).json({ ok: false, error: err.message || "AI analysis failed" });
  }
}
