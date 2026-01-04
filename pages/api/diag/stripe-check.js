// pages/api/diag/stripe-check.js
import Stripe from 'stripe';

export default async function handler(req, res) {
  try {
    const key = process.env.STRIPE_SECRET_KEY || '';
    if (!key) return res.status(500).json({ ok: false, reason: 'missing STRIPE_SECRET_KEY' });

    const mode =
      key.startsWith('sk_live_') ? 'live' :
      key.startsWith('sk_test_') ? 'test' : 'unknown';

    const stripe = new Stripe(key, { apiVersion: '2023-10-16' });
    const acct = await stripe.accounts.retrieve();

    return res.status(200).json({
      ok: true,
      mode,
      account: { id: acct.id, livemode: acct.livemode }
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
