/**
 * The first fix, as the largest thing on the report (DESIGN.md, R1).
 *
 * The one 2px orange flag on the screen sits on its left edge, the agent is
 * docked above it saying one sentence the numbers support, and the fix text
 * itself is the headline. A capped score leads with lifting the cap instead,
 * because nothing else moves the score until then; an audit with nothing to fix
 * says so rather than showing an empty block.
 */

import { useEffect, useState } from 'react';
import type { AuditResult } from '../../src/types.js';
import { Agent } from './Logo.js';
import { Status } from './Status.js';
import { FixText } from './FixText.js';
import { agentLine, capHeadline, formatPoints, tied, type Fix } from '../lib/fixes.js';
import { Chevron, Evidence } from './FixQueue.js';

interface LeadFixProps {
  fixes: Fix[];
  result: AuditResult;
  /** Checks that took no reading, for the zero-fix state */
  notMeasured: number;
  onShowEvidence: (fix: Fix) => void;
  /** Straight from a run: the agent reacts once, then settles */
  greet?: 'alert' | 'delighted';
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

export function LeadFix({ fixes, result, notMeasured, onShowEvidence, greet }: LeadFixProps) {
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  // The evidence opens here, under the fix, rather than jumping to the end of
  // the report: the reader asked about this fix and should not lose it.
  const [open, setOpen] = useState(false);
  const lead = fixes[0];
  const cap = result.scoreCap?.caps[0];
  const crawl = result.crawledPages > 1;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied('done');
    } catch {
      setCopied('failed');
    }
    window.setTimeout(() => setCopied('idle'), 1500);
  };

  if (cap && result.scoreCap) {
    const lift = Math.max(result.scoreCap.uncappedScore - result.overallScore, 0);
    return (
      <div className="lead-fix pl-[26px] pr-6 lg:pr-12">
        <Dock state="alert" line={agentLine(fixes, result)} />
        <div className="flex items-center gap-3 mb-2.5">
          <Status status="fail" word="Holds the score" />
          <span className="label">Score cap</span>
        </div>
        <h2 className="text-[32px] leading-[36px] lg:text-[40px] lg:leading-[44px] font-semibold tracking-[-0.02em] max-w-[22ch]">
          <FixText text={capHeadline(cap.id)} />
        </h2>
        <p className="mt-4 text-base leading-6 max-w-[60ch] text-[var(--color-text-secondary)]">{cap.reason}</p>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <CopyButton state={copied} onCopy={() => void copy(`${capHeadline(cap.id)}\n${cap.reason}\nPage: ${result.url}`)} />
          <Points value={`+${lift}`} label="lifts the cap" />
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="lead-fix pl-[26px] pr-6 lg:pr-12">
        <Dock state="idle" line={agentLine(fixes, result)} />
        <h2 className="text-[32px] leading-[36px] font-semibold tracking-[-0.02em]">Nothing to fix in what we measured</h2>
        {notMeasured > 0 && (
          <p className="mt-4 text-base leading-6 text-[var(--color-text-secondary)]">
            {notMeasured} check{notMeasured === 1 ? '' : 's'} took no reading. <a href="#gaps" className="underline underline-offset-[3px]">What we could not measure</a>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="lead-fix pl-[26px] pr-6 lg:pr-12">
      <Dock state="focused" greet={greet} line={agentLine(fixes, result)} />
      <div className="flex flex-wrap items-center gap-3 mb-2.5">
        <span className="figure text-[var(--color-text-muted)]">01</span>
        <Status status={lead.status} />
        <span className="label">{lead.categoryName}</span>
      </div>
      <h2 className="text-[32px] leading-[36px] lg:text-[40px] lg:leading-[44px] font-semibold tracking-[-0.02em] max-w-[22ch] [overflow-wrap:anywhere]">
        <FixText text={lead.headline} />
      </h2>
      <p className="mt-4 text-base leading-6 max-w-[60ch] text-[var(--color-text-secondary)] [overflow-wrap:anywhere]">
        {lead.message.replace(/\.$/, '')}.{lead.rest && <> <FixText text={lead.rest} />.</>}
      </p>
      <p className="mt-2.5 figure text-xs text-[var(--color-text-muted)] [overflow-wrap:anywhere]">
        {lead.ruleId}
        {crawl && ` · ${lead.affectedPages.toLocaleString()} of ${lead.measuredPages.toLocaleString()} pages`}
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <Chevron open={open} />
          {open ? 'Hide evidence' : 'Show evidence'}
        </button>
        <CopyButton state={copied} onCopy={() => void copy(brief(lead, result.url))} />
        <Points value={formatPoints(lead.points)} label={`score points${tied(lead, fixes[1]) ? ' · tied with 02' : ''}`} />
      </div>
      {open && (
        <div className="mt-5 pt-4 border-t border-[var(--color-border)]">
          <Evidence fix={lead} onReveal={onShowEvidence} indent={false} />
        </div>
      )}
    </div>
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
    <div className="flex items-center gap-2.5 mb-6">
      <Agent state={shown} size={28} label={`SEOmator agent, ${state}`} />
      <span className="agent-say">{line}</span>
    </div>
  );
}

/**
 * Copy, with its result said in place: the label swaps to "Copied" and a
 * check, softened by a short blur so the two words read as one change.
 */
function CopyButton({ state, onCopy }: { state: 'idle' | 'done' | 'failed'; onCopy: () => void }) {
  const text = state === 'done' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy for a developer';
  return (
    <button type="button" className="btn btn-ghost" onClick={onCopy} aria-live="polite">
      <span key={state} className="inline-flex items-center gap-1.5 copy-swap">
        {state === 'done' && (
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
            <path d="M2.5 6.5l2.2 2.2L9.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {text}
      </span>
    </button>
  );
}

function Points({ value, label }: { value: string; label: string }) {
  return (
    <div className="ml-auto text-right">
      <div className="figure text-[28px] leading-8 font-medium">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}
