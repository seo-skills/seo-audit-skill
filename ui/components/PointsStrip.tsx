/**
 * Where the points went (DESIGN.md, R4).
 *
 * One column per category, as wide as its weight. The kept part is grey; the
 * empty top is what that category costs the score, so a column's empty area
 * is its lost points and the biggest hole is the biggest cost. Hatched red
 * where the category has failures, amber where it only warns.
 *
 * The hole comes from the same `points` the fix queue ranks by, so the strip
 * and the queue can never disagree: a category's lost points are its fixes'
 * points added up. Every column is a focusable button with its numbers in its
 * label, and the same numbers are one click away as a table.
 */

import { useEffect, useRef, useState } from 'react';
import { Status } from './Status.js';
import type { CategoryResult } from '../../src/types.js';
import { CATEGORY_NAMES, type Fix } from '../lib/fixes.js';

const SHORT: Record<string, string> = {
  core: 'Core', perf: 'Perf', links: 'Links', images: 'Images', security: 'Security', a11y: 'A11y',
  technical: 'Technical', crawl: 'Crawl', schema: 'Schema', content: 'Content', js: 'JS', social: 'Social',
  eeat: 'E-E-A-T', url: 'URL', redirect: 'Redirect', mobile: 'Mobile', i18n: 'i18n', htmlval: 'HTML',
  geo: 'GEO', legal: 'Legal',
};

/** Approximate width of one 10px mono character, for "does the label fit" */
const CHAR = 6.4;

interface PointsStripProps {
  categories: CategoryResult[];
  weights: Record<string, number>;
  fixes: Fix[];
  active: string | null;
  onPick: (categoryId: string | null) => void;
}

export function PointsStrip({ categories, weights, fixes, active, onPick }: PointsStripProps) {
  const strip = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1152);
  // One tooltip for the strip. The first waits a moment, so passing the mouse
  // over does not flash it; once one is open, moving to the next column swaps
  // it at once: the same element moves, so it never animates in again.
  const [tip, setTip] = useState<{ id: string; x: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = (id: string, target: HTMLElement) => {
    window.clearTimeout(timer.current);
    const host = strip.current?.getBoundingClientRect();
    const box = target.getBoundingClientRect();
    const x = box.left + box.width / 2 - (host?.left ?? 0);
    if (tip) setTip({ id, x });
    else timer.current = window.setTimeout(() => setTip({ id, x }), 300);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setTip(null);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    const element = strip.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const totalWeight = categories.reduce((sum, c) => sum + (weights[c.categoryId] ?? 0), 0);
  const rows = categories
    .filter((c) => (weights[c.categoryId] ?? 0) > 0)
    .map((c) => {
      const own = fixes.filter((f) => f.categoryId === c.categoryId);
      const lost = own.reduce((sum, f) => sum + f.points, 0);
      const weight = weights[c.categoryId]!;
      // lost = (100 − exact category score) × weight ÷ total weight
      const hole = Math.min(100, (lost * totalWeight) / weight);
      const tone = own.some((f) => f.status === 'fail') ? 'is-fail' : own.length > 0 ? 'is-warn' : 'is-none';
      const name = CATEGORY_NAMES[c.categoryId] ?? c.categoryId;
      const short = SHORT[c.categoryId] ?? c.categoryId;
      const fits = short.length * CHAR + 6 <= (weight / totalWeight) * width;
      return { c, own, lost, weight, hole, tone, name, short, fits };
    });

  if (totalWeight === 0) return null;
  const missing = rows.reduce((sum, r) => sum + r.lost, 0);
  const costing = rows.filter((r) => r.lost > 0.0005).length;
  const unlabelled = rows.filter((r) => !r.fits).map((r) => r.name);

  return (
    <section aria-labelledby="points-went" className="pt-10">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-2">
        <h3 id="points-went" className="text-xl leading-7 font-semibold tracking-[-0.01em]">Where the points went</h3>
        <span className="figure text-xs text-[var(--color-text-muted)]">
          {missing.toFixed(1)} points missing across {costing} categor{costing === 1 ? 'y' : 'ies'} · each column is as wide as its weight
        </span>
      </div>

      <div className="relative">
      <div ref={strip} className="points-strip" role="group" aria-label="Score by category; width is the category's weight" onPointerLeave={hide}>
        {rows.map((r) => (
          <button
            key={r.c.categoryId}
            type="button"
            className="points-col"
            style={{ flexBasis: `${(r.weight / totalWeight) * 100}%` }}
            aria-pressed={active === r.c.categoryId}
            aria-label={`${r.name}: score ${r.c.score}, weight ${r.weight}%, ${r.lost.toFixed(2)} points missing`}
            onPointerEnter={(event) => show(r.c.categoryId, event.currentTarget)}
            onFocus={(event) => show(r.c.categoryId, event.currentTarget)}
            onBlur={hide}
            onClick={() => onPick(active === r.c.categoryId ? null : r.c.categoryId)}
          >
            <span className="points-bar">
              <span className={`points-hole ${r.tone}`} style={{ height: `${r.hole}%` }}>
                {r.lost >= 0.3 && <span className="points-lost">−{r.lost.toFixed(1)}</span>}
              </span>
            </span>
            <span className="points-name">{r.fits ? r.short : ''}</span>
          </button>
        ))}
      </div>
      {tip && (() => {
        const r = rows.find((row) => row.c.categoryId === tip.id);
        if (!r) return null;
        const fails = r.own.filter((f) => f.status === 'fail').length;
        const warns = r.own.length - fails;
        return (
          <div
            role="tooltip"
            // Below the strip, so it never covers the column's hole or its label
            className="strip-tip pointer-events-none absolute top-[calc(100%+4px)] z-20 w-max max-w-[240px] -translate-x-1/2 px-3 py-2 text-[13px]"
            style={{ left: Math.min(Math.max(tip.x, 120), width - 120) }}
          >
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-medium">{r.name}</span>
              <span className="figure">{r.c.score}</span>
            </div>
            <div className="figure text-xs text-[var(--color-text-muted)]">
              weight {r.weight}% · −{r.lost.toFixed(2)} pts
            </div>
            {(fails > 0 || warns > 0) && (
              <div className="mt-1 flex gap-3">
                {fails > 0 && <Status status="fail" word={`${fails} fail`} />}
                {warns > 0 && <Status status="warn" word={`${warns} warn`} />}
              </div>
            )}
          </div>
        );
      })()}
      </div>

      <p className="mt-3 text-xs text-[var(--color-text-muted)]">
        The empty top of a column is what that category costs the score: hatched red where it has failures, amber where it
        only warns. Pick a column to filter the fix queue.
        {unlabelled.length > 0 && ` Too narrow to label here: ${unlabelled.join(', ')}.`}
      </p>

      <details className="mt-2">
        <summary className="cursor-pointer text-[13px] underline underline-offset-[3px] w-fit">Show as a table</summary>
        <div className="overflow-x-auto mt-3">
          <table className="tbl">
            <thead>
              <tr>
                <th>Category</th>
                <th className="num">Weight</th>
                <th className="num">Score</th>
                <th className="num">Points missing</th>
                <th className="num">Fails</th>
                <th className="num">Warnings</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].sort((a, b) => b.lost - a.lost || b.weight - a.weight).map((r) => (
                <tr key={r.c.categoryId}>
                  <td>{r.name}</td>
                  <td className="num figure">{r.weight}%</td>
                  <td className="num figure" style={{ color: r.c.score < 70 ? 'var(--color-fail)' : r.c.score < 80 ? 'var(--color-warn)' : undefined }}>
                    {r.c.score}
                  </td>
                  <td className="num figure">{r.lost.toFixed(2)}</td>
                  <td className="num figure">{r.own.filter((f) => f.status === 'fail').length || '–'}</td>
                  <td className="num figure">{r.own.filter((f) => f.status === 'warn').length || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
