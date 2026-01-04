// pages/api/stripe-session.js
// POST { module_ids: string[] } -> { id, url }

import Stripe from 'stripe';
import { MODULES, DISCOUNT_TIERS } from '../../lib/modules-catalog';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

    const ids = Array.isArray(req.body?.module_ids) ? req.body.module_ids : [];
    const set = new Set(ids);
    const items = MODULES.filter(m => set.has(m.id));
    if (items.length === 0) return res.status(400).json({ error: 'No modules selected' });

    const subtotal = items.reduce((c, m) => c + (m.price_cents || 0), 0);
    const tier = pickTier(items.length);
    const discount = Math.round(subtotal * (tier.percent_off / 100));
    const total = Math.max(subtotal - discount, 0);

    const origin = req.headers.origin || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      currency: 'AUD',
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancel`,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'AUD',
          unit_amount: total, // cents
          product_data: {
            name: `GR8 Plan – ${items.length} module${items.length>1?'s':''} (${tier.percent_off}% discount)`,
            description: items.map(i => i.name).join(', ')
          }
        }
      }]
    });

    return res.status(200).json({ id: session.id, url: session.url });
  } catch (e) {
    console.error('stripe-session error:', e);
    return res.status(500).send(e.message || 'error');
  }
}

function pickTier(n) {
  for (const t of DISCOUNT_TIERS) if (n >= t.min_count) return t;
  return DISCOUNT_TIERS[DISCOUNT_TIERS.length - 1];
}
