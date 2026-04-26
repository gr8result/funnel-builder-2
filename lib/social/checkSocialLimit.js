// /lib/social/checkSocialLimit.js
// Server-side enforcement of the social media AI post limit.
// Uses social_usage_log (write-only, never decremented on delete).
// Returns { allowed: true } or { allowed: false, error: string }

const PRICING = {
  'social-starter': { aiPostsPerMonth: 50 },
  'social-growth':  { aiPostsPerMonth: 200 },
  'social-pro':     { aiPostsPerMonth: 500 },
  'social-agency':  { aiPostsPerMonth: 2000 },
};

export async function checkSocialLimit(adminClient, userId, postsRequested = 1) {
  try {
    // 1. Get the user's social plan tier from user_modules
    const { data: moduleRows } = await adminClient
      .from('user_modules')
      .select('module_id')
      .eq('user_id', userId);

    const ids = (moduleRows || []).map((r) => r.module_id);
    const tierRow = ids.find((id) => id.startsWith('__social_plan_tier:'));
    const tier = tierRow ? tierRow.split(':')[1] : null;
    const plan = tier ? PRICING[tier] : null;

    // No plan = no AI post generation allowed
    if (!plan) {
      return { allowed: false, error: 'No active social media plan. Please select a plan to generate posts.' };
    }

    const limit = plan.aiPostsPerMonth;

    // 2. Count posts GENERATED this calendar month from the immutable log
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { data: usageRows, error: usageErr } = await adminClient
      .from('social_usage_log')
      .select('posts_count')
      .eq('user_id', userId)
      .gte('created_at', monthStart.toISOString());

    if (usageErr) {
      // Table may not exist yet on first deploy — fail open so existing users aren't blocked
      console.warn('[checkSocialLimit] social_usage_log not available:', usageErr.message);
      return { allowed: true, warn: 'usage_log_unavailable' };
    }

    const used = (usageRows || []).reduce((sum, r) => sum + (r.posts_count || 0), 0);

    if (used + postsRequested > limit) {
      return {
        allowed: false,
        error: `Monthly post limit reached (${used}/${limit}). Upgrade your Social Media plan to continue.`,
        used,
        limit,
      };
    }

    return { allowed: true, used, limit };
  } catch (e) {
    console.error('[checkSocialLimit] unexpected error:', e.message);
    // Fail open on unexpected errors — don't block users due to infrastructure issues
    return { allowed: true, warn: 'limit_check_failed' };
  }
}
