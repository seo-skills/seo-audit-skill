/**
 * What a crawl learned about the site as a whole: hosts that slowed it down,
 * broken external links by target, and which pages the internal links favour.
 * Crawl audits only; older audits without these extras show nothing.
 */
import type { AuditResult } from '../../src/types.js';
import type { ExternalLinksExtras } from '../../src/site/external-links.js';
import type { LinkScoreSummary } from '../../src/site/link-score.js';
import { safeHref } from '../lib/format.js';

interface CrawlExtras {
  rateLimitedPages?: number;
  rateLimitedHosts?: Array<{ host: string; pages: number }>;
  notFetched?: number;
  abandonedHosts?: string[];
  stoppedByDeadline?: boolean;
  crawlDelayApplied?: { host: string; delayMs: number } | null;
}

const path = (url: string) => {
  try {
    return new URL(url).pathname || '/';
  } catch {
    return url;
  }
};

function UrlLink({ url }: { url: string }) {
  const href = safeHref(url);
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--color-accent)', overflowWrap: 'anywhere' }}>
      {url}
    </a>
  ) : (
    <span style={{ overflowWrap: 'anywhere' }}>{url}</span>
  );
}

function Subheading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-sm font-semibold mt-4 mb-2" style={{ color: 'var(--color-text)' }}>
      {children}
    </h4>
  );
}

export function SiteSection({ result }: { result: AuditResult }) {
  const crawl = result.extras?.['crawl'] as CrawlExtras | undefined;
  const external = result.extras?.externalLinks as ExternalLinksExtras | undefined;
  const links = result.extras?.linkScoreSummary as LinkScoreSummary | undefined;
  if (!crawl && !external && !links) return null;

  const crawlNotes = [
    crawl?.crawlDelayApplied && `${crawl.crawlDelayApplied.host} asked for ${crawl.crawlDelayApplied.delayMs / 1000} s between requests; the crawl waited.`,
    ...(crawl?.rateLimitedHosts ?? []).map((h) => `${h.host} rate-limited ${h.pages} page${h.pages === 1 ? '' : 's'}; they were not scored.`),
    ...(crawl?.abandonedHosts ?? []).map((host) => `${host} kept failing; the crawl stopped asking it.`),
    crawl?.stoppedByDeadline && 'The crawl reached its time limit and scored the pages it had.',
    crawl?.notFetched ? `${crawl.notFetched} queued page${crawl.notFetched === 1 ? ' was' : 's were'} not fetched.` : null,
  ].filter(Boolean) as string[];

  return (
    <section id="site" className="scroll-mt-4">
      <h3 className="text-xl leading-7 font-semibold tracking-[-0.01em]" style={{ color: 'var(--color-text)' }}>
        Site
      </h3>

      {crawlNotes.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {crawlNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}

      {external && (
        <>
          <Subheading>Broken external links</Subheading>
          {external.broken === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              No broken external links. {external.checked} checked
              {external.couldNotVerify > 0 && `, ${external.couldNotVerify} could not be verified`}
              {external.notChecked > 0 && `, ${external.notChecked} not checked`}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: 'var(--color-text-muted)' }}>
                    <th className="text-left font-medium py-1 pr-3">Target</th>
                    <th className="text-left font-medium py-1 pr-3">Answer</th>
                    <th className="text-left font-medium py-1">Linked from</th>
                  </tr>
                </thead>
                <tbody>
                  {external.brokenTargets.slice(0, 50).map((target) => (
                    <tr key={target.url} className="border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
                      <td className="py-1.5 pr-3 align-top"><UrlLink url={target.url} /></td>
                      <td className="py-1.5 pr-3 align-top" style={{ color: 'var(--color-fail)' }}>{target.reason}</td>
                      <td className="py-1.5 align-top" style={{ color: 'var(--color-text-secondary)' }}>
                        <details>
                          <summary className="cursor-pointer">{target.linkedFromCount} page{target.linkedFromCount === 1 ? '' : 's'}</summary>
                          <ul className="mt-1 space-y-0.5">
                            {target.linkedFrom.map((page) => (
                              <li key={page}><UrlLink url={page} /></li>
                            ))}
                          </ul>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {external.broken > 50 && (
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  showing 50 of {external.broken}; export JSON for the rest
                </p>
              )}
            </div>
          )}
        </>
      )}

      {links && links.pages >= 5 && (
        <>
          <Subheading>Pages by Link Score</Subheading>
          <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
            100 = the most strongly linked page in this crawl. A measure, not a score: it changes nothing above.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <ScoreList title="Best linked" pages={links.top} />
            {links.lowestIndexable.length > 0 && (
              <ScoreList title="Link to these pages from stronger ones" pages={links.lowestIndexable} />
            )}
          </div>
        </>
      )}
    </section>
  );
}

function ScoreList({ title, pages }: { title: string; pages: LinkScoreSummary['top'] }) {
  return (
    <div>
      <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>{title}</p>
      <ol className="text-sm space-y-0.5">
        {pages.map((page) => (
          <li key={page.url} className="flex gap-3">
            <span className="tabular-nums w-10 text-right" style={{ color: 'var(--color-text)' }}>{page.score.toFixed(1)}</span>
            <span title={page.url} style={{ color: 'var(--color-text-secondary)', overflowWrap: 'anywhere' }}>{path(page.url)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
