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
    const { data: jobs, error: jobError } = await supabase
      .from('social_queue')
      .select('*')
      .eq('status', 'queued')
      .limit(10);

    if (jobError) throw jobError;

    for (const job of jobs) {
      try {
        const { data: post } = await supabase
          .from('social_posts')
          .select('*')
          .eq('id', job.post_id)
          .single();

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
              message: post.content
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
              platform_post_id: result.id,
              status: 'published',
              published_at: new Date().toISOString()
            })
            .eq('id', post.id);

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
            last_error: err.message
          })
          .eq('id', job.id);
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