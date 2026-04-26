import crypto from "crypto";

const TOKEN_TTL_MS = 30 * 60 * 1000;

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64").toString("utf8");
}

function getResetSecret() {
  return process.env.MARKETPLACE_RESET_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export function createMarketplaceResetToken(email) {
  const secret = getResetSecret();
  if (!secret) throw new Error("Missing reset secret");

  const payload = {
    email: String(email || "").trim().toLowerCase(),
    exp: Date.now() + TOKEN_TTL_MS,
    nonce: crypto.randomBytes(12).toString("hex"),
  };

  const payloadJson = JSON.stringify(payload);
  const payloadPart = base64UrlEncode(payloadJson);
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payloadPart)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `${payloadPart}.${signature}`;
}

export function verifyMarketplaceResetToken(token) {
  const secret = getResetSecret();
  if (!secret) throw new Error("Missing reset secret");

  if (!token || typeof token !== "string" || !token.includes(".")) {
    throw new Error("Invalid reset token");
  }

  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) {
    throw new Error("Invalid reset token");
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payloadPart)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(signaturePart);
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new Error("Invalid reset token");
  }

  const payload = JSON.parse(base64UrlDecode(payloadPart));
  if (!payload?.email || !payload?.exp || payload.exp < Date.now()) {
    throw new Error("Reset token expired");
  }

  return { email: String(payload.email).toLowerCase() };
}
