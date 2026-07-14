export default async function handler(req, res) {
  const apiKey = process.env.FINNHUB_API_KEY?.trim();
  const requestUrl = `https://finnhub.io/api/v1/quote?symbol=MSFT&token=${apiKey || ""}`;

  const payload = {
    keyExists: Boolean(apiKey),
    keyLength: apiKey?.length || 0,
    keyStartsWith: apiKey?.slice(0, 4) || "",
    keyEndsWith: apiKey?.slice(-4) || "",
    requestUrlPreview: `https://finnhub.io/api/v1/quote?symbol=MSFT&token=${apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : ""}`,
    finnhubStatus: null,
    finnhubResponse: null,
  };

  try {
    const response = await fetch(requestUrl);
    const text = await response.text();
    let finnhubResponse = text;

    try {
      finnhubResponse = JSON.parse(text);
    } catch {
      finnhubResponse = text;
    }

    return res.status(200).json({
      ...payload,
      finnhubStatus: response.status,
      finnhubResponse,
    });
  } catch (error) {
    return res.status(200).json({
      ...payload,
      finnhubStatus: "request_failed",
      finnhubResponse: {
        error: error.message || "Unable to reach Finnhub.",
      },
    });
  }
}
