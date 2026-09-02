// Regression: ISSUE-003 — `compare` rendered every timestamp with
// toISOString(), i.e. in UTC, printed bare as though it were local. An audit
// run at 18:04 on a UTC+3 machine displayed as "15:04", disagreeing with
// `report --list`, the HTML report and the Markdown report, which all use
// local time.
// Found by /qa on 2026-09-02
// Report: .gstack/qa-reports/qa-report-audit-cli-2026-09-02.md
import { describe, it, expect } from 'vitest';
import { formatDate } from './compare.js';

describe('compare formatDate (ISSUE-003)', () => {
  it('round-trips the local wall-clock components it was built from', () => {
    // Constructed from local parts, so it must print those same parts back
    // regardless of the host offset. The UTC rendering would not.
    const date = new Date(2026, 8, 2, 18, 4, 6);
    expect(formatDate(date)).toBe('2026-09-02 18:04');
  });

  it('zero-pads single-digit months, days, hours and minutes', () => {
    expect(formatDate(new Date(2026, 0, 5, 7, 9))).toBe('2026-01-05 07:09');
  });

  it('renders midnight as 00:00 rather than rolling the date', () => {
    expect(formatDate(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31 00:00');
  });

  it('matches the UTC rendering only when the host is actually at UTC', () => {
    const date = new Date(Date.UTC(2026, 8, 2, 15, 4));
    const iso = date.toISOString().slice(0, 16).replace('T', ' ');
    const isUtcHost = date.getTimezoneOffset() === 0;
    expect(formatDate(date) === iso).toBe(isUtcHost);
  });
});
