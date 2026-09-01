/**
 * Conversions between SQLite's datetime format and JavaScript Date.
 *
 * Every `_at` column in both databases defaults to `datetime('now')`, which
 * SQLite renders as `'YYYY-MM-DD HH:MM:SS'` in **UTC** with no timezone
 * designator. That string is not ISO 8601, and `new Date()` parses it as
 * *local* time — so reading a timestamp back shifted it by the machine's UTC
 * offset. An audit written at 12:43 UTC came back as 09:43 UTC on a UTC+3
 * machine, three hours in the past.
 *
 * These helpers are the single boundary where that format is understood.
 */

/** Matches 'YYYY-MM-DD HH:MM:SS' with no timezone designator. */
const SQLITE_DATETIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/;

/**
 * Parse a timestamp read out of SQLite into a Date.
 *
 * Values in `datetime('now')` format are interpreted as UTC, which is what
 * SQLite wrote. Anything already carrying a designator (an ISO string from an
 * older write path, say) is passed through untouched.
 *
 * @param value - The raw column value
 * @returns The instant the column refers to
 */
export function parseSqliteUtc(value: string): Date {
  if (SQLITE_DATETIME.test(value)) {
    return new Date(`${value.replace(' ', 'T')}Z`);
  }
  return new Date(value);
}

/**
 * Format a Date for comparison against a SQLite datetime column.
 *
 * Range filters compare TEXT lexically, so the bound has to be written in the
 * same shape as the stored values. Passing an ISO string instead silently
 * mismatched: `'2026-09-01 12:43:59' >= '2026-09-01T00:00:00.000Z'` is false,
 * because a space sorts before 'T', so a same-day `since` bound excluded the
 * very rows it was meant to include.
 *
 * @param date - The bound to format
 * @returns A 'YYYY-MM-DD HH:MM:SS' UTC string
 */
export function toSqliteUtc(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}
