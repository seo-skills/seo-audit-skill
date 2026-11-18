/**
 * The score, as the first thing on the report.
 *
 * A plain number, no ring (DESIGN.md, R3): ink at 80 and above, amber below,
 * red under 70, with the grade word always in ink. The meter and the next
 * grade sit under it, and a binding cap is named here, with what lifts it,
 * because nothing in the fix queue moves the score until it is gone. Beside
 * it: what the score is missing, what it did not count, and what changed since
 * the last run — the only place green appears, because green means "better".
 * No single fix is featured; the queue below starts at 01.
 */

import { Link } from 'react-router-dom';
import type { AuditResult } from '../../src/types.js';
import type { StoredComparison } from '../../src/dashboard/contract.js';
import { getScoreColor, getScoreLabel } from '../lib/format.js';
import { ScoreMeter } from './ScoreMeter.js';
import { Status } from './Status.js';
import { FixText } from './FixText.js';
import { capHeadline, nextGradeLine, type Fix } from '../lib/fixes.js';

interface ScorePanelProps {
  result: AuditResult;
  auditId: string;
  missing: number;
  scored: number;
  notMeasured: number;
  advisory: number;
  comparison: StoredComparison | null;
  /** "Completed", plus coverage on a crawl */
  completion: string;
  /** A link back to the run form when checks need a render */
  hint: { text: string; href: string } | null;
  /** The fix queue, in order: the next grade is said in its terms */
  fixes: Fix[];
  /** Straight from a run: the meter fills once */
  arriving?: boolean;
}

/** "14:41" on the same day, "Nov 17" otherwise */
function when(iso: string, reference: string): string {
  const date = new Date(iso);
  const sameDay = new Date(reference).toDateString() === date.toDateString();
  return sameDay
    ? date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ScorePanel(props: ScorePanelProps) {
  const { result, auditId, missing, scored, notMeasured, advisory, comparison, completion, hint, fixes, arriving } = props;
  const cap = result.scoreCap;
  const binding = cap?.caps[0];
  // The bar shows the exact score; under a cap it shows the score that holds
  const exact = cap ? result.overallScore : 100 - missing;

  return (
    <section aria-label="Score" className="grid lg:grid-cols-[8fr_4fr] border-b border-[var(--color-border)]">
      <div className="py-7 lg:pr-12 min-w-0">
        <div className="label">Score</div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="flex items-baseline gap-1">
            <span className="figure text-[56px] leading-[56px] font-medium tracking-[-0.03em]" style={{ color: getScoreColor(result.overallScore) }}>
              {result.overallScore}
            </span>
            <span className="figure text-lg text-[var(--color-text-muted)]">/100</span>
          </span>
          <span className="text-xl leading-7 font-semibold">{getScoreLabel(result.overallScore)}</span>
        </div>
        <div className="mt-5 max-w-[560px]">
          <ScoreMeter value={exact} score={result.overallScore} size="lg" animate={arriving} />
        </div>
        {!cap && <p className="mt-3 text-base leading-6 text-[var(--color-text-secondary)] max-w-[60ch]">{nextGradeLine(exact, fixes)}</p>}
        {cap && binding && (
          <div className="mt-5 max-w-[60ch]">
            <div className="flex flex-wrap items-center gap-3">
              <Status status="fail" word="Holds the score" />
              <span className="label">
                Capped at {binding.ceiling} · <span className="figure">{cap.uncappedScore}</span> without it
              </span>
            </div>
            <p className="mt-2 text-base leading-6 font-semibold">
              <FixText text={capHeadline(binding.id)} />
            </p>
            <p className="mt-1 text-[13px] text-[var(--color-text-secondary)] [overflow-wrap:anywhere]">{binding.reason}</p>
          </div>
        )}
      </div>

      <div className="py-7 min-w-0 border-t lg:border-t-0 lg:border-l border-[var(--color-border)] lg:pl-8">
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[13px]">
          <dt className="text-[var(--color-text-secondary)]">Missing</dt>
          <dd className="figure text-right">{missing.toFixed(1)} pts</dd>
          <dt className="text-[var(--color-text-secondary)]">Scored checks</dt>
          <dd className="figure text-right">{scored.toLocaleString()}</dd>
          <dt className="text-[var(--color-text-secondary)]">Not measured</dt>
          <dd className="figure text-right">
            <a href="#gaps" className="hover:underline">{notMeasured.toLocaleString()}</a>
          </dd>
          <dt className="text-[var(--color-text-secondary)]">Advisory, not scored</dt>
          <dd className="figure text-right">{advisory.toLocaleString()}</dd>
        </dl>
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          {completion}
          {hint && (
            <>
              {' · '}
              <Link to={hint.href} className="underline underline-offset-[3px] hover:text-[var(--color-agent-text)]">
                {hint.text}
              </Link>
            </>
          )}
        </p>

        {comparison && <SinceLastRun comparison={comparison} auditId={auditId} />}
      </div>
    </section>
  );
}

function SinceLastRun({ comparison, auditId }: { comparison: StoredComparison; auditId: string }) {
  const { improved, regressed, added } = comparison.rules;
  const delta = comparison.scoreDelta;
  const shown = 3;
  return (
    <div className="mt-5 pt-4 border-t border-[var(--color-border)]">
      <div className="label">
        Since {when(comparison.previous.startedAt, comparison.current.startedAt)} ·{' '}
        {delta === 0 ? 'score unchanged' : (
          <span style={{ color: delta > 0 ? 'var(--color-pass)' : 'var(--color-fail)' }}>
            score {delta > 0 ? '▲' : '▼'}{Math.abs(delta)}
          </span>
        )}
      </div>
      <ul className="mt-2 space-y-1 text-[13px]">
        {improved.slice(0, shown).map((rule) => (
          <li key={`i-${rule.ruleId}`} className="flex justify-between gap-3">
            <span className="truncate">{rule.ruleName}</span>
            <span className="figure" style={{ color: 'var(--color-pass)' }}>fixed</span>
          </li>
        ))}
        {regressed.slice(0, shown).map((rule) => (
          <li key={`r-${rule.ruleId}`} className="flex justify-between gap-3">
            <span className="truncate">{rule.ruleName}</span>
            <span className="figure" style={{ color: 'var(--color-fail)' }}>
              {rule.to === 'fail' ? 'now fails' : 'now warns'}
            </span>
          </li>
        ))}
        {added.length > 0 && (
          <li className="flex justify-between gap-3 text-[var(--color-text-muted)]">
            <span>Checks not in the previous run</span>
            <span className="figure">{added.length}</span>
          </li>
        )}
        {improved.length === 0 && regressed.length === 0 && added.length === 0 && (
          <li className="text-[var(--color-text-muted)]">No check changed status</li>
        )}
      </ul>
      {(improved.length > shown || regressed.length > shown) && (
        <Link to={`/compare/${auditId}`} className="mt-2 inline-block text-[13px] underline underline-offset-[3px]">
          Compare in full
        </Link>
      )}
    </div>
  );
}
