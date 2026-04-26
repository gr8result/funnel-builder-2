import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function normalizePlan(raw) {
  const pagePlan = Array.isArray(raw?.pagePlan)
    ? raw.pagePlan
        .map((p) => ({
          name: String(p?.name || "").trim(),
          objective: String(p?.objective || "").trim(),
        }))
        .filter((p) => p.name && p.objective)
    : [];

  const copyAngles = Array.isArray(raw?.copyAngles)
    ? raw.copyAngles.map((c) => String(c || "").trim()).filter(Boolean)
    : [];

  return {
    headline: String(raw?.headline || "AI Website Plan").trim(),
    strap: String(raw?.strap || "Conversion-focused structure and messaging.").trim(),
    templateSlug: String(raw?.templateSlug || "").trim(),
    pagePlan,
    copyAngles,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "OPENAI_API_KEY not configured" });

  const {
    businessName = "",
    offer = "",
    targetAudience = "",
    goal = "",
    notes = "",
    buildType = "website",
  } = req.body || {};

  const safeBuildType = String(buildType || "website").toLowerCase() === "landing" ? "landing" : "website";

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a website strategist. Build concise, conversion-focused website plans. Return valid JSON only.",
        },
        {
          role: "user",
          content: `Create an AI ${safeBuildType === "landing" ? "landing page" : "website"} plan for this business.\n\nBuild Type: ${safeBuildType}\nBusiness Name: ${businessName || "(not provided)"}\nOffer: ${offer || "(not provided)"}\nTarget Audience: ${targetAudience || "(not provided)"}\nMain Goal: ${goal || "(not provided)"}\nNotes: ${notes || "(none)"}\n\nReturn JSON with this exact shape:\n{\n  "headline": "short heading",\n  "strap": "one-sentence strategy",\n  "templateSlug": "template slug recommendation",\n  "pagePlan": [\n    { "name": "Home", "objective": "specific conversion objective" }\n  ],\n  "copyAngles": ["angle 1", "angle 2", "angle 3"]\n}\n\nRules:\n- If Build Type is landing: return exactly 1 page in pagePlan.\n- If Build Type is website: return 4 to 8 pages in pagePlan.\n- Keep objective lines crisp and specific.\n- Make plan aligned to the stated audience and goal.`,
        },
      ],
    });

    const content = completion?.choices?.[0]?.message?.content || "";
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(502).json({ error: "Invalid AI response format" });
    }

    const plan = normalizePlan(parsed);
    if (!plan.pagePlan.length) return res.status(502).json({ error: "AI did not return page plan items" });

    if (safeBuildType === "landing" && plan.pagePlan.length !== 1) {
      plan.pagePlan = [plan.pagePlan[0]];
    }
    if (safeBuildType === "website" && plan.pagePlan.length < 2) {
      plan.pagePlan.push(
        { name: "About", objective: "Build authority and trust with your audience." },
        { name: "Contact", objective: "Capture qualified inquiries and start conversations." }
      );
    }

    return res.status(200).json({ ok: true, plan });
  } catch (err) {
    console.error("website generate-site-plan error:", err);
    return res.status(500).json({ error: "Failed to generate site plan" });
  }
}
