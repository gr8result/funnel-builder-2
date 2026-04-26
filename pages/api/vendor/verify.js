// /pages/api/vendor/verify.js
// Handles vendor email verification and redirects to /modules/vendor
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { ensureVendorProfileFromAgreement } from '../../../lib/vendorProfile';

export default async function handler(req, res) {
  const { token } = req.query;
  if (!token) {
    res.status(400).send('Missing verification token.');
    return;
  }

  // Find the vendor agreement by token only
  const { data, error } = await supabaseAdmin
    .from('vendor_agreements')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (error || !data) {
    res.status(404).send('Verification record not found.');
    return;
  }

  // Resolve a valid marketplace user_id for this agreement.
  let resolvedUserId = data.user_id || null;

  if (resolvedUserId) {
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', resolvedUserId)
      .maybeSingle();

    if (!existingUser) {
      resolvedUserId = null;
    }
  }

  if (!resolvedUserId && data.email) {
    const { data: userByEmail } = await supabaseAdmin
      .from('users')
      .select('id')
      .ilike('email', data.email)
      .maybeSingle();

    if (userByEmail?.id) {
      resolvedUserId = userByEmail.id;
    }
  }

  // Mark as verified with a minimal payload to avoid schema mismatch failures.
  const { error: verifyUpdateError } = await supabaseAdmin
    .from('vendor_agreements')
    .update({
      user_id: resolvedUserId,
      verified: true,
      verified_at: new Date().toISOString(),
      vendor_agreement_signed: true,
      token: null,
    })
    .eq('id', data.id);

  if (verifyUpdateError) {
    console.error('Failed to mark vendor agreement as verified:', verifyUpdateError.message);
    res.status(500).send('Unable to verify vendor agreement. Please contact support.');
    return;
  }

  // Verification click should create or refresh the vendor record from the agreement.
  try {
    await ensureVendorProfileFromAgreement({
      supabaseAdmin,
      authUserId: resolvedUserId,
      email: data.email || '',
    });
  } catch (vendorError) {
    console.error('Failed to ensure vendor on verification:', vendorError.message);
  }

  // Redirect to /marketplace
  res.writeHead(302, { Location: '/marketplace' });
  res.end();
}
