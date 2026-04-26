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

  const { data: duePosts } = await supabase
    .from('social_schedule')
    .select('*')
    .lte('scheduled_for', now)
    .eq('status', 'scheduled');

  for (const item of duePosts) {
    await supabase.from('social_queue').insert({
      user_id: item.user_id,
      post_id: item.post_id,
      status: 'queued'
    });

    await supabase
      .from('social_schedule')
      .update({ status: 'processed' })
      .eq('id', item.id);
  }

  res.json({ processed: duePosts.length });
}