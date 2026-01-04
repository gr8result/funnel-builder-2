// lib/entitlements.js
// Helpers to read/write module entitlements for the current user.
import supabase from '../utils/supabase-client';

export async function getEntitlements() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return new Set();
  const { data } = await supabase.from('user_modules').select('module_id').eq('user_id', session.user.id);
  return new Set((data || []).map(r => r.module_id));
}

export async function setEntitlements(moduleIds = []) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');
  const user_id = session.user.id;

  // Upsert by replacing current set (simple and safe)
  await supabase.from('user_modules').delete().eq('user_id', user_id);
  const rows = moduleIds.map(id => ({ user_id, module_id: id }));
  if (rows.length) await supabase.from('user_modules').insert(rows);

  // Update subscriptions snapshot (optional; handy for showing totals)
  const total_cents = (await supabase
    .from('modules')
    .select('id, price_cents')
    .in('id', moduleIds))
    .data?.reduce((c, x) => c + (x.price_cents || 0), 0) || 0;

  await supabase.from('subscriptions').upsert({
    user_id, status: 'active', modules_count: moduleIds.length, current_total_cents: total_cents, currency: 'AUD'
  });

  if (typeof window !== 'undefined') window.dispatchEvent(new Event('profile-updated'));
}
