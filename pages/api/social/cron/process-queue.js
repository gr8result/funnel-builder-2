import { createClient } from '@supabase/supabase-js';
import {
  postToFacebook,
  postToInstagram
} from '../../../../lib/social/facebook';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const now = new Date().toISOString();
    const { data: jobs, error: jobError } = await supabase
      .from('social_queue')
      .select('*')
      .eq('status', 'queued')
      .lte('scheduled_for', now)
      .limit(10);

    if (jobError) throw jobError;

    for (const job of jobs) {
      try {
        const { data: claimedJobs } = await supabase
          .from('social_queue')
          .update({ status: 'processing' })
          .eq('id', job.id)
          .eq('status', 'queued')
          .select('id');

        if (!claimedJobs?.length) continue;

        const { data: post } = await supabase
          .from('social_posts')
          .select('*')
          .eq('id', job.post_id)
          .single();

        if (String(post?.status || '').toLowerCase() === 'published') {
          await supabase
            .from('social_queue')
            .update({
              status: 'completed',
              processed_at: new Date().toISOString()
            })
            .eq('id', job.id);
          continue;
        }

        const { data: accounts } = await supabase
          .from('social_accounts')
          .select('*')
          .eq('user_id', job.user_id)
          .eq('is_active', true);

        let published = false;

        for (const acc of accounts) {
          if (acc.platform !== post.platform) continue;

          let result;

          if (acc.platform === 'facebook') {
            result = await postToFacebook({
              pageId: acc.account_id,
              accessToken: acc.access_token,
              message: post.content,
              imageUrl: post.media_url || null
            });
          }

          if (acc.platform === 'instagram') {
            result = await postToInstagram({
              igUserId: acc.account_id,
              accessToken: acc.access_token,
              caption: post.content,
              imageUrl: post.media_url
            });
          }

          if (!result) continue;

          await supabase
            .from('social_posts')
            .update({
              platform_post_id: result?.post_id || result?.id || null,
              status: 'published',
              published_at: new Date().toISOString()
            })
            .eq('id', post.id);

          await supabase
            .from('social_schedule')
            .update({
              status: 'processed',
              processed_at: new Date().toISOString()
            })
            .eq('post_id', post.id)
            .eq('user_id', job.user_id)
            .in('status', ['scheduled', 'queued']);

          published = true;
        }

        if (!published) {
          throw new Error('No matching account');
        }

        await supabase
          .from('social_queue')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString()
          })
          .eq('id', job.id);

      } catch (err) {
        await supabase
          .from('social_queue')
          .update({
            status: 'failed',
            processed_at: new Date().toISOString(),
            last_error: err.message
          })
          .eq('id', job.id);

        await supabase
          .from('social_schedule')
          .update({ status: 'scheduled', processed_at: null })
          .eq('post_id', job.post_id)
          .eq('user_id', job.user_id)
          .in('status', ['scheduled', 'queued']);
      }
    }

    return res.json({ success: true });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}
