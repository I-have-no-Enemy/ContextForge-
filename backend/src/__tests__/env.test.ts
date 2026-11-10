import { describe, it, expect, afterEach } from 'vitest';
import { getJwtSecret, BCRYPT_ROUNDS } from '../config/env.js';

const original = { ...process.env };

describe('Runtime secrets (OWASP A02)', () => {
  afterEach(() => {
    process.env = { ...original };
  });

  it('AC10: refuses to run in production without JWT_SECRET', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET/);
  });

  it('refuses a short JWT_SECRET in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'short';
    expect(() => getJwtSecret()).toThrow(/32/);
  });

  it('uses JWT_SECRET when provided', () => {
    process.env.JWT_SECRET = 'x'.repeat(40);
    expect(getJwtSecret()).toBe('x'.repeat(40));
  });

  it('hashes passwords with bcrypt cost >= 12 (spec section 5)', () => {
    expect(BCRYPT_ROUNDS).toBeGreaterThanOrEqual(12);
  });
});
