// /pages/api/ai/generate-subject-preheader.js
//
// Generates subject + preheader (and optional AB subject variants)
// Requires env:
// - OPENAI_API_KEY
//
// This endpoint is intentionally small + safe.
// It returns JSON fields you can directly apply on the broadcast form.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Use POST" });
  }

  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "OPENAI_API_KEY missing in env.local",
      });
    }

    const {
      tone = "Friendly, confident, clear",
      goal = "Increase opens and clicks",
      notes = "",
      emailHtml = "",
      currentSubject = "",
      currentPreheader = "",
      abEnabled = false,
      brand = "GR8 RESULT",
    } = req.body || {};

    const safeHtmlSnippet = String(emailHtml || "").slice(0, 6000);

    const system = `You write high-converting email subject lines and preheaders for a marketing platform called ${brand}.
Return ONLY valid JSON. No markdown. No extra keys.`;

    const user = `Goal: ${goal}
Tone: ${tone}
Notes: ${notes}

Current subject: ${currentSubject}
Current preheader: ${currentPreheader}
A/B enabled: ${abEnabled ? "yes" : "no"}

Email HTML snippet:
${safeHtmlSnippet}

Return JSON:
{
  "subject": "string",
  "preheader": "string",
  "abSubjectA": "string (only if A/B enabled)",
  "abSubjectB": "string (only if A/B enabled)"
}

Rules:
- Subject max ~60 chars if possible.
- Preheader max ~110 chars if possible.
- If A/B enabled: A should be benefit-driven, B should be curiosity/urgency driven.`;

    const payload = {
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.8,
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await r.json().catch(() => null);

    if (!r.ok) {
      const msg =
        data?.error?.message ||
        `OpenAI error (${r.status})`;
      return res.status(500).json({ success: false, error: msg });
    }

    const content = data?.choices?.[0]?.message?.content || "";
    let parsed = null;

    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(500).json({
        success: false,
        error: "AI returned invalid JSON. Try again.",
      });
    }

    const out = {
      subject: String(parsed.subject || "").trim(),
      preheader: String(parsed.preheader || "").trim(),
    };

    if (abEnabled) {
      out.abSubjectA = String(parsed.abSubjectA || "").trim() || out.subject;
      out.abSubjectB = String(parsed.abSubjectB || "").trim();
    }

    if (!out.subject || !out.preheader) {
      return res.status(500).json({
        success: false,
        error: "AI response missing subject/preheader. Try again.",
      });
    }

    return res.status(200).json({ success: true, ...out });
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: e?.message || "Server error",
    });
  }
}
