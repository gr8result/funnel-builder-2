import { getOpenSrsConfig, getDomainPrice, lookupDomainAvailability } from "../../../lib/opensrs/client";

function normalizeDomain(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

function isValidDomain(domain) {
  return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(domain);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const queryDomain = normalizeDomain(req.query?.domain || "");
  if (!queryDomain || !isValidDomain(queryDomain)) {
    return res.status(400).json({ ok: false, error: "Enter a valid domain, for example mybrand.com" });
  }

  const config = getOpenSrsConfig();
  if (!config.configured) {
    return res.status(503).json({
      ok: false,
      error: "OpenSRS is not configured yet. Add OPENSRS_RESELLER_USERNAME and OPENSRS_API_KEY to your environment.",
      setup: {
        environment: config.environment,
        endpoint: config.endpoint,
      },
    });
  }

  try {
    const [lookup, price] = await Promise.all([
      lookupDomainAvailability(queryDomain, { noCache: true }),
      getDomainPrice(queryDomain, { period: 1, regType: "new" }),
    ]);

    const status = String(lookup?.attributes?.status || "").toLowerCase();
    const available = status === "available" || lookup?.responseCode === 210;
    const taken = status === "taken" || lookup?.responseCode === 211;
    const priceValue = price?.attributes?.price ? Number.parseFloat(price.attributes.price) : null;

    return res.status(200).json({
      ok: true,
      domain: queryDomain,
      available,
      taken,
      price: Number.isFinite(priceValue) ? priceValue : null,
      currency: "USD",
      premium: lookup?.attributes?.reason === "Premium Name" || price?.attributes?.isRegistryPremium === "1",
      premiumGroup: price?.attributes?.registryPremiumGroup || "",
      lookup: {
        responseCode: lookup?.responseCode || 0,
        responseText: lookup?.responseText || "",
        status: lookup?.attributes?.status || "",
      },
      setup: {
        environment: config.environment,
        endpoint: config.endpoint,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Could not search that domain in OpenSRS",
      setup: {
        environment: config.environment,
        endpoint: config.endpoint,
      },
    });
  }
}