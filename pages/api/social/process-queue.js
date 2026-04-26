// /pages/api/social/process-queue.js
// Queue processor — Meta, LinkedIn, X, TikTok

import { createClient } from "@supabase/supabase-js";
import { postToFacebook, postToInstagram } from "../../../lib/social/facebook";
import { postToLinkedIn } from "../../../lib/social/linkedin";
import { postToX } from "../../../lib/social/x";
import { postToTikTok } from "../../../lib/social/tiktok";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function processQueue() {
  const now = new Date().toISOString();

  const { data: rows } = await supabase
    .from("social_queue")
    .select("*")
    .eq("status", "queued")
    .lte("scheduled_for", now)
    .limit(10);

  if (!rows?.length) return;

  for (const row of rows) {
    try {
      await supabase
        .from("social_queue")
        .update({ status: "processing" })
        .eq("id", row.id);

      const { data: post } = await supabase
        .from("social_posts")
        .select("*")
        .eq("id", row.post_id)
        .single();

      if (!post) throw new Error("Post not found");

      const { data: account } = await supabase
        .from("social_accounts")
        .select("*")
        .eq("user_id", row.user_id)
        .eq("platform", row.platform)
        .maybeSingle();

      if (!account) throw new Error("No connected account");

      // 🔥 PLATFORM HANDLING
      if (row.platform === "facebook") {
        await postToFacebook({
          pageId: account.account_id,
          accessToken: account.access_token,
          message: post.content,
        });
      } else if (row.platform === "instagram") {
        if (!post.media_url) {
          throw new Error("Instagram requires a media_url — post skipped");
        }
        await postToInstagram({
          igUserId: account.account_id,
          accessToken: account.access_token,
          caption: post.content,
          imageUrl: post.media_url,
        });
      } else if (row.platform === "linkedin") {
        await postToLinkedIn({
          accessToken: account.access_token,
          personUrn: `urn:li:person:${account.account_id}`,
          text: post.content,
          mediaUrl: post.media_url || null,
        });
      } else if (row.platform === "x") {
        await postToX({
          accessToken: account.access_token,
          text: post.content,
        });
      } else if (row.platform === "tiktok") {
        await postToTikTok({
          accessToken: account.access_token,
          text: post.content,
        });
      } else {
        throw new Error(`No publisher for platform: ${row.platform}`);
      }

      await supabase
        .from("social_posts")
        .update({ status: "posted" })
        .eq("id", post.id);

      await supabase
        .from("social_queue")
        .delete()
        .eq("id", row.id);

    } catch (err) {
      await supabase
        .from("social_queue")
        .update({
          status: "failed",
          last_error: err.message,
        })
        .eq("id", row.id);
    }
  }
}

export default async function handler(req, res) {
  try {
    await processQueue();
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}