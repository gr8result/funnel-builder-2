import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Check if table exists and get counts
    const { data: queueData, error: queueError } = await supabase
      .from('automation_email_queue')
      .select('id, status, created_at, to_email, subject, flow_id, node_id')
      .order('created_at', { ascending: false })
      .limit(20);

    if (queueError) {
      return res.status(500).json({
        ok: false,
        error: 'Queue table error',
        details: queueError.message
      });
    }

    // Get counts by status
    const { data: statusCounts } = await supabase
      .from('automation_email_queue')
      .select('status');

    const counts = {
      pending: 0,
      sent: 0,
      failed: 0,
      bounced: 0,
      total: statusCounts?.length || 0
    };

    statusCounts?.forEach(row => {
      if (counts[row.status] !== undefined) {
        counts[row.status]++;
      }
    });

    // Check email_sends table
    const { data: sentEmails, error: sentError } = await supabase
      .from('email_sends')
      .select('id, created_at, to_email, subject, automation_id')
      .not('automation_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    // Check SendGrid config
    const hasSendGridKey = !!process.env.SENDGRID_API_KEY;
    const hasSendGridFrom = !!process.env.SENDGRID_FROM_EMAIL;

    return res.status(200).json({
      ok: true,
      queue: {
        exists: true,
        counts,
        recent: queueData || []
      },
      sent_tracking: {
        recent: sentEmails || [],
        count: sentEmails?.length || 0,
        error: sentError?.message
      },
      config: {
        sendgrid_configured: hasSendGridKey && hasSendGridFrom,
        has_api_key: hasSendGridKey,
        has_from_email: hasSendGridFrom
      },
      diagnosis: counts.pending > 0 
        ? '⚠️ Emails queued but not sent - run flush-queue endpoint'
        : counts.total === 0 
        ? 'ℹ️ Queue is empty - run tick to queue emails'
        : '✅ All queued emails sent'
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
}
