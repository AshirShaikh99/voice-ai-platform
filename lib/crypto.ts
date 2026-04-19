import "server-only";

import crypto from "node:crypto";

/**
 * AES-256-GCM symmetric encryption for secrets stored at rest (e.g. Twilio
 * auth tokens). The encryption key comes from APP_ENCRYPTION_KEY — a 32-byte
 * value encoded as base64 or hex. Generate one with:
 *
 *     node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * Ciphertext format: `v1:<iv_b64>:<tag_b64>:<ciphertext_b64>`
 *
 * If you ever need to rotate the key, add a v2 prefix and decrypt both during
 * a transition window — don't silently re-encrypt.
 */

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function loadKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "APP_ENCRYPTION_KEY is not set. Generate with `node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"` and add to .env.local.",
    );
  }
  // Accept base64 or hex.
  const buf =
    raw.length === 64
      ? Buffer.from(raw, "hex")
      : Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `APP_ENCRYPTION_KEY must decode to 32 bytes; got ${buf.length}.`,
    );
  }
  return buf;
}

export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptSecret(ciphertext: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Malformed ciphertext.");
  }
  const key = loadKey();
  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  const ct = Buffer.from(parts[3], "base64");
  if (tag.length !== TAG_BYTES) throw new Error("Invalid auth tag length.");
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

/** Mask a secret for display: "abcd...wxyz" → "abcd…wxyz" (first 4, last 4). */
export function maskSecret(value: string, visible = 4): string {
  if (value.length <= visible * 2) return "•".repeat(value.length);
  return `${value.slice(0, visible)}…${value.slice(-visible)}`;
}
