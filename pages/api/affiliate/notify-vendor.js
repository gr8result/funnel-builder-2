// pages/api/affiliate/notify-vendor.js
import { sendEmail } from '../../../lib/sendEmail';
import { supabase } from '../../../utils/supabase-client';
import withAdmin from "../../../lib/withAdmin";

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { vendor_user_id, affiliate_name, affiliate_email } = req.body;

  if (!vendor_user_id || !affiliate_name || !affiliate_email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Fetch vendor email from Supabase
  const { data: vendor, error } = await supabase
    .from('accounts')
    .select('email')
    .eq('user_id', vendor_user_id)
    .maybeSingle();

  if (error || !vendor?.email) {
    return res.status(404).json({ error: 'Vendor email not found' });
  }

  const link = 'http://localhost:3000/modules/vendor/affiliates/manage-products';
  const subject = 'New Affiliate Application Received';
  const html = `<p>You have received a new affiliate application from <strong>${affiliate_name}</strong> (${affiliate_email}).<br>
  <a href="${link}">View applications</a></p>`;

  const emailResult = await sendEmail({
    to: vendor.email,
    from: 'no-reply@gr8result.com',
    subject,
    html,
  });

  if (!emailResult.ok) {
    return res.status(500).json({ error: emailResult.error || 'Failed to send email' });
  }

  return res.status(200).json({ ok: true });
}

export default withAdmin(handler);
