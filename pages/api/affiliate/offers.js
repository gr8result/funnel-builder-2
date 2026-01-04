// pages/api/affiliate/offers.js
import adapter from "../../../lib/affiliate/adapter";

export default async function handler(req, res) {
  try {
    const { q = "", category = "", network = "" } = req.query || {};
    const data = await adapter.listOffers({ q, category, network });
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: "Failed to load offers" });
  }
}

