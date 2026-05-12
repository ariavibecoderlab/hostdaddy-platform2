/**
 * Password hashing for Cloudflare Workers.
 *
 * Uses PBKDF2-SHA256 via Web Crypto. Native, fast (~80ms in Workers),
 * version-prefixed format so we can upgrade algos later without forced re-login.
 *
 * Stored format: `pbkdf2-sha256$<iterations>$<salt-b64>$<hash-b64>`
 *   - iterations: integer (currently 100,000, ratchet up over time)
 *   - salt: 32 random bytes, base64
 *   - hash: 32 bytes derived key, base64
 *
 * To upgrade: bump DEFAULT_ITERATIONS, write new hashes with the new count.
 * Old hashes still verify because their iteration count is embedded.
 *
 * Migration story: when we ever want argon2id, add a new prefix
 *   `argon2id$<m>$<t>$<p>$<salt>$<hash>` and let verify() dispatch on prefix.
 */

const DEFAULT_ITERATIONS = 100_000;
const SALT_BYTES = 32;
const HASH_BYTES = 32;

/** Constant-time string comparison to avoid timing attacks. */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    HASH_BYTES * 8,
  );
  return new Uint8Array(derivedBits);
}

/** Hash a password for storage. Returns the full versioned string. */
export async function hashPassword(
  password: string,
  iterations: number = DEFAULT_ITERATIONS,
): Promise<string> {
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, iterations);
  return `pbkdf2-sha256$${iterations}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`;
}

/** Verify a password against a stored hash. Returns true on match. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') {
    return false;
  }
  const iterations = Number.parseInt(parts[1]!, 10);
  if (!Number.isFinite(iterations) || iterations < 10_000) {
    return false; // refuse to verify against suspiciously-weak hashes
  }
  const salt = base64ToBytes(parts[2]!);
  const expected = parts[3]!;
  const candidate = bytesToBase64(await derive(password, salt, iterations));
  return constantTimeEquals(candidate, expected);
}

/**
 * Returns true if the stored hash uses an older iteration count than current.
 * Call this after a successful verify to optionally re-hash the user's password.
 */
export function needsRehash(stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') return true;
  const iterations = Number.parseInt(parts[1]!, 10);
  return iterations < DEFAULT_ITERATIONS;
}
