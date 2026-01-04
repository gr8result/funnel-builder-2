// /pages/api/affiliates/merchant/commissions.js
import fs from "fs";
import path from "path";

export default function handler(req, res) {
  const DATA_DIR = path.join(process.cwd(), "data", "affiliate");
  const DB_FILE = path.join(DATA_DIR, "db.json");

  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    res.status(200).json({ commissions: data.commissions || [] });
  } catch (err) {
    console.error("Error reading commissions DB:", err);
    res.status(500).json({ error: "Failed to load commissions" });
  }
}
