// pages/api/affiliate/approved.js
import adapter from "../../../lib/affiliate/adapter";

export default async function handler(req, res) {
  try {
    const data = await adapter.listApproved();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: "Failed to load approved offers" });
  }
}


