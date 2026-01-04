// /pages/api/ai/subject-lines.js
// FULL REPLACEMENT
// POST JSON: { context, tone, audience, offer, preheader, emailText, wantAB }
// Returns: { ok: true, subjectA, subjectB }

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "POST only" });
  }

  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "Missing OPENAI_API_KEY in .env.local",
      });
    }

    const body = req.body || {};
    const wantAB = body.wantAB !== false; // default true

    const context = String(body.context || "").trim();
    const tone = String(body.tone || "friendly, professional").trim();
    const audience = String(body.audience || "").trim();
    const offer = String(body.offer || "").trim();
    const preheader = String(body.preheader || "").trim();
    const emailText = String(body.emailText || "").trim().slice(0, 4000);

    const prompt = `
You are helping write high-converting email subject lines.
Rules:
- Return ONLY valid JSON (no markdown).
- Keep each subject line under 60 characters if possible.
- Avoid spam words (free!!!, act now!!!, guaranteed, etc).
- Make them relevant to the email content.

Context:
${context ? `- Brand/Context: ${context}\n` : ""}${audience ? `- Audience: ${audience}\n` : ""}${offer ? `- Offer/Goal: ${offer}\n` : ""}${preheader ? `- Preheader: ${preheader}\n` : ""}${emailText ? `- Email content summary text: ${emailText}\n` : ""}

Generate ${wantAB ? "two different options (A and B)" : "one option"}.

JSON shape:
${
  wantAB
    ? `{"subjectA":"...","subjectB":"..."}`
    : `{"subject":"..."}`
}
`.trim();

    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: prompt,
        temperature: 0.7,
      }),
    });

    const raw = await resp.text();

    if (!resp.ok) {
      return res.status(500).json({
        ok: false,
        error: `OpenAI error: ${resp.status}`,
        details: raw.slice(0, 800),
      });
    }

    let textOut = raw;

    // Try to extract output_text from Responses API safely
    try {
      const j = JSON.parse(raw);
      // many responses return: { output: [ { content: [ { type:"output_text", text:"..." } ] } ] }
      const out =
        j?.output?.[0]?.content?.find((c) => c?.type === "output_text")?.text ||
        j?.output_text ||
        "";
      if (out) textOut = out;
    } catch {
      // leave as raw
    }

    // Parse the JSON the model returned
    let parsed;
    try {
      parsed = JSON.parse(String(textOut).trim());
    } catch {
      return res.status(500).json({
        ok: false,
        error: "AI did not return valid JSON",
        details: String(textOut).slice(0, 800),
      });
    }

    if (wantAB) {
      const subjectA = String(parsed.subjectA || "").trim();
      const subjectB = String(parsed.subjectB || "").trim();
      if (!subjectA || !subjectB) {
        return res.status(500).json({
          ok: false,
          error: "AI response missing subjectA/subjectB",
          details: parsed,
        });
      }
      return res.status(200).json({ ok: true, subjectA, subjectB });
    } else {
      const subject = String(parsed.subject || "").trim();
      if (!subject) {
        return res.status(500).json({
          ok: false,
          error: "AI response missing subject",
          details: parsed,
        });
      }
      return res.status(200).json({ ok: true, subject });
    }
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "Server error",
    });
  }
}
