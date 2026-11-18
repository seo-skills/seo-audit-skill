/**
 * Every fix, already in order (DESIGN.md, R2).
 *
 * One queue ranked by the score points each fix returns, failures and
 * warnings together; the status shape still says which is which. It starts at
 * 01 with no fix singled out, and the agent's one sentence introduces it. A
 * row opens in place to its evidence, with a brief to copy for a developer.
 * Pages appear only on a crawl — a single-page audit printed "/" in that
 * column on every row.
 */

import { Fragment, useEffect, useState } from 'react';
import type { AuditResult } from '../../src/types.js';
import { Agent } from './Logo.js';
import { Status } from './Status.js';
import { FixText } from './FixText.js';
import { agentLine, formatPoints, type Fix } from '../lib/fixes.js';

/** Rows shown before "Show N more" */
const VISIBLE = 8;

type StatusFilter = 'all' | 'fail' | 'warn';

interface FixQueueProps {
  fixes: Fix[];
  /** For the agent's sentence, and the page a copied brief names */
  result: AuditResult;
  crawl: boolean;
  /** Points only count once a binding cap is lifted */
  capped: boolean;
  /** A category picked in "Where the points went" */
  category: { id: string; name: string } | null;
  onClearCategory: () => void;
  /** Jump to the rule's full result in "All checks" */
  onReveal: (fix: Fix) => void;
  /** Straight from a run: the agent reacts once, then settles */
  greet?: 'alert' | 'delighted';
}

export function FixQueue({ fixes, result, crawl, capped, category, onClearCategory, onReveal, greet }: FixQueueProps) {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const ranked = fixes.map((fix, index) => ({ fix, rank: index + 1 }));
  const rows = ranked.filter(
    ({ fix }) =>
      (filter === 'all' || fix.status === filter) &&
      (category === null || fix.categoryId === category.id)
  );
  const shown = showAll ? rows : rows.slice(0, VISIBLE);
  const fails = fixes.filter((f) => f.status === 'fail').length;
  const warns = fixes.length - fails;
  const columns = crawl ? 7 : 6;

  return (
    <section aria-labelledby="fix-queue" className="pt-10">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 mb-4">
        <h3 id="fix-queue" className="text-xl leading-7 font-semibold tracking-[-0.01em]">Fix queue</h3>
        <span className="figure text-xs text-[var(--color-text-muted)]">
          {fixes.length} fix{fixes.length === 1 ? '' : 'es'} · ranked by score points returned, fails and warnings together
          {capped && ' · points count once the cap is lifted'}
        </span>
        {fixes.length > 0 && (
          <div className="segmented ml-auto" role="group" aria-label="Filter fixes">
            {([
              ['all', `All ${fixes.length}`],
              ['fail', `Fails ${fails}`],
              ['warn', `Warnings ${warns}`],
            ] as const).map(([key, text]) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                className={`segment ${filter === key ? 'segment-active' : ''}`}
                onClick={() => setFilter(key)}
              >
                {text}
              </button>
            ))}
          </div>
        )}
      </div>

      <Dock
        state={result.scoreCap ? 'alert' : fixes.length === 0 ? 'idle' : 'focused'}
        greet={greet}
        line={agentLine(fixes, result)}
      />

      {category && (
        <p className="mb-3 text-[13px] text-[var(--color-text-secondary)]">
          Showing {category.name} only.{' '}
          <button type="button" className="underline underline-offset-[3px]" onClick={onClearCategory}>
            Show every category
          </button>
        </p>
      )}

      {fixes.length === 0 ? null : rows.length === 0 ? (
        <p className="tbl p-4 text-[13px] text-[var(--color-text-secondary)]">No fixes match this filter.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th className="w-10">#</th>
                <th className="w-[110px]">Status</th>
                <th>Fix</th>
                <th className="hidden md:table-cell">Category</th>
                {crawl && <th className="num">Pages</th>}
                <th className="num">Points</th>
                <th className="w-8" aria-hidden="true"></th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ fix, rank }) => {
                const isOpen = open === fix.ruleId;
                return (
                  <Fragment key={fix.ruleId}>
                    {/* The whole row opens the evidence; the headline button is
                        its keyboard control, and its click bubbles to here. */}
                    <tr
                      className="cursor-pointer hover:bg-[var(--color-bg-hover)]"
                      style={isOpen ? { borderBottom: 0 } : undefined}
                      onClick={() => setOpen(isOpen ? null : fix.ruleId)}
                    >
                      <td className="figure text-[var(--color-text-muted)]">{String(rank).padStart(2, '0')}</td>
                      <td><Status status={fix.status} /></td>
                      <td className="min-w-[240px]">
                        <button
                          type="button"
                          className="text-left font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                          aria-expanded={isOpen}
                        >
                          <FixText text={fix.headline} />
                        </button>
                        <div className="mt-0.5 text-[13px] text-[var(--color-text-muted)] [overflow-wrap:anywhere]">{fix.message}</div>
                      </td>
                      <td className="hidden md:table-cell label whitespace-nowrap">{fix.categoryName}</td>
                      {crawl && (
                        <td className="num figure">
                          {fix.affectedPages.toLocaleString()} / {fix.measuredPages.toLocaleString()}
                        </td>
                      )}
                      <td className="num figure" title={capped ? 'Once the cap is lifted' : undefined}>
                        {formatPoints(fix.points)}
                      </td>
                      <td className="text-[var(--color-text-muted)]" aria-hidden="true">
                        <Chevron open={isOpen} />
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={columns} className="bg-[var(--color-bg)]">
                          <Evidence fix={fix} url={result.url} onReveal={onReveal} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {rows.length > VISIBLE && (
            <div className="flex justify-center border border-t-0 border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-2">
              <button type="button" className="btn btn-ghost" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Show fewer' : `Show ${rows.length - VISIBLE} more`}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Dock({ state, line, greet }: { state: 'focused' | 'idle' | 'alert'; line: string; greet?: 'alert' | 'delighted' }) {
  // One reaction when a run hands over to its report, then the resting state:
  // the agent moves when something real happens, and only once.
  const [shown, setShown] = useState<typeof state | 'delighted'>(greet ?? state);
  useEffect(() => {
    if (!greet) return setShown(state);
    setShown(greet);
    const id = window.setTimeout(() => setShown(state), 900);
    return () => window.clearTimeout(id);
  }, [greet, state]);
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <Agent state={shown} size={28} label={`SEOmator agent, ${state}`} />
      <span className="agent-say">{line}</span>
    </div>
  );
}

/** A chevron that points right when closed and down when open */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 10 10"
      width="10"
      height="10"
      aria-hidden="true"
      className="inline-block"
      style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 160ms cubic-bezier(0.23, 1, 0.32, 1)' }}
    >
      <path d="M3.5 2l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/** A plain-text brief a developer can act on without opening the report */
function brief(fix: Fix, url: string): string {
  return [
    fix.headline,
    `What we saw: ${fix.message}`,
    `How to fix: ${fix.headline}${fix.rest ? `. ${fix.rest}` : ''}.`,
    `Check: ${fix.ruleId} (${fix.categoryName}) · ${formatPoints(fix.points)} score points`,
    `Page: ${url}`,
  ].join('\n');
}

/** What a fix rests on: what the check saw, why it matters, how to fix it */
function Evidence({ fix, url, onReveal }: { fix: Fix; url: string; onReveal: (fix: Fix) => void }) {
  return (
    <div className="grid gap-x-8 gap-y-3 md:grid-cols-2 py-2 md:pl-[162px]">
      <div className="min-w-0">
        <div className="label">What we saw</div>
        <p className="mt-1 [overflow-wrap:anywhere]">{fix.message}</p>
        <div className="mt-2 -ml-3 flex flex-wrap gap-1">
          <button type="button" className="btn btn-ghost" onClick={() => onReveal(fix)}>
            Every detail and page
          </button>
          <CopyButton text={brief(fix, url)} />
        </div>
      </div>
      <div className="min-w-0">
        {fix.description && (
          <>
            <div className="label">Why it matters</div>
            <p className="mt-1">{fix.description.replace(/\.$/, '')}.</p>
          </>
        )}
        <div className="label mt-3">How to fix</div>
        <p className="mt-1">
          <FixText text={fix.headline} />
          {fix.rest && <>. <FixText text={fix.rest} /></>}.
        </p>
        <p className="mt-2 figure text-xs text-[var(--color-text-muted)]">
          {fix.ruleId} · {fix.categoryName} · {formatPoints(fix.points)} pts
        </p>
      </div>
    </div>
  );
}

/**
 * Copy, with its result said in place: the label swaps to "Copied" and a
 * check, softened by a short blur so the two words read as one change.
 */
function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState('done');
    } catch {
      setState('failed');
    }
    window.setTimeout(() => setState('idle'), 1500);
  };
  const label = state === 'done' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy for a developer';
  return (
    <button type="button" className="btn btn-ghost" onClick={() => void copy()} aria-live="polite">
      <span key={state} className="inline-flex items-center gap-1.5 copy-swap">
        {state === 'done' && (
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
            <path d="M2.5 6.5l2.2 2.2L9.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {label}
      </span>
    </button>
  );
}
