import { describe, it, expect } from 'vitest';
import { parseSqliteUtc, toSqliteUtc } from './sqlite-time.js';

/**
 * Regression: ISSUE-009 — SQLite datetimes were read as local time
 * Found by /qa on 2026-09-01
 * Report: .gstack/qa-reports/qa-report-seomator-cli-2026-09-01.md
 *
 * `datetime('now')` writes UTC without a designator. `new Date()` parses that
 * as local, so every stored timestamp came back shifted by the machine's UTC
 * offset — three hours in the past on the machine this was found on.
 */
describe('parseSqliteUtc', () => {
  it('reads a SQLite datetime as UTC, not local time', () => {
    // The exact value that came back as 09:43:59Z on a UTC+3 machine.
    expect(parseSqliteUtc('2026-09-01 12:43:59').toISOString()).toBe('2026-09-01T12:43:59.000Z');
  });

  it('does not shift by the host timezone', () => {
    // Whatever TZ the suite runs under, the instant must be the one stored.
    const parsed = parseSqliteUtc('2026-01-15 00:00:00');
    expect(parsed.getTime()).toBe(Date.UTC(2026, 0, 15, 0, 0, 0));
  });

  it('accepts fractional seconds', () => {
    expect(parseSqliteUtc('2026-09-01 12:43:59.500').toISOString()).toBe(
      '2026-09-01T12:43:59.500Z'
    );
  });

  it('passes through a value that already carries a designator', () => {
    // An ISO string from another write path must not be re-interpreted.
    expect(parseSqliteUtc('2026-09-01T12:43:59.000Z').toISOString()).toBe(
      '2026-09-01T12:43:59.000Z'
    );
  });
});

describe('toSqliteUtc', () => {
  it('formats a bound in the same shape the columns store', () => {
    expect(toSqliteUtc(new Date('2026-09-01T00:00:00.000Z'))).toBe('2026-09-01 00:00:00');
  });

  it('makes a same-day since bound actually match', () => {
    // The bug: range filters compare TEXT lexically, and ' ' sorts before 'T',
    // so an ISO bound excluded same-day rows it was meant to include.
    const stored = '2026-09-01 12:43:59';
    const isoBound = new Date('2026-09-01').toISOString();
    expect(stored >= isoBound).toBe(false); // what the mismatch produced

    const bound = toSqliteUtc(new Date('2026-09-01'));
    expect(stored >= bound).toBe(true); // what it should produce
  });

  it('round-trips through parseSqliteUtc to the second', () => {
    const original = new Date('2026-07-04T18:30:07.000Z');
    expect(parseSqliteUtc(toSqliteUtc(original)).toISOString()).toBe(original.toISOString());
  });
});
