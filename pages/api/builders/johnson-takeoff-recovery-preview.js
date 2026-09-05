export default async function handler(req, res) {
  res.setHeader("Allow", "GET");
  return res.status(410).json({
    ok: false,
    message: "Johnson recovery preview is archived and disabled. Start a clean takeoff from SAMPLE PLANS.pdf."
  });
}
