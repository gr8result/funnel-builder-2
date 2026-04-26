// /pages/api/webhooks/facebook.js
// Meta sends ALL comment + DM events here.
// GET  = webhook verification (Meta calls this once when you register)
// POST = live events (comments, messages, etc.)
//
// Set in Meta App Dashboard → Webhooks → Page subscription:
//   Callback URL: https://yourdomain.com/api/webhooks/facebook
//   Verify Token: value of process.env.META_WEBHOOK_VERIFY_TOKEN
//   Subscriptions: messages, feed, mention

import { createSupabaseAdmin } from '../../../lib/social/auth';
import { processBotEvent } from '../../../lib/social/botProcessor';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return handleVerification(req, res);
  }
  if (req.method === 'POST') {
    return handleEvent(req, res);
  }
  return res.status(405).end();
}

// ── Verification ─────────────────────────────────────────────────────────────
function handleVerification(req, res) {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    console.log('[bot] Webhook verified by Meta');
    return res.status(200).send(challenge);
  }
  return res.status(403).send('Forbidden');
}

// ── Event receiver ────────────────────────────────────────────────────────────
async function handleEvent(req, res) {
  // Respond immediately — Meta expects < 5s or it retries
  res.status(200).json({ ok: true });

  const body = req.body;
  if (!body || body.object !== 'page') return;

  const admin = createSupabaseAdmin();

  for (const entry of body.entry || []) {
    const pageId = String(entry.id);

    // ── Comments (feed changes) ──────────────────────────────────────
    for (const change of entry.changes || []) {
      if (change.field !== 'feed') continue;
      const v = change.value;

      // New comment on a post
      if (v.item === 'comment' && v.verb === 'add' && !v.parent_id) {
        await processBotEvent(admin, {
          platform:   'facebook',
          eventType:  'comment',
          pageId,
          senderId:   String(v.from?.id   || ''),
          senderName: String(v.from?.name || ''),
          postId:     String(v.post_id    || ''),
          commentId:  String(v.comment_id || ''),
          message:    String(v.message    || ''),
          raw:        body,
        });
      }
    }

    // ── DMs (messaging) ──────────────────────────────────────────────
    for (const event of entry.messaging || []) {
      if (!event.message || event.message.is_echo) continue;

      await processBotEvent(admin, {
        platform:   'facebook',
        eventType:  'dm',
        pageId,
        senderId:   String(event.sender?.id   || ''),
        senderName: '',
        postId:     '',
        commentId:  '',
        message:    String(event.message?.text || ''),
        raw:        body,
      });
    }

    // ── Instagram (same app, different entry structure) ───────────────
    for (const igEntry of entry.changes || []) {
      if (igEntry.field !== 'comments') continue;
      const v = igEntry.value;

      await processBotEvent(admin, {
        platform:   'instagram',
        eventType:  'comment',
        pageId,
        senderId:   String(v.from?.id   || ''),
        senderName: String(v.from?.username || ''),
        postId:     String(v.media?.id  || ''),
        commentId:  String(v.id         || ''),
        message:    String(v.text       || ''),
        raw:        body,
      });
    }
  }
}
