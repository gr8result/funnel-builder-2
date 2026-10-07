import { requireUser } from "../../../lib/social/auth";
import { postToFacebook, postToInstagram } from "../../../lib/social/facebook";
import { postToLinkedIn } from "../../../lib/social/linkedin";
import { postToPinterest } from "../../../lib/social/pinterest";
import { postToX } from "../../../lib/social/x";
import { postToTikTok, refreshTikTokAccountAccess } from "../../../lib/social/tiktok";
import { postToYouTube } from "../../../lib/social/youtube";
import { withAuth } from "../../../lib/withWorkspace";
import { getRequestDemoState, requestWorkspaceId, demoSimulationResult } from "../../../lib/demoWorkspace";

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const auth = await requireUser(req);
  if (auth.error) {
    return res.status(401).json({ ok: false, error: auth.error });
  }

  const { postId } = req.body || {};
  if (!postId) {
    return res.status(400).json({ ok: false, error: "Missing postId" });
  }
  const workspaceId = requestWorkspaceId(req);
  const demoState = await getRequestDemoState(req);

  try {
    let postQuery = auth.admin
      .from("social_posts")
      .select("*")
      .eq("id", postId)
      .eq("user_id", auth.user.id);
    if (workspaceId) postQuery = postQuery.eq("workspace_id", workspaceId);
    const { data: post, error: postErr } = await postQuery.maybeSingle();

    if (postErr || !post) {
      return res.status(404).json({ ok: false, error: "Post not found" });
    }
    const effectiveWorkspaceId = workspaceId || post.workspace_id || null;

    if (demoState.isDemo) {
      const result = await demoSimulationResult({
        workspaceId,
        userId: auth.user.id,
        actionType: "social-publish",
        provider: post.platform,
        target: postId,
        payload: { postId, platform: post.platform, content: post.content, media_url: post.media_url },
        message: "Demo social publish simulated - no external social account was contacted.",
      });
      await auth.admin
        .from("social_posts")
        .update({
          status: "demo_simulated",
          workspace_id: workspaceId || post.workspace_id || null,
          platform_post_id: `demo_${post.id}`,
          published_at: new Date().toISOString(),
        })
        .eq("id", post.id)
        .eq("user_id", auth.user.id)
        .eq("workspace_id", effectiveWorkspaceId);
      await auth.admin
        .from("social_schedule")
        .update({ status: "demo_simulated", processed_at: new Date().toISOString() })
        .eq("post_id", post.id)
        .eq("user_id", auth.user.id)
        .eq("workspace_id", effectiveWorkspaceId)
        .in("status", ["scheduled", "queued"]);
      await auth.admin
        .from("social_queue")
        .update({ status: "demo_simulated", processed_at: new Date().toISOString() })
        .eq("post_id", post.id)
        .eq("user_id", auth.user.id)
        .eq("workspace_id", effectiveWorkspaceId)
        .in("status", ["queued", "processing", "failed"]);
      return res.status(200).json({ ok: true, demo: true, simulated: true, result, postStatus: "demo_simulated" });
    }

    const { data: account, error: accErr } = await auth.admin
      .from("social_accounts")
      .select("*")
      .eq("user_id", auth.user.id)
      .eq("platform", post.platform)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (accErr || !account) {
      return res.status(400).json({ ok: false, error: `No connected ${post.platform} account` });
    }

    let result;

    if (post.platform === "facebook") {
      result = await postToFacebook({
        pageId: account.account_id,
        accessToken: account.access_token,
        message: post.content,
        imageUrl: post.media_url || null,
      });
    } else if (post.platform === "instagram") {
      if (!post.media_url) {
        return res.status(400).json({ ok: false, error: "Instagram requires an image. Add a media URL to this post before publishing." });
      }
      result = await postToInstagram({
        igUserId: account.account_id,
        accessToken: account.access_token,
        caption: post.content,
        imageUrl: post.media_url,
      });
    } else if (post.platform === "linkedin") {
      result = await postToLinkedIn({
        accessToken: account.access_token,
        personUrn: `urn:li:person:${account.account_id}`,
        text: post.content,
        mediaUrl: post.media_url || null,
      });
    } else if (post.platform === "pinterest") {
      result = await postToPinterest({
        accessToken: account.access_token,
        text: post.content,
        imageUrl: post.media_url || null,
      });
    } else if (post.platform === "x") {
      result = await postToX({
        accessToken: account.access_token,
        text: post.content,
      });
    } else if (post.platform === "tiktok") {
      try {
        result = await postToTikTok({
          accessToken: account.access_token,
          text: post.content,
          videoUrl: post.media_url || null,
        });
      } catch (error) {
        if (error?.code !== 'access_token_invalid') {
          throw error;
        }

        const refreshed = await refreshTikTokAccountAccess({
          admin: auth.admin,
          userId: auth.user.id,
          socialAccountId: account.id,
        });

        result = await postToTikTok({
          accessToken: refreshed.accessToken,
          text: post.content,
          videoUrl: post.media_url || null,
        });
      }
    } else if (post.platform === "youtube") {
      if (!post.media_url) {
        return res.status(400).json({ ok: false, error: "YouTube requires a video file. Add a video before publishing." });
      }
      result = await postToYouTube({
        admin: auth.admin,
        userId: auth.user.id,
        socialAccountId: account.id,
        accessToken: account.access_token,
        tokenExpiresAt: account.token_expires_at,
        text: post.content,
        videoUrl: post.media_url,
      });
    } else {
      return res.status(400).json({ ok: false, error: `Publishing for ${post.platform} is not yet supported` });
    }

    const postStatus = 'published';

    await auth.admin
      .from("social_posts")
      .update({
        status: postStatus,
        platform_post_id: result?.post_id || result?.id || null,
        published_at: postStatus === 'published' ? new Date().toISOString() : null,
      })
      .eq("id", post.id)
      .eq("user_id", auth.user.id)
      .eq("workspace_id", effectiveWorkspaceId);

    await auth.admin
      .from('social_schedule')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
      })
      .eq('post_id', post.id)
      .eq('user_id', auth.user.id)
      .eq('workspace_id', effectiveWorkspaceId)
      .in('status', ['scheduled', 'queued']);

    await auth.admin
      .from('social_queue')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
      })
      .eq('post_id', post.id)
      .eq('user_id', auth.user.id)
      .eq('workspace_id', effectiveWorkspaceId)
      .in('status', ['queued', 'processing', 'failed']);

    return res.status(200).json({ ok: true, result, postStatus });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

export default withAuth(handler);
