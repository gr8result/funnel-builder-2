import { readDB } from "../../../utils/affdb";
import withAdmin from "../../../lib/withAdmin";

async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const db = await readDB();
  res.status(200).json({
    conversions: db.conversions.sort((a,b)=>b.ts-a.ts),
    payouts: db.payouts
  });
}

export default withAdmin(handler);
