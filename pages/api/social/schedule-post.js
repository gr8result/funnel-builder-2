// /pages/api/social/schedule-post.js
import { requireUser } from '../../../lib/social/auth';
import { withAuth } from "../../../lib/withWorkspace";
import { requestWorkspaceId } from "../../../lib/demoWorkspace";

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const auth = await requireUser(req);
  if (auth.error) return res.status(401).json({ ok: false, error: auth.error });

  try {
    const { post_id, scheduled_for } = req.body || {};
    const user_id = auth.user.id;
    const workspaceId = requestWorkspaceId(req) || req.workspaceId || null;

    if (!post_id || !scheduled_for) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }

    // Verify the post belongs to this user
    let postQuery = auth.admin
      .from('social_posts')
      .select('id, workspace_id')
      .eq('id', post_id)
      .eq('user_id', user_id);
    if (workspaceId) postQuery = postQuery.eq('workspace_id', workspaceId);
    const { data: postCheck } = await postQuery.maybeSingle();
    if (!postCheck) return res.status(404).json({ ok: false, error: 'Post not found' });

    const supabase = auth.admin;

    // Insert into schedule
    const { error: scheduleError } = await supabase
      .from('social_schedule')
      .insert({ user_id, workspace_id: workspaceId || postCheck.workspace_id || null, post_id, scheduled_for, status: 'scheduled' });

    if (scheduleError) {
      return res.status(500).json({ ok: false, error: scheduleError.message });
    }

    // Update post status to scheduled
    await supabase
      .from('social_posts')
      .update({ status: 'scheduled', workspace_id: workspaceId || postCheck.workspace_id || null, updated_at: new Date().toISOString() })
      .eq('id', post_id)
      .eq('user_id', user_id);

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}

export default withAuth(handler);
