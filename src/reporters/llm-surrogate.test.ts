// Hardening: ISSUE-020 — a lone surrogate would have made the whole report unparseable
// Found by /qa on 2026-09-04
// Report: .gstack/qa-reports/qa-report-cli-agent-2026-09-04.md
//
// `stripInvisible()` removed C0/C1 controls, zero-width characters and the
// Unicode tag block, and let unpaired surrogates through. One reaching the
// output is not a mangled field: a lone surrogate is not a legal XML character
// and does not encode to valid UTF-8, so the agent loses the entire audit.
//
// **No end-to-end repro was found.** HTML parsing replaces a `&#xD800;`
// reference with U+FFFD before any rule sees it, and three attempts to smuggle
// one through JSON-LD, headers and page text all failed. This is hardening
// against a reachable-in-principle path — `JSON.parse` accepts `"\ud800"` and
// yields a lone surrogate — not a fixed live bug. It is recorded that way so
// nobody later reads the guard as evidence of an exploit.
import { describe, it, expect } from 'vitest';
import { renderLlmReport } from './llm-reporter.js';

function reportWith(message: string, details: Record<string, unknown> = {}): string {
  return renderLlmReport({
    schemaVersion: 2,
    url: 'https://x.test/',
    overallScore: 50,
    crawledPages: 1,
    timestamp: new Date().toISOString(),
    categoryResults: [
      {
        categoryId: 'core',
        score: 50,
        passCount: 0,
        warnCount: 0,
        failCount: 1,
        notMeasuredCount: 0,
        results: [
          {
            ruleId: 'core-title-present',
            status: 'fail',
            score: 0,
            weight: 1,
            message,
            details: { pageUrl: 'https://x.test/', ...details },
          },
        ],
      },
    ],
  } as never);
}

/** Any surrogate left after removing well-formed pairs is unpaired. */
function hasLoneSurrogate(text: string): boolean {
  return /[\uD800-\uDFFF]/.test(text.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ''));
}

describe('a lone surrogate never reaches the report', () => {
  it('strips a lone high surrogate from a rule message', () => {
    expect(hasLoneSurrogate(reportWith('before \uD800 after'))).toBe(false);
  });

  it('strips a lone low surrogate too', () => {
    expect(hasLoneSurrogate(reportWith('before \uDFFF after'))).toBe(false);
  });

  it('strips one arriving through details, not just the message', () => {
    // details is where page-derived JSON lands, which is the likelier path.
    expect(hasLoneSurrogate(reportWith('ok', { sample: 'x\uD800y' }))).toBe(false);
  });

  it('keeps the surrounding text, rather than dropping the field', () => {
    const xml = reportWith('before \uD800 after');
    expect(xml).toContain('before');
    expect(xml).toContain('after');
  });
});

describe('valid text is untouched', () => {
  it('keeps a real astral character, which is a legitimate surrogate pair', () => {
    // 🎯 is U+1F3AF, stored as a pair. Stripping it would corrupt real content.
    const xml = reportWith('target 🎯 emoji');
    expect(xml).toContain('🎯');
    expect(hasLoneSurrogate(xml)).toBe(false);
  });

  it('keeps CJK and accented text', () => {
    const xml = reportWith('中文测试 café');
    expect(xml).toContain('中文测试');
    expect(xml).toContain('café');
  });

  it('encodes to UTF-8 and back unchanged', () => {
    const xml = reportWith('mixed 🎯 中文 \uD800 text');
    expect(Buffer.from(xml, 'utf8').toString('utf8')).toBe(xml);
  });
});
