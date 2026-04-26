// pages/api/affiliate/list-applications.js
import { getAffiliateApplications } from '../../../lib/affiliateApplications';

export default async function handler(req, res) {
  try {
    const data = await getAffiliateApplications();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
