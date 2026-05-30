import sendEmail from '../../lib/sendEmail';
import withAdmin from "../../lib/withAdmin";

async function handler(req, res) {
  const to = req.query.to || process.env.ADMIN_NOTIFICATION_EMAIL || 'support@gr8result.com';
  const from = process.env.SENDGRID_FROM_EMAIL || process.env.DEFAULT_FROM_EMAIL || 'no-reply@gr8result.com';
  const subject = 'Test SendGrid Email';
  const html = '<p>This is a test email from the SendGrid test endpoint.</p>';
  const text = 'This is a test email from the SendGrid test endpoint.';

  try {
    const result = await sendEmail({ to, from, subject, html, text });
    if (result.ok) {
      console.log('Test email sent successfully');
      res.status(200).json({ ok: true });
    } else {
      console.error('SendGrid error:', result.error);
      res.status(500).json({ error: result.error || 'Failed to send email' });
    }
  } catch (err) {
    console.error('Unexpected error sending test email:', err);
    res.status(500).json({ error: err?.message || String(err) });
  }
}

export default withAdmin(handler);
