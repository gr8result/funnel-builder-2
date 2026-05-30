// pages/api/affiliate/list-applications.js
import { getAffiliateApplications } from '../../../lib/affiliateApplications';
import withAdmin from "../../../lib/withAdmin";

async function handler(req, res) {
  try {
    const data = await getAffiliateApplications();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export default withAdmin(handler);
