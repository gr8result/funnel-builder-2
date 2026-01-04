import { readDB, writeDB, nid } from "../../../utils/affdb";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { applicationId, action } = req.body || {};
  if (!applicationId || !["approve", "decline"].includes(action)) {
    return res.status(400).json({ error: "applicationId & action=approve|decline required" });
  }

  const db = await readDB();
  const app = db.applications.find(a => a.id === applicationId);
  if (!app) return res.status(404).json({ error: "Application not found" });

  app.status = action === "approve" ? "approved" : "declined";

  // if approved, generate link
  if (app.status === "approved") {
    const link = {
      id: nid("lnk"),
      userId: app.userId,
      programId: app.programId,
      link: `/r?aid=${encodeURIComponent(app.userId)}&offer=${encodeURIComponent(app.programId)}`,
      createdAt: Date.now()
    };
    db.links.push(link);
  }

  // audit
  db.approvals.push({ ...app, id: nid("audit") });

  await writeDB(db);
  res.status(200).json({ ok: true, application: app });
}

