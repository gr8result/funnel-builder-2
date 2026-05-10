// /pages/api/social/process-queue.js
// Queue processor — Meta, LinkedIn, X, TikTok

import { createClient } from "@supabase/supabase-js";
import { postToFacebook, postToInstagram } from "../../../lib/social/facebook";
import { postToLinkedIn } from "../../../lib/social/linkedin";
import { postToPinterest } from "../../../lib/social/pinterest";
import { postToX } from "../../../lib/social/x";
import { postToTikTok } from "../../../lib/social/tiktok";
import { postToYouTube } from "../../../lib/social/youtube";

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
      const { data: claimedRows } = await supabase
        .from("social_queue")
        .update({ status: "processing" })
        .eq("id", row.id)
        .eq('status', 'queued')
        .select('id');

      if (!claimedRows?.length) continue;

      const { data: post } = await supabase
        .from("social_posts")
        .select("*")
        .eq("id", row.post_id)
        .single();

      if (!post) throw new Error("Post not found");
      if (String(post.status || '').toLowerCase() === 'published') {
        await supabase
          .from('social_queue')
          .update({ status: 'completed', processed_at: new Date().toISOString() })
          .eq('id', row.id);
        continue;
      }

      const { data: account } = await supabase
        .from("social_accounts")
        .select("*")
        .eq("user_id", row.user_id)
        .eq("platform", row.platform)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!account) throw new Error("No connected account");

      let result;

      if (row.platform === "facebook") {
        result = await postToFacebook({
          pageId: account.account_id,
          accessToken: account.access_token,
          message: post.content,
          imageUrl: post.media_url || null,
        });
      } else if (row.platform === "instagram") {
        if (!post.media_url) {
          throw new Error("Instagram requires a media_url — post skipped");
        }
        result = await postToInstagram({
          igUserId: account.account_id,
          accessToken: account.access_token,
          caption: post.content,
          imageUrl: post.media_url,
        });
      } else if (row.platform === "linkedin") {
        result = await postToLinkedIn({
          accessToken: account.access_token,
          personUrn: `urn:li:person:${account.account_id}`,
          text: post.content,
          mediaUrl: post.media_url || null,
        });
      } else if (row.platform === "pinterest") {
        result = await postToPinterest({
          accessToken: account.access_token,
          text: post.content,
          imageUrl: post.media_url || null,
        });
      } else if (row.platform === "x") {
        result = await postToX({
          accessToken: account.access_token,
          text: post.content,
        });
      } else if (row.platform === "tiktok") {
        result = await postToTikTok({
          accessToken: account.access_token,
          text: post.content,
          videoUrl: post.media_url || null,
        });
      } else if (row.platform === "youtube") {
        if (!post.media_url) {
          throw new Error("YouTube requires a video file");
        }
        result = await postToYouTube({
          admin: supabase,
          userId: row.user_id,
          socialAccountId: account.id,
          accessToken: account.access_token,
          tokenExpiresAt: account.token_expires_at,
          text: post.content,
          videoUrl: post.media_url,
        });
      } else {
        throw new Error(`No publisher for platform: ${row.platform}`);
      }

      const postStatus = result?.mode === 'inbox_pending' ? 'exported' : 'published';

      await supabase
        .from("social_posts")
        .update({
          status: postStatus,
          platform_post_id: result?.post_id || result?.id || null,
          published_at: postStatus === 'published' ? new Date().toISOString() : null,
        })
        .eq("id", post.id);

      await supabase
        .from('social_schedule')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString(),
        })
        .eq('post_id', post.id)
        .eq('user_id', row.user_id)
        .in('status', ['scheduled', 'queued']);

      await supabase
        .from("social_queue")
        .delete()
        .eq("id", row.id);

    } catch (err) {
      await supabase
        .from("social_posts")
        .update({ status: "failed" })
        .eq("id", row.post_id)
        .neq("status", "published");

      await supabase
        .from("social_queue")
        .update({
          status: "failed",
          processed_at: new Date().toISOString(),
          last_error: err.message,
        })
        .eq("id", row.id);

      await supabase
        .from('social_schedule')
        .update({ status: 'scheduled', processed_at: null })
        .eq('post_id', row.post_id)
        .eq('user_id', row.user_id)
        .in('status', ['scheduled', 'queued']);
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
