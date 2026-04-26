// /pages/api/social/create-post.js

import { requireUser } from '../../../lib/social/auth';
import { createClient } from '@supabase/supabase-js';
import { checkSocialLimit } from '../../../lib/social/checkSocialLimit';

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const auth = await requireUser(req);
    if (auth.error) {
      return res.status(401).json({ success: false, error: auth.error });
    }
    const userId = auth.user.id;

    const { content, platform, mediaUrl, scheduledFor } = req.body;

    if (!content || !platform) {
      return res.status(400).json({
        success: false,
        error: 'Missing fields'
      });
    }

    // Enforce monthly post limit server-side
    const limitCheck = await checkSocialLimit(admin, userId, 1);
    if (!limitCheck.allowed) {
      return res.status(403).json({ success: false, error: limitCheck.error });
    }

    let normalizedScheduledFor = null;
    if (scheduledFor) {
      const d = new Date(scheduledFor);
      const yr = d.getFullYear();
      if (isNaN(d.getTime()) || yr < 2024 || yr > 2035) {
        return res.status(400).json({ success: false, error: `Invalid scheduled date (year ${yr}). Please re-enter the date.` });
      }
      normalizedScheduledFor = d.toISOString();
    }

    const { data, error } = await admin
      .from('social_posts')
      .insert({
        user_id: userId,
        content,
        platform,
        media_url: mediaUrl || null,
        status: normalizedScheduledFor ? 'scheduled' : 'draft'
      })
      .select()
      .single();

    if (error) {
      console.error('DB ERROR:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    if (normalizedScheduledFor) {
      const { error: scheduleError } = await admin
        .from('social_schedule')
        .insert({
          user_id: userId,
          post_id: data.id,
          scheduled_for: normalizedScheduledFor,
          status: 'scheduled'
        });

      if (scheduleError) {
        console.error('SCHEDULE ERROR:', scheduleError);
        return res.status(500).json({
          success: false,
          error: scheduleError.message
        });
      }

      const { error: queueError } = await admin
        .from('social_queue')
        .insert({
          user_id: userId,
          post_id: data.id,
          platform,
          scheduled_for: normalizedScheduledFor,
          status: 'queued'
        });

      if (queueError) {
        console.error('QUEUE ERROR:', queueError);
        return res.status(500).json({
          success: false,
          error: queueError.message
        });
      }
    }

    // Log usage — never deleted even if the post is deleted
    await admin.from('social_usage_log').insert({
      user_id: userId,
      posts_count: 1,
      source: 'create-post',
    }).then(() => {});  // fire-and-forget, don't block the response

    return res.json({
      success: true,
      post: data
    });

  } catch (err) {
    console.error('FATAL:', err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}