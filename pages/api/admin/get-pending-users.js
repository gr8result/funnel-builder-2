// /pages/api/admin/get-pending-users.js
// Admin API â€” Fetch all pending user approvals (bypass RLS using service role key)

import { createClient } from "@supabase/supabase-js";
import { withAdmin } from "../../../lib/withAdmin";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function handler(req, res) {
  try {
    const { data, error } = await supabase
      .from("accounts")
      .select("id, name, email, company, created_at, approved, is_approved")
      .or("approved.eq.false,is_approved.eq.false,approved.is.null,is_approved.is.null")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.status(200).json({ users: data || [] });
  } catch (err) {
    console.error("Get pending users error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

export default withAdmin(handler);

