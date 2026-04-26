// /lib/social/botProcessor.js
// Called by the Facebook webhook handler for every incoming comment or DM.
// 1. Find which user owns the page (account_id matches)
// 2. Load their active bot rules
// 3. Match the message against keyword rules
// 4. Fire reply_comment, reply_dm, like_comment as configured
// 5. Log everything to social_bot_conversations

// ── Keyword matching ──────────────────────────────────────────────────────────
function matchesRule(rule, message) {
  const text = message.toLowerCase().trim();

  if (rule.trigger_type === 'any' || rule.trigger_type === 'dm_any') {
    return true;
  }

  if (!rule.keywords?.length) return false;

  const keywords = rule.keywords.map(k => k.toLowerCase());
  if (rule.match_mode === 'all') {
    return keywords.every(k => text.includes(k));
  }
  // default: 'any'
  return keywords.some(k => text.includes(k));
}

function scopeMatches(rule, eventType) {
  if (rule.scope === 'both') return true;
  return rule.scope === eventType; // 'comment' or 'dm'
}

// ── Graph API helpers ─────────────────────────────────────────────────────────
async function replyToComment(commentId, accessToken, message) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${commentId}/comments`, {
    method: 'POST',
    body: new URLSearchParams({ message, access_token: accessToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Comment reply failed');
  return data;
}

async function sendDM(pageId, recipientId, accessToken, message) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: message },
      access_token: accessToken,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'DM send failed');
  return data;
}

async function likeComment(commentId, accessToken) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${commentId}/likes`, {
    method: 'POST',
    body: new URLSearchParams({ access_token: accessToken }),
  });
  return res.ok;
}

// ── Main processor ────────────────────────────────────────────────────────────
/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {{
 *   platform: 'facebook'|'instagram',
 *   eventType: 'comment'|'dm',
 *   pageId: string,
 *   senderId: string,
 *   senderName: string,
 *   postId: string,
 *   commentId: string,
 *   message: string,
 *   raw: object,
 * }} event
 */
export async function processBotEvent(admin, event) {
  const { platform, eventType, pageId, senderId, senderName, postId, commentId, message, raw } = event;

  try {
    // 1. Find the account (which user owns this page)
    const { data: account } = await admin
      .from('social_accounts')
      .select('user_id, access_token, account_id')
      .eq('account_id', pageId)
      .eq('platform', platform)
      .eq('is_active', true)
      .maybeSingle();

    if (!account) {
      console.warn(`[bot] No account found for page ${pageId} (${platform})`);
      return;
    }

    const { user_id: userId, access_token: accessToken } = account;

    // 2. Load active rules for this account
    const { data: rules } = await admin
      .from('social_bot_rules')
      .select('*')
      .eq('user_id', userId)
      .eq('account_id', pageId)
      .eq('platform', platform)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (!rules?.length) return;

    // 3. Find first matching rule
    const rule = rules.find(r => scopeMatches(r, eventType) && matchesRule(r, message));
    if (!rule) {
      // Log as unmatched
      await logConversation(admin, {
        userId, platform, accountId: pageId, eventType,
        senderId, senderName, postId, commentId, message,
        rule: null, actionTaken: 'none', replySent: null, raw,
      });
      return;
    }

    // 4. Fire actions
    const actions = [];

    if (eventType === 'comment' && rule.reply_comment) {
      try {
        await replyToComment(commentId, accessToken, rule.reply_comment);
        actions.push('replied_comment');
      } catch (e) {
        console.error('[bot] reply comment error:', e.message);
      }
    }

    if (rule.reply_dm && senderId) {
      try {
        await sendDM(pageId, senderId, accessToken, rule.reply_dm);
        actions.push('sent_dm');
      } catch (e) {
        console.error('[bot] send DM error:', e.message);
      }
    }

    if (eventType === 'comment' && rule.like_comment && commentId) {
      try {
        await likeComment(commentId, accessToken);
        actions.push('liked');
      } catch (e) {
        console.error('[bot] like error:', e.message);
      }
    }

    const actionTaken = actions.join(',') || 'none';
    const replySent   = [rule.reply_comment, rule.reply_dm].filter(Boolean).join(' | ') || null;

    // 5. Log
    await logConversation(admin, {
      userId, platform, accountId: pageId, eventType,
      senderId, senderName, postId, commentId, message,
      rule, actionTaken, replySent, raw,
    });

  } catch (err) {
    console.error('[bot] processBotEvent error:', err.message);
  }
}

async function logConversation(admin, {
  userId, platform, accountId, eventType,
  senderId, senderName, postId, commentId, message,
  rule, actionTaken, replySent, raw,
}) {
  await admin.from('social_bot_conversations').insert({
    user_id:     userId,
    platform,
    account_id:  accountId,
    event_type:  eventType,
    sender_id:   senderId   || null,
    sender_name: senderName || null,
    post_id:     postId     || null,
    comment_id:  commentId  || null,
    message_in:  message,
    rule_id:     rule?.id   || null,
    rule_name:   rule?.name || null,
    action_taken: actionTaken,
    reply_sent:  replySent,
    raw_payload: raw,
  });
}
