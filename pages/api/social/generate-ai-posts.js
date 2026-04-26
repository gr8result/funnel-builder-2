// /pages/api/social/generate-ai-posts.js
// FULL FILE — AI content generator for social posts

import { createClient } from "@supabase/supabase-js";
import { checkSocialLimit } from '../../../lib/social/checkSocialLimit';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function generateAIContent({
  niche,
  tone,
  goal,
  platform,
  count,
}) {
  const prompt = `
You are a world-class social media strategist.

Create ${count} high-converting ${platform} posts.

Business niche: ${niche}
Tone: ${tone}
Goal: ${goal}

Each post must include:
- Caption
- Hook (first line attention grab)
- Call to action
- Hashtags

Return JSON array only.
`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    }),
  });

  const data = await response.json();

  const text = data?.choices?.[0]?.message?.content || "[]";

  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const {
      user_id,
      niche,
      tone,
      goal,
      platform = "facebook",
      count = 10,
      save = false,
    } = req.body || {};

    if (!niche || !goal) {
      return res.status(400).json({
        ok: false,
        error: "Missing niche or goal",
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Enforce monthly post limit server-side before calling OpenAI
    if (save && user_id) {
      const limitCheck = await checkSocialLimit(supabase, user_id, count);
      if (!limitCheck.allowed) {
        return res.status(403).json({ ok: false, error: limitCheck.error });
      }
    }

    const posts = await generateAIContent({
      niche,
      tone,
      goal,
      platform,
      count,
    });

    let savedPosts = [];

    if (save && user_id && posts.length) {
      const inserts = posts.map((p) => ({
        user_id,
        content: p.caption || "",
        hashtags: p.hashtags || "",
        platform,
        status: "draft",
      }));

      const { data, error } = await supabase
        .from("social_posts")
        .insert(inserts)
        .select();

      if (!error) {
        savedPosts = data;
        // Log usage — write-only, never decremented on delete
        await supabase.from('social_usage_log').insert({
          user_id,
          posts_count: savedPosts.length,
          source: 'generate-ai-posts',
        }).then(() => {});
      }
    }

    return res.status(200).json({
      ok: true,
      posts,
      saved: savedPosts,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e.message,
    });
  }
}