import { readDB, writeDB, nid, getUserId } from "../../../utils/affdb";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { programId, note = "" } = req.body || {};
  if (!programId) return res.status(400).json({ error: "programId required" });

  const db = await readDB();
  const program = db.programs.find(p => p.id === programId && p.status === "active");
  if (!program) return res.status(404).json({ error: "Program not found" });

  const userId = getUserId(req);

  const existing = db.applications.find(a => a.userId === userId && a.programId === programId);
  if (existing) {
    return res.status(200).json({ ok: true, application: existing, message: "Existing application found" });
  }

  const application = {
    id: nid("app"),
    userId,
    programId,
    status: "pending",
    note,
    createdAt: Date.now()
  };
  db.applications.push(application);
  db.approvals.push({ ...application }); // audit trail
  await writeDB(db);

  res.status(200).json({ ok: true, application });
}

