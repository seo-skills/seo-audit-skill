/**
 * The two quiet sections under the fixes: what the audit could not measure,
 * and where its numbers come from. Both say plainly what counts for nothing,
 * so a score is never read as more complete than it was.
 */

import type { AuditResult } from '../../src/types.js';
import { NOT_MEASURED_REASONS, notMeasuredByReason } from '../lib/audit-state.js';
import { StatusShape } from './Status.js';

export function MeasurementGaps({ result, advisory }: { result: AuditResult; advisory: number }) {
  const groups = notMeasuredByReason(result);
  const total = groups.reduce((sum, g) => sum + g.ruleIds.length, 0);
  if (total === 0 && advisory === 0) return null;

  return (
    <section id="gaps" aria-labelledby="gaps-title" className="pt-10 scroll-mt-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-4">
        <h3 id="gaps-title" className="text-xl leading-7 font-semibold tracking-[-0.01em]">What we could not measure</h3>
        <span className="figure text-xs text-[var(--color-text-muted)]">
          {total} check{total === 1 ? '' : 's'} count for nothing, in either direction
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Reason</th>
              <th className="hidden md:table-cell">What would measure it</th>
              <th className="num">Checks</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.reason}>
                <td>
                  <span className="status">
                    <StatusShape status="not-measured" />
                    <span className="text-[var(--color-text)]">{group.label.charAt(0).toUpperCase() + group.label.slice(1)}</span>
                  </span>
                </td>
                <td className="hidden md:table-cell text-[13px] text-[var(--color-text-secondary)]">
                  {NOT_MEASURED_REASONS[group.reason].action ?? '–'}
                </td>
                <td className="num figure">{group.ruleIds.length}</td>
              </tr>
            ))}
            {advisory > 0 && (
              <tr>
                <td>
                  <span className="status">
                    <StatusShape status="advisory" />
                    <span className="text-[var(--color-text)]">Advisory: reported, not scored yet</span>
                  </span>
                </td>
                <td className="hidden md:table-cell text-[13px] text-[var(--color-text-secondary)]">
                  New checks earn a place in the score before they count
                </td>
                <td className="num figure">{advisory}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function NumbersNote({
  result,
  missing,
  fixCount,
  engineVersion,
}: {
  result: AuditResult;
  missing: number;
  fixCount: number;
  engineVersion: string | null | undefined;
}) {
  const exact = 100 - missing;
  const run = result.run as { scoringVersion?: number } | undefined;
  return (
    <section aria-labelledby="numbers" className="pt-10 pb-12">
      <h3 id="numbers" className="text-xl leading-7 font-semibold tracking-[-0.01em] mb-3">Where the numbers come from</h3>
      <ul className="list-disc pl-5 space-y-1.5 text-[13px] text-[var(--color-text-secondary)] max-w-[72ch]">
        <li>
          <b className="font-medium text-[var(--color-text)]">Score.</b> A weighted average of the categories that ran
          (core 11, performance 10 … legal 1). Each check counts pass 100, warning 50, fail 0, times its own weight.
        </li>
        <li>
          <b className="font-medium text-[var(--color-text)]">Points.</b> What passing one check would add to the score,
          from the same weights. The {fixCount} fixes add up to the {missing.toFixed(1)} missing points
          {!result.scoreCap && ` (the score is ${exact.toFixed(2)} before rounding)`}.
        </li>
        <li>
          <b className="font-medium text-[var(--color-text)]">Caps.</b>{' '}
          {result.scoreCap
            ? `${result.scoreCap.caps.map((c) => c.reason).join(' ')} The score is held at ${result.overallScore} until that is fixed.`
            : 'None applied. When a page cannot be indexed the score is held at a ceiling, and the fix that lifts it is worth the whole gap.'}
        </li>
        <li>
          <b className="font-medium text-[var(--color-text)]">Not measured and advisory.</b> Reported, never scored.
          Engine {engineVersion ?? 'unknown'}
          {run?.scoringVersion !== undefined && `, scoring version ${run.scoringVersion}`}.
        </li>
      </ul>
    </section>
  );
}
