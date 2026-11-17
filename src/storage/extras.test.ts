import { describe, it, expect, afterEach, vi } from 'vitest';
import '../rules/loader.js';
import { tempDatabase } from './audits-db/test-fixtures.js';
import { saveAuditToDatabase, buildStoredExtras, MAX_EXTRAS_SECTION_BYTES } from './save-audit.js';
import { getAuditDetail } from '../dashboard/queries.js';
import type { AuditResult } from '../types.js';

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
  vi.restoreAllMocks();
});

function audit(): AuditResult {
  return {
    url: 'https://example.com/',
    overallScore: 20,
    timestamp: '2026-11-17T00:00:00.000Z',
    crawledPages: 1,
    scoreCap: { uncappedScore: 88, caps: [{ id: 'noindex', ceiling: 20, reason: 'This page is noindex.' }] },
    waivedCaps: [{ id: 'robots-disallowed', ceiling: 20, reason: 'robots.txt blocks it.' }],
    categoryResults: [
      {
        categoryId: 'core',
        score: 50,
        passCount: 0,
        warnCount: 0,
        failCount: 1,
        results: [
          {
            ruleId: 'core-canonical-present',
            status: 'fail',
            message: 'No canonical',
            score: 0,
            weight: 10,
            details: { pageUrl: 'https://example.com/' },
            overridden: { failCi: true },
          },
          {
            ruleId: 'core-title-unique',
            status: 'not-measured',
            message: 'needs a crawl',
            score: 50,
            weight: 0,
            reason: 'not-applicable',
            details: { pageUrl: 'https://example.com/' },
          },
          {
            ruleId: 'core-description-present',
            status: 'fail',
            message: 'advisory finding',
            score: 0,
            weight: 8,
            advisory: true,
            details: { pageUrl: 'https://example.com/' },
          },
        ],
      },
    ],
  };
}

function open() {
  const temp = tempDatabase();
  cleanups.push(temp.cleanup);
  return temp;
}

describe('stored audits keep their run-level data', () => {
  it('reloads the score cap, the waived caps, override marks, reasons and advisory flags', () => {
    const { db } = open();
    const saved = saveAuditToDatabase(audit(), { db });
    const detail = getAuditDetail(db, saved.auditId)!;

    expect(detail.result.scoreCap).toEqual(audit().scoreCap);
    expect(detail.result.waivedCaps).toEqual(audit().waivedCaps);

    const results = detail.result.categoryResults[0].results;
    const byId = (id: string) => results.find((r) => r.ruleId === id)!;
    expect(byId('core-canonical-present').overridden).toEqual({ failCi: true });
    expect(byId('core-title-unique').reason).toBe('not-applicable');
    expect(byId('core-description-present').advisory).toBe(true);
  });

  it('stores no extras for a run with nothing to keep', () => {
    const plain = audit();
    delete plain.scoreCap;
    delete plain.waivedCaps;
    delete plain.categoryResults[0].results[0].overridden;
    expect(buildStoredExtras(plain)).toBeUndefined();
  });

  it('replaces an oversized section with a marker', () => {
    const big = audit();
    big.extras = { custom: 'x'.repeat(MAX_EXTRAS_SECTION_BYTES + 10) };
    expect(buildStoredExtras(big)?.['custom']).toEqual({ truncated: true, bytes: MAX_EXTRAS_SECTION_BYTES + 12 });
  });

  it('loads an audit whose stored extras are corrupt, without them, and says so', () => {
    const { db } = open();
    const saved = saveAuditToDatabase(audit(), { db });
    db.getDb().prepare('UPDATE audits SET extras_json = ? WHERE audit_id = ?').run('{"scoreCap": {', saved.auditId);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});

    const detail = getAuditDetail(db, saved.auditId)!;
    expect(detail.result.scoreCap).toBeUndefined();
    expect(detail.result.overallScore).toBe(20);
    expect(err.mock.calls.flat().join(' ')).toContain('Run the audit again to regenerate it');
  });
});
