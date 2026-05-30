// /pages/api/email/ai-generate.js
// Generate a full email block array from a natural-language prompt using GPT-4o
// Optionally auto-generates images via DALL-E 3 and uploads them to Supabase
import { createClient } from "@supabase/supabase-js";
import { withAuth } from "../../../lib/withWorkspace";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
const BUCKET = "email-user-assets";

async function generateAndUploadImage(prompt, userId, key) {
  try {
    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "dall-e-3", prompt, n: 1, size: "1792x1024", response_format: "url" }),
    });
    const j = await r.json();
    const imageUrl = j?.data?.[0]?.url;
    if (!imageUrl) return "";

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return "";
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    const path = `${userId}/email-images/ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const { error } = await admin.storage.from(BUCKET).upload(path, buffer, { contentType: "image/png", upsert: false });
    if (error) return "";

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
    return pub?.publicUrl || "";
  } catch {
    return "";
  }
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "POST only" });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(500).json({ ok: false, error: "OPENAI_API_KEY not configured" });

  const { description, tone = "professional", goal = "general", brandName = "", generateImages = false } = req.body || {};
  const userId = req.user.id;
  if (!description) return res.status(400).json({ ok: false, error: "Missing description" });

  const SYSTEM = `You are a world-class email copywriter and designer. You write genuinely compelling, specific, detailed email copy — never generic filler.

You output a JSON object: { "blocks": [...], "subject": "..." }

Each block: { "type": string, "props": object, "imagePrompt": string (optional) }

Block types and props:
  header  – { title, subtitle, bgColor, textColor, logoSrc:"" }
  hero    – { headline, subtext, ctaText, ctaHref:"#", bgColor, textColor, ctaBgColor, ctaTextColor, paddingY:48, imageSrc:"" }
  text    – { html, bgColor:"#ffffff", textColor:"#1e293b", fontSize:16, align:"left" }
  image   – { src:"", alt, align:"center", widthPct:100, borderRadius:8, linkHref:"" }
  button  – { text, href:"#", bgColor:"#2563eb", textColor:"#ffffff", borderRadius:8, align:"center", widthMode:"auto", paddingY:14 }
  grid    – { bgColor:"#f8fafc", columns:[{ imageSrc:"", title, text, linkHref:"" }, { imageSrc:"", title, text, linkHref:"" }] }
  list    – { bgColor:"#ffffff", items:[{ imageSrc:"", title, text, linkHref:"" }, ...] }
  social  – { bgColor:"#eff6ff", platforms:[{ name:"facebook", href:"" }, { name:"instagram", href:"" }, { name:"linkedin", href:"" }, { name:"x", href:"" }] }
  footer  – { company, address:"", unsubscribeHref:"#", bgColor:"#f1f5f9", textColor:"#64748b" }
  divider – { color:"#e2e8f0", thickness:1, style:"solid", widthPct:80 }

CRITICAL COPY RULES — violating these makes the email useless:
1. Write REAL, SPECIFIC content based on the description. Never use placeholder text like "lorem ipsum", "coming soon", "Module 1", or "Description text".
2. The header title should be the brand name. Subtitle should be a punchy tagline specific to the email topic.
3. Hero headline must be powerful, specific, and tied to the actual content — not generic. Use numbers, specifics, power words.
4. All text blocks must contain multiple paragraphs of real, detailed copy about the topic. Minimum 3 sentences per text block.
5. Grid/list titles and descriptions must describe real specific features, benefits, or items — not "Feature One" or "Card Two".
6. Button text must be action-specific: "Start Your Free Trial", "Claim 50% Off", "See the Full Platform", etc.
7. Use <strong> tags in text html for emphasis on key phrases. Use <ul><li> lists to break up benefits.

LAYOUT RULES:
- Start with header, then hero for most emails.
- After hero: a detailed text block explaining the topic.
- Use a grid (2 cols) or list for features/benefits — write real content for each.
- Add another text block for social proof, story, or detail.
- End with a prominent button, then divider, social, footer.
- Aim for 8–12 blocks total.

imagePrompt rules (only when generateImages=true):
- Add "imagePrompt" to hero, image, and grid/list item blocks that need images.
- Write vivid, specific DALL-E prompts: style, subject, lighting, mood. Example: "Professional flat-lay of business analytics dashboard on dark background, neon blue data visualization, modern tech aesthetic, high detail"
- For hero: wide landscape (1792x1024). For grid items: square product shots.

Color guidance:
- header: use brand-appropriate color (dark navy, bold blue, etc.)
- hero: dark or vibrant background with white text
- buttons: bold, high-contrast

Return ONLY valid JSON { "blocks": [...], "subject": "..." }`;

  const USER = `Brand/Company: ${brandName || "the company"}
Email Goal: ${goal}
Tone: ${tone}
Generate images: ${generateImages ? "YES — add imagePrompt to blocks that need visuals" : "NO — leave imageSrc/src as empty string"}

DETAILED BRIEF:
${description}

Write compelling, SPECIFIC, DETAILED copy throughout. This email must be ready to send after adding images — all text must be final, polished marketing copy.`;

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: USER },
        ],
        temperature: 0.8,
        max_tokens: 5000,
        response_format: { type: "json_object" },
      }),
    });

    const j = await r.json();
    if (!r.ok) return res.status(500).json({ ok: false, error: j?.error?.message || "OpenAI error" });

    const raw = j?.choices?.[0]?.message?.content?.trim() || "";
    let parsed;
    try { parsed = JSON.parse(raw); } catch {
      return res.status(500).json({ ok: false, error: "AI returned invalid JSON" });
    }

    let blocks = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.blocks) ? parsed.blocks : Object.values(parsed).find(v => Array.isArray(v)) || []);
    const subject = parsed?.subject || "";

    const VALID = new Set(["header","text","image","button","divider","hero","grid","list","social","footer","spacer"]);
    blocks = blocks.filter(b => b && VALID.has(b.type)).map(b => ({ type: b.type, props: b.props || {}, imagePrompt: b.imagePrompt || "" }));

    // Auto-generate images if requested
    if (generateImages && userId) {
      const imageJobs = [];

      // hero image
      const heroIdx = blocks.findIndex(b => b.type === "hero" && b.imagePrompt);
      if (heroIdx >= 0) imageJobs.push({ idx: heroIdx, field: "imageSrc", prompt: blocks[heroIdx].imagePrompt });

      // standalone image blocks
      blocks.forEach((b, i) => {
        if (b.type === "image" && b.imagePrompt) imageJobs.push({ idx: i, field: "src", prompt: b.imagePrompt });
      });

      // grid columns
      blocks.forEach((b, i) => {
        if (b.type === "grid") {
          (b.props.columns || []).forEach((col, ci) => {
            const prompt = col.imagePrompt || b.imagePrompt;
            if (prompt) imageJobs.push({ idx: i, field: "grid_col", colIdx: ci, prompt });
          });
        }
      });

      // generate all in parallel (cap at 4 to avoid timeout)
      const jobs = imageJobs.slice(0, 4);
      const results = await Promise.all(jobs.map(job => generateAndUploadImage(job.prompt, userId, key)));

      jobs.forEach((job, ji) => {
        const url = results[ji];
        if (!url) return;
        if (job.field === "imageSrc") blocks[job.idx].props.imageSrc = url;
        else if (job.field === "src") blocks[job.idx].props.src = url;
        else if (job.field === "grid_col") {
          const cols = [...(blocks[job.idx].props.columns || [])];
          if (cols[job.colIdx]) cols[job.colIdx] = { ...cols[job.colIdx], imageSrc: url };
          blocks[job.idx].props.columns = cols;
        }
      });
    }

    // strip internal imagePrompt before returning
    blocks = blocks.map(({ imagePrompt: _, ...b }) => b);

    return res.status(200).json({ ok: true, blocks, subject });
  } catch (e) {
    console.error("ai-generate error:", e);
    return res.status(500).json({ ok: false, error: e.message || "AI failed" });
  }
}

export default withAuth(handler);
