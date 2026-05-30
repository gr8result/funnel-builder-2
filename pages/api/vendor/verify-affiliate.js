// /pages/api/vendor/verify-affiliate.js
// Called when an approved affiliate applicant clicks the verification link in their email.
// Marks the application as verified and inserts them into the vendors table.

import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { withAuth } from "../../../lib/withWorkspace";

async function handler(req, res) {
  const { token } = req.query;

  if (!token) {
    res.status(400).send('Missing verification token.');
    return;
  }

  // Find the affiliate application by token
  const { data: app, error } = await supabaseAdmin
    .from('affiliate_applications')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (error || !app) {
    res.status(404).send('Verification link is invalid or has already been used.');
    return;
  }

  // Mark as verified and clear the token
  await supabaseAdmin
    .from('affiliate_applications')
    .update({ verified: true, verified_at: new Date().toISOString(), token: null })
    .eq('id', app.id);

  // Check if already in vendors table (by email to avoid duplicates)
  const { data: existingVendor } = await supabaseAdmin
    .from('vendors')
    .select('id')
    .eq('email', app.email)
    .maybeSingle();

  if (!existingVendor) {
    if (app.affiliate_user_id) {
      const { error: insertErr } = await supabaseAdmin.from('vendors').insert({
        user_id: app.affiliate_user_id,
        business_name: app.business_name || app.name || '',
        email: app.email || '',
        created_at: new Date().toISOString(),
      });

      if (insertErr) {
        console.error('Failed to insert vendor from affiliate verification:', insertErr.message);
      }
    }
  }

  // Redirect to marketplace
  res.writeHead(302, { Location: '/marketplace' });
  res.end();
}

export default withAuth(handler);
