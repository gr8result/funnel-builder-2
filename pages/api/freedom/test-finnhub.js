export default async function handler(req, res) {
  const apiKey = process.env.FINNHUB_API_KEY?.trim();
  const payload = {
    configured: Boolean(apiKey),
    envVarName: "FINNHUB_API_KEY",
    finnhubStatus: null,
    authenticated: false,
  };

  try {
    if (!apiKey) return res.status(200).json(payload);
    const url = new URL("https://finnhub.io/api/v1/quote");
    url.searchParams.set("symbol", "MSFT");
    url.searchParams.set("token", apiKey);
    const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Freedom Finnhub Diagnostic" } });
    const data = await response.json().catch(() => null);

    return res.status(200).json({
      ...payload,
      finnhubStatus: response.status,
      authenticated: response.ok && Number.isFinite(Number(data?.c)),
      error: response.ok ? null : data?.error || "Finnhub authentication failed.",
    });
  } catch (error) {
    return res.status(200).json({
      ...payload,
      finnhubStatus: "request_failed",
      error: error.message || "Unable to reach Finnhub.",
    });
  }
}
