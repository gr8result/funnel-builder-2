import { OpenAI } from "openai";
import { supabase } from "../../../lib/supabaseAdmin";

// --- Template for a multi-page funnel ---
const FUNNEL_PAGES = [
  { key: "optin", title: "Opt-In Page" },
  { key: "sales", title: "Sales Page" },
  { key: "upsell", title: "Upsell Page" },
  { key: "thankyou", title: "Thank You Page" },
];

const SECTION_TEMPLATES = {
  optin: [
    "hero", "benefits", "lead-form", "trust-badges", "footer"
  ],
  sales: [
    "hero", "story-copy", "benefits", "testimonials", "pricing", "cta", "faq", "footer"
  ],
  upsell: [
    "hero", "benefits", "pricing", "cta", "footer"
  ],
  thankyou: [
    "thankyou", "footer"
  ]
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const { businessName, industry, offer, audience, goal, style } = req.body || {};
  if (!businessName || !offer) return res.status(400).json({ ok: false, error: "Missing required info" });

  try {
    // 1. Create funnel in DB
    const { data: funnel, error: funnelErr } = await supabase
      .from("funnels")
      .insert({
        name: businessName,
        description: `${offer} for ${audience || "everyone"}`,
        status: "draft",
        slug: slugify(businessName),
      })
      .select("id")
      .single();
    if (funnelErr) throw funnelErr;

    // 2. For each page, generate sections and content
    for (const page of FUNNEL_PAGES) {
      let htmlSections = [];
      for (const section of SECTION_TEMPLATES[page.key]) {
        // Use OpenAI to generate content for each section
        const prompt = buildSectionPrompt({
          section,
          businessName,
          industry,
          offer,
          audience,
          goal,
          style,
          page: page.title
        });
        const ai = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            { role: "system", content: "You are a world-class funnel copywriter and designer. Output only valid HTML for the requested section, styled inline, ready for GrapesJS. No explanations." },
            { role: "user", content: prompt }
          ],
          max_tokens: 1200,
        });
        htmlSections.push(ai.choices[0].message.content.trim());
      }
      const pageHtml = htmlSections.join("\n");
      // 3. Save step/page in DB
      await supabase.from("funnel_steps").insert({
        funnel_id: funnel.id,
        title: page.title,
        content: pageHtml,
        order_index: FUNNEL_PAGES.findIndex(p => p.key === page.key),
      });
    }
    return res.json({ ok: true, funnelId: funnel.id });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || "AI generation failed" });
  }
}

function slugify(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function buildSectionPrompt({ section, businessName, industry, offer, audience, goal, style, page }) {
  return `
Create the ${section} section for a high-converting ${page} for a business called "${businessName}" in the ${industry} industry. The main offer is: ${offer}.
Target audience: ${audience}.
Goal: ${goal}.
Style: ${style}.
Output only valid HTML for this section, styled inline, ready for GrapesJS. Use world-class copywriting and design. No explanations.`;
}
