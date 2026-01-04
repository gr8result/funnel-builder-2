// pages/api/affiliate/programs.js
import { readDB } from "../../../utils/affdb";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end("Method Not Allowed");
  }
  try {
    const db = await readDB();
    const programs = (db.programs || []).filter(p => p.status === "active");
    return res.status(200).json({ programs });
  } catch (e) {
    console.error("programs API error:", e);
    return res.status(500).json({ error: "Server error" });
  }
}

