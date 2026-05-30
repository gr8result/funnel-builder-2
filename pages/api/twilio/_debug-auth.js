import withAdmin from "../../../lib/withAdmin";
async function handler(req, res) {
  res.status(410).json({ error: "Debug route disabled" });
}

export default withAdmin(handler);
