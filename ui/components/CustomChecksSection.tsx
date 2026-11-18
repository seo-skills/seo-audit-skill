/**
 * The team's own checks from seomator.toml: per-page assertions and the
 * values each extraction pulled. Shown last, and never scored.
 */
import type { AuditResult } from '../../src/types.js';
import { customResults, customSearchRows } from '../../src/reporters/custom-section.js';

const OUTCOME_COLOR = {
  pass: 'var(--color-text-muted)',
  warn: 'var(--color-warn)',
  fail: 'var(--color-fail)',
  stopped: 'var(--color-warn)',
  unchecked: 'var(--color-text-muted)',
} as const;

export function CustomChecksSection({ result }: { result: AuditResult }) {
  const custom = customResults(result);
  if (!custom) return null;
  const rows = customSearchRows(custom);
  return (
    <section id="custom-checks" className="pt-10 scroll-mt-4">
      <h3 className="text-xl leading-7 font-semibold tracking-[-0.01em]" style={{ color: 'var(--color-text)' }}>
        Custom checks
      </h3>
      <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
        From seomator.toml. Not scored.
      </p>
      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.name}>
            <span className="font-medium" style={{ color: 'var(--color-text)' }}>{row.name}</span>{' '}
            <span style={{ color: OUTCOME_COLOR[row.outcome] }}>{row.summary}</span>
            {row.failingPages.length > 0 && (
              <details className="mt-1">
                <summary className="cursor-pointer text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  Failing pages
                </summary>
                <ul className="mt-1 space-y-0.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {row.failingPages.map((page) => (
                    <li key={page} style={{ overflowWrap: 'anywhere' }}>{page}</li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ul>
      {custom.extractions.map((extraction) => (
        <div key={extraction.name} className="mt-4">
          <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            {extraction.name}{' '}
            <span className="font-normal" style={{ color: 'var(--color-text-muted)' }}>
              values from {extraction.pages.length} page{extraction.pages.length === 1 ? '' : 's'}
            </span>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs mt-1">
              <tbody>
                {extraction.pages.slice(0, 50).map((page) => (
                  <tr key={page.url} className="border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
                    <td className="py-1 pr-3 align-top" style={{ color: 'var(--color-text-secondary)', overflowWrap: 'anywhere' }}>{page.url}</td>
                    <td className="py-1 align-top" style={{ color: 'var(--color-text)' }}>{page.values.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {extraction.pages.length > 50 && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              showing 50 of {extraction.pages.length} pages; export markdown or HTML for the rest
            </p>
          )}
        </div>
      ))}
    </section>
  );
}
