import { readDB } from "../../../utils/affdb";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const db = await readDB();
  const queue = db.applications
    .map(a => {
      const program = db.programs.find(p => p.id === a.programId);
      return { ...a, programName: program?.name || a.programId };
    })
    .sort((a,b) => b.createdAt - a.createdAt);
  res.status(200).json({ approvals: queue });
}


