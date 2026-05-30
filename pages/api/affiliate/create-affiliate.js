import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withWorkspace";

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const data = req.body;
  // Generate unique affiliate ID
  const affiliateId = "GR8A-" + Math.floor(Math.random() * 100000000);
  const { error, insert } = await supabaseAdmin.from("affiliate_applications").insert([
    { ...data, affiliate_id: affiliateId }
  ]);
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  return res.status(200).json({ affiliate_id: affiliateId });
}

export default withAuth(handler);


