import { describe, it, expect } from 'vitest';
import { rateLimit } from '../rate-limit';

describe('rateLimit', () => {
  it('allows requests within the limit', async () => {
    const key = `test-${Date.now()}-allow`;
    const result = await rateLimit(key, 5, 60_000);

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('blocks requests over the limit', async () => {
    const key = `test-${Date.now()}-block`;

    // Exhaust the limit
    for (let i = 0; i < 3; i++) {
      await rateLimit(key, 3, 60_000);
    }

    const result = await rateLimit(key, 3, 60_000);
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('resets after window expires', async () => {
    const key = `test-${Date.now()}-reset`;

    // Exhaust with a very short window
    for (let i = 0; i < 2; i++) {
      await rateLimit(key, 2, 50); // 50ms window
    }

    // Should be blocked
    expect((await rateLimit(key, 2, 50)).success).toBe(false);

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 60));

    // Should be allowed again
    expect((await rateLimit(key, 2, 50)).success).toBe(true);
  });

  it('tracks different keys independently', async () => {
    const key1 = `test-${Date.now()}-ind1`;
    const key2 = `test-${Date.now()}-ind2`;

    // Exhaust key1
    await rateLimit(key1, 1, 60_000);
    expect((await rateLimit(key1, 1, 60_000)).success).toBe(false);

    // key2 should still work
    expect((await rateLimit(key2, 1, 60_000)).success).toBe(true);
  });
});
