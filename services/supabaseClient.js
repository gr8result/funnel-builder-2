// services/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// READ from .env.local (must be set)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // Helpful error if env vars are missing
  // (won't crash build, but you'll see it in the server logs)
  console.warn(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
  );
}

export const supabase = createClient(url, anon);
