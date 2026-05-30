import { requireUser } from '../../../lib/social/auth';
import { withAuth } from "../../../lib/withWorkspace";

// Supabase can return timestamps without a timezone marker (plain 'timestamp' columns
// or certain Postgres configs). Without 'Z', JavaScript parses the string as local time
// instead of UTC, causing a double-shift bug. Always normalise to UTC ISO.
function normTs(value) {
  if (!value) return null;
  const s = String(value);
  if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)) return s;
  return s + 'Z';
}

function sanitizeScheduleDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

async function handler(req, res) {
  const auth = await requireUser(req);
  if (auth.error) {
    return res.status(401).json({ ok: false, error: auth.error });
  }

  if (req.method === 'GET') {
    try {
      // Step 1: get all posts for this user
      const postsRes = await auth.admin
        .from('social_posts')
        .select('id, content, platform, status, created_at, media_url')
        .eq('user_id', auth.user.id)
        .order('created_at', { ascending: false });

      if (postsRes.error) throw postsRes.error;
      const posts = postsRes.data || [];

      // Step 2: get schedules by post_id (not user_id — avoids schema mismatch issues)
      // Fetch ALL status values so a missed status update doesn't hide the post
      let schedules = [];
      let queueRows = [];
      if (posts.length > 0) {
        const postIds = posts.map(p => p.id);
        const schedulesRes = await auth.admin
          .from('social_schedule')
          .select('id, post_id, scheduled_for, status, created_at')
          .in('post_id', postIds)
          .order('scheduled_for', { ascending: true });
        if (schedulesRes.error) throw schedulesRes.error;
        schedules = schedulesRes.data || [];

        const queueRes = await auth.admin
          .from('social_queue')
          .select('post_id, status, last_error, created_at, processed_at')
          .in('post_id', postIds)
          .order('created_at', { ascending: false });
        if (queueRes.error) throw queueRes.error;
        queueRows = queueRes.data || [];
      }

      // Keep the most-recently-set schedule per post (last updated wins)
      const scheduleByPost = new Map();
      for (const row of schedules) {
        const existing = scheduleByPost.get(row.post_id);
        // prefer entries with a scheduled_for; among ties keep latest created_at
        if (!existing || new Date(row.created_at) > new Date(existing.created_at)) {
          scheduleByPost.set(row.post_id, row);
        }
      }

      const queueByPost = new Map();
      for (const row of queueRows) {
        const existing = queueByPost.get(row.post_id);
        if (!existing || new Date(row.created_at) > new Date(existing.created_at)) {
          queueByPost.set(row.post_id, row);
        }
      }

      const cards = posts.map((post) => {
        const schedule = scheduleByPost.get(post.id) || null;
        const queue = queueByPost.get(post.id) || null;
        return {
          postId:      post.id,
          scheduleId:  schedule?.id || null,
          content:     post.content,
          platform:    post.platform,
          status:      post.status,
          mediaUrl:    post.media_url || null,
          createdAt:   post.created_at,
          scheduledFor: normTs(schedule?.scheduled_for) || null,
          lastError:   queue?.last_error || null,
        };
      });

      return res.status(200).json({ ok: true, cards });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message || 'Failed to load calendar board' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { postId, scheduledFor } = req.body || {};
      const iso = sanitizeScheduleDate(scheduledFor);
      if (!postId || !iso) {
        return res.status(400).json({ ok: false, error: 'postId and valid scheduledFor are required' });
      }

      const { data: post, error: postError } = await auth.admin
        .from('social_posts')
        .select('id, user_id')
        .eq('id', postId)
        .eq('user_id', auth.user.id)
        .single();

      if (postError || !post) {
        return res.status(404).json({ ok: false, error: 'Post not found' });
      }

      const { data: existing } = await auth.admin
        .from('social_schedule')
        .select('id')
        .eq('user_id', auth.user.id)
        .eq('post_id', postId)
        .eq('status', 'scheduled')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        const { error: updateError } = await auth.admin
          .from('social_schedule')
          .update({ scheduled_for: iso })
          .eq('id', existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await auth.admin
          .from('social_schedule')
          .insert({
            user_id: auth.user.id,
            post_id: postId,
            scheduled_for: iso,
            status: 'scheduled'
          });
        if (insertError) throw insertError;
      }

      await auth.admin
        .from('social_posts')
        .update({ status: 'scheduled' })
        .eq('id', postId)
        .eq('user_id', auth.user.id);

      return res.status(200).json({ ok: true });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message || 'Failed to reschedule post' });
    }
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}

export default withAuth(handler);
