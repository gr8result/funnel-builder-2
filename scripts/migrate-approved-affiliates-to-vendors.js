// /scripts/migrate-approved-affiliates-to-vendors.js
// One-time migration: inserts any approved affiliate_applications records
// into the vendors table that aren't already there (matched by email).
// Run with: node scripts/migrate-approved-affiliates-to-vendors.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrate() {
  console.log('Fetching approved affiliate applications...');

  const { data: apps, error } = await supabase
    .from('affiliate_applications')
    .select('*')
    .or('status.eq.approved,approved.eq.true');

  if (error) {
    console.error('Failed to fetch applications:', error.message);
    process.exit(1);
  }

  console.log(`Found ${apps.length} approved application(s).`);

  let inserted = 0;
  let skipped = 0;

  for (const app of apps) {
    if (!app.email) {
      console.log(`  SKIP (no email): ${app.name || app.id}`);
      skipped++;
      continue;
    }

    // Check if already in vendors table
    const { data: existing } = await supabase
      .from('vendors')
      .select('id')
      .eq('email', app.email)
      .maybeSingle();

    if (existing) {
      console.log(`  SKIP (already vendor): ${app.email}`);
      skipped++;
      continue;
    }

    const userId = app.affiliate_user_id || null;

    if (!userId) {
      console.log(`  SKIP (missing affiliate_user_id): ${app.email}`);
      skipped++;
      continue;
    }

    const { error: insertErr } = await supabase.from('vendors').insert({
      user_id: userId,
      business_name: app.business_name || app.name || '',
      email: app.email,
      created_at: app.created_at || new Date().toISOString(),
    });

    if (insertErr) {
      console.error(`  ERROR inserting ${app.email}:`, insertErr.message);
    } else {
      console.log(`  INSERTED: ${app.email} (${app.business_name || app.name || '—'})`);
      inserted++;
    }
  }

  console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}`);
}

migrate();
