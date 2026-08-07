const MARKET_HOURS = {
  US: {
    timezone: "America/New_York",
    open: { hour: 9, minute: 30 },
    close: { hour: 16, minute: 0 },
    label: "US regular session",
  },
  ASX: {
    timezone: "Australia/Sydney",
    open: { hour: 10, minute: 0 },
    close: { hour: 16, minute: 0 },
    label: "ASX regular session",
  },
};

function partsForTimeZone(now, timezone) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function minutesSinceMidnight(parts) {
  return Number(parts.hour) * 60 + Number(parts.minute);
}

export function getMarketSessionState(market = "US", now = new Date()) {
  const key = String(market || "US").toUpperCase();
  const config = MARKET_HOURS[key] || MARKET_HOURS.US;
  const parts = partsForTimeZone(now, config.timezone);
  const weekday = String(parts.weekday || "").slice(0, 3);
  const weekend = weekday === "Sat" || weekday === "Sun";
  const currentMinutes = minutesSinceMidnight(parts);
  const openMinutes = config.open.hour * 60 + config.open.minute;
  const closeMinutes = config.close.hour * 60 + config.close.minute;
  const isOpen = !weekend && currentMinutes >= openMinutes && currentMinutes < closeMinutes;

  return {
    market: key,
    label: config.label,
    timezone: config.timezone,
    isOpen,
    state: isOpen ? "open" : "closed",
    checkedAt: now.toISOString(),
  };
}

export function getMarketSessionStates(markets = ["US"], now = new Date()) {
  const unique = Array.from(new Set(markets.map((market) => String(market || "").toUpperCase()).filter(Boolean)));
  return unique.map((market) => getMarketSessionState(market, now));
}
