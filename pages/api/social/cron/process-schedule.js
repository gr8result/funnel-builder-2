//  /pages/api/social/cron/process-schedule.js

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const now = new Date().toISOString();

  const { data: duePosts, error } = await supabase
    .from('social_schedule')
    .select('*, social_posts(status, platform)')
    .lte('scheduled_for', now)
    .in('status', ['scheduled', 'queued']);

  if (error) {
    return res.status(500).json({ success: false, error: error.message });
  }

  for (const item of duePosts || []) {
    const postStatus = String(item.social_posts?.status || '').toLowerCase();
    if (postStatus === 'published' || postStatus === 'posted') {
      await supabase
        .from('social_schedule')
        .update({ status: 'processed', processed_at: new Date().toISOString() })
        .eq('id', item.id);
      continue;
    }

    const { data: existingQueue } = await supabase
      .from('social_queue')
      .select('id, status')
      .eq('post_id', item.post_id)
      .in('status', ['queued', 'processing', 'completed', 'failed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingQueue?.status === 'completed') {
      await supabase
        .from('social_schedule')
        .update({ status: 'processed', processed_at: new Date().toISOString() })
        .eq('id', item.id);
      continue;
    }

    if (existingQueue?.status === 'queued' || existingQueue?.status === 'processing') {
      await supabase
        .from('social_schedule')
        .update({ status: 'queued', processed_at: null })
        .eq('id', item.id);
      continue;
    }

    if (existingQueue?.status === 'failed') {
      await supabase
        .from('social_queue')
        .update({
          status: 'queued',
          last_error: null,
          processed_at: null,
          scheduled_for: item.scheduled_for,
        })
        .eq('id', existingQueue.id);

      await supabase
        .from('social_schedule')
        .update({ status: 'queued', processed_at: null })
        .eq('id', item.id);
      continue;
    }

    await supabase.from('social_queue').insert({
      user_id: item.user_id,
      post_id: item.post_id,
      platform: item.social_posts?.platform || 'facebook',
      scheduled_for: item.scheduled_for,
      status: 'queued',
    });

    await supabase
      .from('social_schedule')
      .update({ status: 'queued', processed_at: null })
      .eq('id', item.id);
  }

  res.json({ processed: duePosts?.length || 0 });
}
