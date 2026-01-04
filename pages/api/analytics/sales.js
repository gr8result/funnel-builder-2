// Returns last 30 days of sales amounts (stub until wired to DB)
export default function handler(req, res) {
  const days = 30;
  const points = Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    amount: 0, // change later when real data is connected
  }));
  res.status(200).json({ points });
}
