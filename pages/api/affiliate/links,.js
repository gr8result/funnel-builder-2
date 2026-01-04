import { readDB, getUserId } from "../../../utils/affdb";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const db = await readDB();
  const userId = getUserId(req);
  const links = db.links
    .filter(l => l.userId === userId)
    .map(l => {
      const program = db.programs.find(p => p.id === l.programId);
      return { ...l, programName: program?.name || l.programId };
    })
    .sort((a,b) => b.createdAt - a.createdAt);
  res.status(200).json({ links });
}

