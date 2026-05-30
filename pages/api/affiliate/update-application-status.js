// /pages/api/affiliate/update-application-status.js
//
// FULL REPLACEMENT
//
// ✅ Fixes: gen_random_bytes(integer) does not exist
// ✅ No inserts
// ✅ No UUID generation
// ✅ UPDATE only
// ✅ Always returns JSON

import { createClient } from "@supabase/supabase-js";
import withAdmin from "../../../lib/withAdmin";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { id, status } = req.body;

    if (!id || !status) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing id or status" });
    }

    if (!["approved", "declined"].includes(status)) {
      return res
        .status(400)
        .json({ ok: false, error: "Invalid status" });
    }

    const { error } = await supabase
      .from("affiliate_applications")
      .update({ status })
      .eq("id", id);

    if (error) {
      return res.status(500).json({
        ok: false,
        error: error.message,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
}

export default withAdmin(handler);
