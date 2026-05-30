// /pages/api/social/get-posts.js

import { createClient } from '@supabase/supabase-js';
import { withAuth } from "../../../lib/withWorkspace";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function handler(req, res) {
  try {
    const { data, error } = await admin
      .from('social_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    return res.json({
      success: true,
      posts: data
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

export default withAuth(handler);
