require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key, { auth: { persistSession: false } });
(async () => {
  const { data, error } = await supabase.from("funnels").select("id,name,slug,status").eq("id", "5abbf73a-32f2-46dc-a3b7-0f3b56fa53c0").maybeSingle();
  if (error) throw error;
  console.log(JSON.stringify(data, null, 2));
})();
