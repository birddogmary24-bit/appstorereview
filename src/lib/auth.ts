import { createHash, randomBytes } from 'crypto';

/**
 * Verify a plaintext password against the stored salt:hash in UPDATE_PASSWORD_HASH.
 *
 * New format: UPDATE_PASSWORD_HASH=<salt_hex>:<sha256_hash_hex>
 *   where hash = sha256(salt_bytes + password_utf8)
 *
 * Legacy format: UPDATE_PASSWORD_HASH=<sha256_hash_hex> (no colon, no salt)
 *
 * If UPDATE_PASSWORD_HASH is not set, returns true (no protection configured).
 */
export function verifyPassword(inputPassword: string): boolean {
  const storedValue = process.env.UPDATE_PASSWORD_HASH;
  if (!storedValue) return true;
  if (!inputPassword) return false;

  if (storedValue.includes(':')) {
    const [saltHex, expectedHash] = storedValue.split(':');
    const salt = Buffer.from(saltHex, 'hex');
    const inputHash = createHash('sha256')
      .update(Buffer.concat([salt, Buffer.from(inputPassword, 'utf-8')]))
      .digest('hex');
    return inputHash === expectedHash;
  } else {
    const inputHash = createHash('sha256').update(inputPassword).digest('hex');
    return inputHash === storedValue;
  }
}

/**
 * Generate a new salt:hash value for storing in .env.
 */
export function generatePasswordHash(password: string): string {
  const salt = randomBytes(16);
  const hash = createHash('sha256')
    .update(Buffer.concat([salt, Buffer.from(password, 'utf-8')]))
    .digest('hex');
  return `${salt.toString('hex')}:${hash}`;
}
