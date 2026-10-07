// pages/api/media/list.js
import { withAuth } from "../../../lib/withWorkspace";

async function handler(req, res) {
  res.status(200).json({ ok: true, assets: [] });
}

export default withAuth(handler);
