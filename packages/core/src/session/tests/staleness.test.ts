import { describe, expect, test } from 'bun:test';
import { isStaleSession, SESSION_STALE_AFTER_MS } from '../staleness';

describe('isStaleSession', () => {
  const now = 1_000_000_000;

  test('a fresh session is not stale', () => {
    expect(isStaleSession({ lastActiveAt: now - 1000, createdAt: now - 100_000 }, now)).toBe(false);
  });

  test('a session idle past the threshold is stale', () => {
    expect(
      isStaleSession(
        {
          lastActiveAt: now - SESSION_STALE_AFTER_MS - 1,
          createdAt: now - 100_000,
        },
        now,
      ),
    ).toBe(true);
  });

  test('exactly at the threshold is not stale', () => {
    expect(
      isStaleSession(
        {
          lastActiveAt: now - SESSION_STALE_AFTER_MS,
          createdAt: now - 100_000,
        },
        now,
      ),
    ).toBe(false);
  });

  test('a session that never turned uses createdAt', () => {
    expect(isStaleSession({ createdAt: now - SESSION_STALE_AFTER_MS - 1 }, now)).toBe(true);
  });
});
