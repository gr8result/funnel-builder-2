export function formatMoney(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "$0";
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${Math.round(n)}`;
  }
}

export function parseList(value) {
  return String(value || "")
    .split(/,|\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildDefaultTeams() {
  return [
    {
      id: "team_default",
      name: "Sales Team",
      manager: "Owner",
      members: "Closer, Setter",
      target: 25000,
      color: "#22c55e",
    },
  ];
}
