const MARKET_SELECTIONS = {
  ASX: ["ASX"],
  US: ["US"],
  BOTH: ["ASX", "US"],
};

function zonedParts(date = new Date(), timeZone = "Australia/Sydney") {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  return {
    weekday: get("weekday"),
    minutes: Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null,
  };
}

function isWeekday(weekday) {
  return !["Sat", "Sun"].includes(String(weekday));
}

function labelTime(date = new Date(), timeZone = "Australia/Sydney") {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function marketSessionSnapshot(date = new Date()) {
  const asx = zonedParts(date, "Australia/Sydney");
  const us = zonedParts(date, "America/New_York");
  const asxOpen = isWeekday(asx.weekday) && asx.minutes >= 10 * 60 && asx.minutes < 16 * 60;
  let usStatus = "CLOSED";
  if (isWeekday(us.weekday) && us.minutes !== null) {
    if (us.minutes >= 4 * 60 && us.minutes < 9 * 60 + 30) usStatus = "PRE-MARKET";
    else if (us.minutes >= 9 * 60 + 30 && us.minutes < 16 * 60) usStatus = "OPEN";
    else if (us.minutes >= 16 * 60 && us.minutes < 20 * 60) usStatus = "AFTER-HOURS";
  }
  return {
    generatedAt: date.toISOString(),
    userTime: labelTime(date, "Australia/Brisbane"),
    ASX: {
      market: "ASX",
      label: "Australian Market",
      status: asxOpen ? "OPEN" : "CLOSED",
      isOpen: asxOpen,
      localTime: labelTime(date, "Australia/Sydney"),
      timeZone: "Australia/Sydney",
      priceSession: asxOpen ? "Regular-session price" : "Last regular-session price",
    },
    US: {
      market: "US",
      label: "US Markets",
      status: usStatus,
      isOpen: usStatus === "OPEN",
      localTime: labelTime(date, "America/New_York"),
      timeZone: "America/New_York",
      priceSession: usStatus === "OPEN" ? "Regular-session price" : "Last regular-session price",
    },
  };
}

export function normalizeMarketSelection(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "AU" || normalized === "AUSTRALIA" || normalized === "AUSTRALIAN" || normalized === "ASX") return "ASX";
  if (normalized === "BOTH" || normalized === "ALL") return "BOTH";
  if (normalized === "US" || normalized === "USA" || normalized === "UNITED STATES") return "US";
  return null;
}

export function marketsForSelection(value) {
  const selection = normalizeMarketSelection(value) || "US";
  return MARKET_SELECTIONS[selection];
}

export function defaultMarketSelection(date = new Date()) {
  const sessions = marketSessionSnapshot(date);
  if (sessions.ASX.isOpen) return "ASX";
  if (sessions.US.isOpen) return "US";
  return "ASX";
}
