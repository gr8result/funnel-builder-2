import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const TONE_RULES = {
  balanced: "Clear, modern, conversion-focused. No hype.",
  luxury: "Premium, refined, confident, elegant language.",
  bold: "Direct, punchy, energetic, decisive language.",
  clinical: "Precise, factual, low-emotion, trust-oriented language.",
  friendly: "Warm, human, conversational, encouraging language.",
};

const COPY_SCHEMAS = {
  "hero": {
    headline: "string",
    subheadline: "string",
    ctaText: "string",
  },
  "text": {
    text: "string",
  },
  "cta-button": {
    text: "string",
  },
  "feature-list": {
    title: "string",
    items: "stringArray",
  },
  "testimonial": {
    text: "string",
    author: "string",
    role: "string",
  },
  "pricing-table": {
    title: "string",
    plans: "plansArray",
  },
  "contact-form": {
    title: "string",
    subtitle: "string",
    submitText: "string",
  },
  "columns-2": {
    leftContent: "string",
    rightContent: "string",
  },
  "columns-3": {
    column1: "string",
    column2: "string",
    column3: "string",
  },
  "accordion": {
    title: "string",
    items: "accordionItems",
  },
  "stats": {
    title: "string",
    stats: "statsItems",
  },
  "team": {
    title: "string",
    members: "teamMembers",
  },
  "faq": {
    title: "string",
    items: "faqItems",
  },
  "newsletter": {
    title: "string",
    subtitle: "string",
    placeholder: "string",
    buttonText: "string",
  },
  "trust-badges": {
    badges: "badgeItems",
  },
  "image": {
    alt: "string",
    caption: "string",
  },
  "image-gallery": {
    title: "string",
  },
  "video-embed": {
    title: "string",
  },
};

function asString(v) {
  return String(v || "").trim();
}

function clampArray(arr, max) {
  return Array.isArray(arr) ? arr.slice(0, max) : [];
}

function sanitizePatch(blockType, rawPatch, currentProps) {
  const schema = COPY_SCHEMAS[blockType];
  if (!schema || !rawPatch || typeof rawPatch !== "object") return {};

  const out = {};

  Object.entries(schema).forEach(([key, kind]) => {
    if (!(key in rawPatch)) return;
    const next = rawPatch[key];

    if (kind === "string") {
      out[key] = asString(next).slice(0, 4000);
      return;
    }

    if (kind === "stringArray") {
      out[key] = clampArray(next, 12).map((item) => asString(item).slice(0, 220)).filter(Boolean);
      return;
    }

    if (kind === "plansArray") {
      out[key] = clampArray(next, 6).map((plan, idx) => {
        const current = Array.isArray(currentProps?.plans) ? currentProps.plans[idx] || {} : {};
        return {
          ...current,
          name: asString(plan?.name || current?.name).slice(0, 80),
          price: asString(plan?.price || current?.price).slice(0, 40),
          description: asString(plan?.description || current?.description).slice(0, 220),
          cta: asString(plan?.cta || current?.cta).slice(0, 80),
          features: clampArray(plan?.features, 8)
            .map((f) => asString(f).slice(0, 120))
            .filter(Boolean),
        };
      });
      return;
    }

    if (kind === "accordionItems") {
      out[key] = clampArray(next, 10).map((item) => ({
        heading: asString(item?.heading).slice(0, 140),
        content: asString(item?.content).slice(0, 500),
      }));
      return;
    }

    if (kind === "statsItems") {
      out[key] = clampArray(next, 8).map((item) => ({
        number: asString(item?.number).slice(0, 40),
        label: asString(item?.label).slice(0, 100),
      }));
      return;
    }

    if (kind === "teamMembers") {
      out[key] = clampArray(next, 8).map((member, idx) => {
        const current = Array.isArray(currentProps?.members) ? currentProps.members[idx] || {} : {};
        return {
          ...current,
          name: asString(member?.name || current?.name).slice(0, 80),
          role: asString(member?.role || current?.role).slice(0, 120),
          bio: asString(member?.bio || current?.bio).slice(0, 420),
        };
      });
      return;
    }

    if (kind === "faqItems") {
      out[key] = clampArray(next, 12).map((item) => ({
        question: asString(item?.question).slice(0, 180),
        answer: asString(item?.answer).slice(0, 600),
      }));
      return;
    }

    if (kind === "badgeItems") {
      out[key] = clampArray(next, 8).map((item) => ({
        icon: asString(item?.icon).slice(0, 8),
        label: asString(item?.label).slice(0, 80),
      }));
    }
  });

  return out;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "OPENAI_API_KEY not configured" });

  const {
    blockType = "",
    blockProps = {},
    brief = {},
    projectName = "",
    pageName = "",
    pageObjective = "",
    tone = "balanced",
  } = req.body || {};

  const safeBlockType = asString(blockType);
  const schema = COPY_SCHEMAS[safeBlockType];
  if (!schema) return res.status(400).json({ error: "Unsupported block type" });
  const safeTone = TONE_RULES[asString(tone).toLowerCase()] ? asString(tone).toLowerCase() : "balanced";

  const safeProps = blockProps && typeof blockProps === "object" ? blockProps : {};
  const safeBrief = brief && typeof brief === "object" ? brief : {};

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You rewrite website section copy for conversions. Keep layout untouched. Return valid JSON only.",
        },
        {
          role: "user",
          content: `Rewrite copy for one website block.

Project Name: ${asString(projectName) || "(not provided)"}
Page Name: ${asString(pageName) || "(not provided)"}
Page Objective: ${asString(pageObjective) || "(not provided)"}
Business Name: ${asString(safeBrief.businessName) || "(not provided)"}
Offer: ${asString(safeBrief.offer) || "(not provided)"}
Audience: ${asString(safeBrief.targetAudience) || "(not provided)"}
Goal: ${asString(safeBrief.goal) || "(not provided)"}
Notes: ${asString(safeBrief.notes) || "(none)"}
Tone: ${safeTone}
Tone Rules: ${TONE_RULES[safeTone]}

Block Type: ${safeBlockType}
Current Props JSON:
${JSON.stringify(safeProps, null, 2)}

Allowed keys to change (do not add others):
${JSON.stringify(Object.keys(schema))}

Return JSON with this exact shape:
{
  "patch": {
    "key": "new value"
  }
}

Rules:
- Rewrite only text/content fields; do not include style/layout keys.
- Keep each value concise and specific.
- Preserve item counts for arrays where possible.
- Keep CTA text under 5 words when present.
- If a key does not need changes, you can omit it from patch.
`,
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

    const patch = sanitizePatch(safeBlockType, parsed?.patch, safeProps);
    if (!Object.keys(patch).length) return res.status(200).json({ ok: true, patch: {} });
    return res.status(200).json({ ok: true, patch });
  } catch (err) {
    console.error("website regenerate-section-copy error:", err);
    return res.status(500).json({ error: "Failed to regenerate section copy" });
  }
}