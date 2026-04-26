import crypto from "crypto";

const ALGO = "aes-256-gcm";

function getKeyBuffer() {
  const key = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY || "";
  if (!key) {
    throw new Error("Missing SOCIAL_TOKEN_ENCRYPTION_KEY");
  }

  // Accept either 32-byte raw string or base64 encoded key.
  const raw = Buffer.from(key, "utf8");
  if (raw.length === 32) return raw;

  const maybeBase64 = Buffer.from(key, "base64");
  if (maybeBase64.length === 32) return maybeBase64;

  throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY must decode to 32 bytes");
}

export function encryptToken(plainText) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKeyBuffer(), iv);

  const encrypted = Buffer.concat([
    cipher.update(String(plainText), "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return {
    cipherText: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptToken({ cipherText, iv, tag }) {
  const decipher = crypto.createDecipheriv(
    ALGO,
    getKeyBuffer(),
    Buffer.from(iv, "base64")
  );

  decipher.setAuthTag(Buffer.from(tag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherText, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
