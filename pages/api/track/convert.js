import { readDB, writeDB, nid } from "../../../utils/affdb";

/**
 * POST body: { aid, programId, amount, meta? }
 * In real life this would be called by your checkout (server-side) after purchase.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { aid, programId, amount, meta = {} } = req.body || {};
  if (!aid || !programId || !amount) return res.status(400).json({ error: "aid, programId, amount required" });

  const db = await readDB();
  const program = db.programs.find(p => p.id === programId);
  if (!program) return res.status(404).json({ error: "Program not found" });

  const commission = Math.round((Number(amount) * Number(program.commissionRate)) * 100) / 100;

  db.conversions.push({
    id: nid("cvt"),
    aid: String(aid),
    programId,
    amount: Number(amount),
    commission,
    ts: Date.now(),
    meta
  });

  await writeDB(db);
  res.status(200).json({ ok: true, commission });
}


