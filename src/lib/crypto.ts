/**
 * AES-256-GCM encryption for sensitive data at rest.
 *
 * Used to encrypt API keys before storing in the database, and decrypt
 * them when needed for outbound API calls. The encryption key is read
 * from the ENCRYPTION_KEY environment variable.
 *
 * If ENCRYPTION_KEY is not set, falls back to a development-only key
 * derived from the database path. In production, ALWAYS set a strong
 * ENCRYPTION_KEY (32+ random bytes, base64-encoded).
 *
 * Security notes:
 * - Uses GCM mode (authenticated encryption) — detects tampering.
 * - IV is random per-encryption (12 bytes) and prepended to ciphertext.
 * - Auth tag (16 bytes) is appended after ciphertext.
 * - Format: base64(iv + ciphertext + authTag)
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) {
    // Use the raw bytes of the env key, padded or hashed to 32 bytes
    const key = Buffer.from(envKey, "base64");
    if (key.length === 32) return key;
    // If not exactly 32 bytes, hash it to get a consistent 32-byte key
    return createHash("sha256").update(envKey).digest();
  }
  // Development fallback — derive from DATABASE_URL path (not secure!)
  const dbPath = process.env.DATABASE_URL || "dev-fallback";
  return createHash("sha256").update(dbPath).digest();
}

/**
 * Encrypt a plaintext string.
 * Returns base64(iv + ciphertext + authTag).
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, authTag]).toString("base64");
}

/**
 * Decrypt an encrypted string.
 * Returns the original plaintext, or null if decryption fails.
 */
export function decrypt(encryptedB64: string): string | null {
  try {
    const key = getEncryptionKey();
    const data = Buffer.from(encryptedB64, "base64");
    if (data.length < IV_LENGTH + TAG_LENGTH + 1) return null;

    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(data.length - TAG_LENGTH);
    const ciphertext = data.subarray(IV_LENGTH, data.length - TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Check if a string looks like it's encrypted (base64 with enough length).
 * Used to detect legacy plaintext values that need migration.
 */
export function isEncrypted(value: string): boolean {
  if (!value || value.length < IV_LENGTH + TAG_LENGTH + 1) return false;
  try {
    Buffer.from(value, "base64");
    return true;
  } catch {
    return false;
  }
}
