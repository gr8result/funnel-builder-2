// /scripts/delete-public-ids.mjs
import 'dotenv/config';              // ✅ load from .env.local automatically
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase environment variables. Check .env.local");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUCKETS = ["public-assets", "vendor-assets"];
const FOLDERS = ["id-front/", "id-back/", "proof/", "vendor-signed-agreement/"];

(async () => {
  for (const bucket of BUCKETS) {
    for (const path of FOLDERS) {
      console.log(`🧹 Deleting ${path} from ${bucket}...`);
      const { error } = await supabase.storage.from(bucket).remove([path]);
      if (error) console.error(`❌ ${bucket}/${path}`, error.message);
      else console.log(`✅ Removed ${bucket}/${path}`);
    }
  }
  console.log("🎉 Cleanup complete");
})();
