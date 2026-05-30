// /pages/api/affiliatePayout.js
import { requestAffiliatePayout } from '../../lib/affiliate/affiliatePayouts';
import withAdmin from "../../lib/withAdmin";

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { affiliateUserId, amount } = req.body;
  const result = await requestAffiliatePayout({ affiliateUserId, amount });
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }
  return res.status(200).json({ ok: true, data: result.data });
}

export default withAdmin(handler);
