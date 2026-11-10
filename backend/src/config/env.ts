/** bcrypt cost factor (spec section 5 requires >= 12). */
export const BCRYPT_ROUNDS = 12;

const DEV_FALLBACK_SECRET = 'contextforge_fallback_dev_secret_key_2026';

/**
 * Returns the JWT signing secret. In production a missing or weak secret is a
 * startup error, so a misconfigured deploy never signs tokens with a public string.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!secret) throw new Error('JWT_SECRET must be set in production.');
    if (secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters in production.');
  }
  return secret || DEV_FALLBACK_SECRET;
}
