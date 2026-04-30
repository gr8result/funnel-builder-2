import { createHash } from "node:crypto";

const TEST_ENDPOINT = "https://horizon.opensrs.net:55443";
const LIVE_ENDPOINT = "https://rr-n1-tor.opensrs.net:55443";

function safeTrim(value) {
  return String(value || "").trim();
}

export function getOpenSrsConfig() {
  const environment = safeTrim(process.env.OPENSRS_ENV || "test").toLowerCase() === "live" ? "live" : "test";
  const username = safeTrim(process.env.OPENSRS_RESELLER_USERNAME);
  const apiKey = safeTrim(process.env.OPENSRS_API_KEY);
  const endpoint = safeTrim(process.env.OPENSRS_API_URL) || (environment === "live" ? LIVE_ENDPOINT : TEST_ENDPOINT);

  return {
    environment,
    username,
    apiKey,
    endpoint,
    configured: !!(username && apiKey),
  };
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function createAttributesXml(attributes = {}) {
  const entries = Object.entries(attributes).filter(([, value]) => value !== undefined && value !== null && value !== "");
  return entries
    .map(([key, value]) => `<item key="${escapeXml(key)}">${escapeXml(value)}</item>`)
    .join("");
}

function buildEnvelope({ action, object, attributes }) {
  return `<?xml version='1.0' encoding='UTF-8' standalone='no' ?>
<!DOCTYPE OPS_envelope SYSTEM 'ops.dtd'>
<OPS_envelope>
  <header>
    <version>0.9</version>
  </header>
  <body>
    <data_block>
      <dt_assoc>
        <item key="protocol">XCP</item>
        <item key="action">${escapeXml(String(action || "").toUpperCase())}</item>
        <item key="object">${escapeXml(String(object || "").toUpperCase())}</item>
        <item key="attributes">
          <dt_assoc>${createAttributesXml(attributes)}</dt_assoc>
        </item>
      </dt_assoc>
    </data_block>
  </body>
</OPS_envelope>`;
}

async function createSignature(xml, apiKey) {
  const firstHex = createHash("md5").update(`${xml}${apiKey}`).digest("hex");
  return createHash("md5").update(`${firstHex}${apiKey}`).digest("hex");
}

function extractTopLevelValue(xml, key) {
  const pattern = new RegExp(`<item key=["']${key}["']>([\\s\\S]*?)<\\/item>`, "i");
  const match = xml.match(pattern);
  return match ? match[1].trim() : "";
}

function extractAttributesXml(xml) {
  const match = xml.match(/<item key=["']attributes["']>\s*<dt_assoc>([\s\S]*?)<\/dt_assoc>\s*<\/item>/i);
  return match ? match[1] : "";
}

function extractAttributeValue(attributesXml, key) {
  const pattern = new RegExp(`<item key=["']${key}["']>([\\s\\S]*?)<\\/item>`, "i");
  const match = attributesXml.match(pattern);
  return match ? match[1].trim() : "";
}

function parseOpenSrsResponse(xml = "") {
  const attributesXml = extractAttributesXml(xml);
  return {
    isSuccess: extractTopLevelValue(xml, "is_success") === "1",
    responseCode: Number.parseInt(extractTopLevelValue(xml, "response_code") || "0", 10) || 0,
    responseText: extractTopLevelValue(xml, "response_text"),
    attributes: {
      status: extractAttributeValue(attributesXml, "status"),
      price: extractAttributeValue(attributesXml, "price"),
      priceStatus: extractAttributeValue(attributesXml, "price_status"),
      reason: extractAttributeValue(attributesXml, "reason"),
      isRegistryPremium: extractAttributeValue(attributesXml, "is_registry_premium"),
      registryPremiumGroup: extractAttributeValue(attributesXml, "registry_premium_group"),
    },
    raw: xml,
  };
}

export async function sendOpenSrsCommand({ action, object = "domain", attributes = {} }) {
  const config = getOpenSrsConfig();
  if (!config.configured) {
    throw new Error("OpenSRS is not configured. Add OPENSRS_RESELLER_USERNAME and OPENSRS_API_KEY.");
  }

  const xml = buildEnvelope({ action, object, attributes });
  const signature = await createSignature(xml, config.apiKey);

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
      "X-Username": config.username,
      "X-Signature": signature,
    },
    body: xml,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`OpenSRS request failed with HTTP ${response.status}`);
  }

  return parseOpenSrsResponse(text);
}

export async function lookupDomainAvailability(domain, { noCache = true } = {}) {
  return sendOpenSrsCommand({
    action: "lookup",
    object: "domain",
    attributes: {
      domain,
      no_cache: noCache ? "1" : "0",
    },
  });
}

export async function getDomainPrice(domain, { period = 1, regType = "new" } = {}) {
  return sendOpenSrsCommand({
    action: "get_price",
    object: "domain",
    attributes: {
      domain,
      period: String(period),
      reg_type: regType,
    },
  });
}