import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const now = new Date().toISOString();

    const { data: due, error } = await supabase
      .from('social_schedule')
      .select('*, social_posts(platform)')
      .lte('scheduled_for', now)
      .eq('status', 'scheduled');

    if (error) throw error;

    for (const item of (due || [])) {
      // Move to queue
      await supabase.from('social_queue').insert({
        user_id: item.user_id,
        post_id: item.post_id,
        platform: item.social_posts?.platform || 'facebook',
        scheduled_for: item.scheduled_for,
        status: 'queued',
        priority: 1
      });

      // Mark processed
      await supabase
        .from('social_schedule')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString()
        })
        .eq('id', item.id);
    }

    return res.json({ success: true, moved: due.length });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}