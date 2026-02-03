export default function handler(req, res) {
  res.status(410).json({ error: "Debug route disabled" });
}
