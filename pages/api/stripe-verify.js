// pages/api/stripe-verify.js
// GET ?session_id=... -> verifies payment status with Stripe

import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');
  try {
    const sid = req.query.session_id;
    if (!sid) return res.status(400).send('missing session_id');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
    const session = await stripe.checkout.sessions.retrieve(sid, { expand: ['payment_intent'] });
    if (session.payment_status !== 'paid') return res.status(400).send('not paid');
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).send(e.message || 'error');
  }
}
