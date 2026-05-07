import crypto from "crypto";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getServiceFallbackImageUrlBySlug } from "../../../lib/funnelSections";

function safeText(value, max = 160) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function safeInt(value, fallback) {
  const parsed = Number.parseInt(`${value || ""}`, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildPrompt({ trade, title, subtitle, service, keywords, variant, slot }) {
  const keywordText = keywords.length ? `Keywords: ${keywords.join(", ")}.` : "";
  const slotText = slot ? `Shot variation: ${slot}.` : "";
  const framing = variant === "hero"
    ? "Create a premium full-width hero image for a live landing page."
    : variant === "gallery"
      ? "Create a polished supporting website image for a service-business proof section."
      : "Create a clean supporting website image for a service card or content section.";

  return [
    framing,
    "Photorealistic trade or local-service marketing image.",
    "Australian context only.",
    `Trade: ${trade}.`,
    `Focus: ${title}.`,
    subtitle ? `Context: ${subtitle}.` : "",
    service ? `Service detail: ${service}.` : "",
    slotText,
    keywordText,
    "Show realistic people, tools, vehicles, workspaces, equipment, or finished results relevant to the trade.",
    "If buildings, vehicles, streets, packaging, uniforms, or suburbs are visible, they must feel appropriate for Australia.",
    "No American flags, no US police cars, no US road markings, no European streetscapes, and no recognisable overseas landmarks.",
    "No text overlays, no words in the image, no watermarks, no logos, no UI mockups.",
    "No animals, pets, cartoons, or unrelated subjects unless explicitly required by the trade.",
    "Strong composition, natural lighting, production-quality website photography.",
  ].filter(Boolean).join("\n");
}

function redirectFallback(res, { slug, variant, title, subtitle, service, slot }) {
  const fallbackUrl = getServiceFallbackImageUrlBySlug(slug, variant, {
    title,
    subtitle,
    caption: title,
    service,
    slot,
  });

  if (!fallbackUrl) {
    return res.status(503).redirect("/archive/templates/thumbs/placeholder.png");
  }

  res.setHeader("Cache-Control", "public, max-age=86400");
  return res.redirect(fallbackUrl);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method not allowed");
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return redirectFallback(res, {
      slug: safeText(req.query.slug, 80) || "service",
      variant: safeText(req.query.variant, 24) || "hero",
      title: safeText(req.query.title, 160),
      subtitle: safeText(req.query.subtitle, 180),
      service: safeText(req.query.service, 160),
      slot: safeText(req.query.slot, 60),
    });
  }

  const slug = safeText(req.query.slug, 80) || "service";
  const variant = safeText(req.query.variant, 24) || "hero";
  const trade = safeText(req.query.trade, 140) || "Local Service";
  const title = safeText(req.query.title, 160) || trade;
  const subtitle = safeText(req.query.subtitle, 180);
  const service = safeText(req.query.service, 160);
  const slot = safeText(req.query.slot, 60);
  const keywords = safeText(req.query.keywords, 220)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 6);
  const width = safeInt(req.query.width, variant === "hero" ? 1600 : 960);
  const height = safeInt(req.query.height, variant === "hero" ? 900 : 720);

  const promptPayload = { slug, trade, title, subtitle, service, slot, keywords, variant, width, height };
  const promptHash = crypto.createHash("sha1").update(JSON.stringify(promptPayload)).digest("hex").slice(0, 16);
  const fileDir = `system/funnel-template-images/${slug}`;
  const fileName = `${variant}-${promptHash}.png`;
  const filePath = `${fileDir}/${fileName}`;

  try {
    const { data: existing } = await supabaseAdmin.storage.from("assets").list(fileDir, {
      limit: 100,
      search: fileName,
    });

    if (Array.isArray(existing) && existing.some((entry) => entry.name === fileName)) {
      const { data: publicUrlData } = supabaseAdmin.storage.from("assets").getPublicUrl(filePath);
      if (publicUrlData?.publicUrl) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return res.redirect(publicUrlData.publicUrl);
      }
    }

    const prompt = buildPrompt({ trade, title, subtitle, service, keywords, variant, slot });
    const size = width >= height ? "1536x1024" : "1024x1536";

    const genRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size,
        n: 1,
      }),
    });

    const genJson = await genRes.json();
    if (!genRes.ok) {
        return redirectFallback(res, { slug, variant, title, subtitle, service, slot });
    }

    const item = genJson?.data?.[0];
    const directUrl = item?.url || null;
    const b64 = item?.b64_json || null;
    if (!directUrl && !b64) {
        return redirectFallback(res, { slug, variant, title, subtitle, service, slot });
    }

    let bytes;
    if (b64) {
      bytes = Buffer.from(b64, "base64");
    } else {
      const download = await fetch(directUrl);
      if (!download.ok) {
          return redirectFallback(res, { slug, variant, title, subtitle, service, slot });
      }
      bytes = Buffer.from(await download.arrayBuffer());
    }

    const { error: uploadError } = await supabaseAdmin.storage.from("assets").upload(filePath, bytes, {
      contentType: "image/png",
      upsert: true,
    });

    if (uploadError) {
        return redirectFallback(res, { slug, variant, title, subtitle, service, slot });
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from("assets").getPublicUrl(filePath);
    if (!publicUrlData?.publicUrl) {
        return redirectFallback(res, { slug, variant, title, subtitle, service, slot });
    }

    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.redirect(publicUrlData.publicUrl);
  } catch (error) {
      return redirectFallback(res, { slug, variant, title, subtitle, service, slot });
  }
}