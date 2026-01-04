// Returns last 12 weeks of visitor counts (stub until wired to DB)
export default function handler(req, res) {
  const weeks = 12;
  const points = Array.from({ length: weeks }, (_, i) => ({
    week: i + 1,
    count: 0, // change later when real data is connected
  }));
  res.status(200).json({ points });
}

