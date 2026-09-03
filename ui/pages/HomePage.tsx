/**
 * Home: what happened to my sites.
 *
 * The domain strip answers that at a glance; picking one narrows the trend and
 * the list below it. There is no separate "history" screen — history is the
 * home screen, because a dashboard with nothing to show is a dashboard nobody
 * opens twice.
 */

import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getReads } from '../lib/api-client.js';
import { useAsync, useRefreshOnFocus } from '../lib/hooks.js';
import { DomainStrip } from '../components/DomainStrip.js';
import { TrendChart } from '../components/TrendChart.js';
import { AuditList } from '../components/AuditList.js';
import { PageError } from '../components/PageError.js';

export function HomePage() {
  const [params, setParams] = useSearchParams();
  const domain = params.get('domain');
  const reads = getReads();
  const [reloadNonce, setReloadNonce] = useState(0);

  const domains = useAsync(() => reads.listDomains(), [reloadNonce]);
  const audits = useAsync(
    () => reads.listAudits({ ...(domain ? { domain } : {}), limit: 50 }),
    [domain, reloadNonce]
  );
  const trend = useAsync(
    () => (domain ? reads.getScoreTrend({ domain, limit: 20 }) : Promise.resolve([])),
    [domain, reloadNonce]
  );

  // An audit finished by a CLI run in another terminal should appear when the
  // user comes back to this window.
  const refresh = useCallback(() => setReloadNonce((n) => n + 1), []);
  useRefreshOnFocus(refresh);

  const selectDomain = useCallback(
    (next: string | null) => {
      setParams(next ? { domain: next } : {}, { replace: true });
    },
    [setParams]
  );

  if (domains.serverGone || audits.serverGone) {
    return <PageError kind="server-gone" onRetry={refresh} />;
  }

  // A restarted server mints a new token; this tab still holds the old cookie.
  // Retrying the same fetch can never succeed — only a reload picks the new one
  // up, because the cookie is set on the document response.
  if (domains.stale || audits.stale) {
    return <PageError kind="stale-session" />;
  }

  // A failed read is not an empty database. Without this branch the page told a
  // user whose read had failed that they had no audits yet and invited them to
  // run their first one — while the audits they already had sat unread.
  if (audits.error && !audits.data) {
    return <PageError kind="read-failed" message={audits.error} onRetry={refresh} />;
  }

  const hasAudits = (audits.data?.length ?? 0) > 0 || (domains.data?.length ?? 0) > 0;

  // Filtering to a domain with no audits is not the same as having none at all,
  // and telling someone to run their first audit when they have twelve of
  // another site reads as if the dashboard lost them.
  const filteredEmpty = Boolean(domain) && !audits.loading && (audits.data?.length ?? 0) === 0;

  return (
    <div className="max-w-[var(--content-max-width)] mx-auto p-6 space-y-6">
      {domains.data && domains.data.length > 0 && (
        <DomainStrip domains={domains.data} selected={domain} onSelect={selectDomain} />
      )}

      {/* The chart owns the threshold. Duplicating it here hid the section
          entirely below three points, so the message explaining why there is
          no trend yet could never be seen. */}
      {domain && (trend.data?.length ?? 0) > 0 && (
        <section
          className="p-5 rounded-xl border"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-elevated)' }}
          aria-labelledby="trend-heading"
        >
          <h2 id="trend-heading" className="text-base font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
            {domain}
          </h2>
          <TrendChart points={trend.data ?? []} />
        </section>
      )}

      <section aria-labelledby="audits-heading">
        <div className="flex items-baseline justify-between mb-3">
          <h1 id="audits-heading" className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
            {domain ? `Audits of ${domain}` : 'Recent audits'}
          </h1>
          {audits.data && audits.data.length > 0 && (
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {audits.data.length} shown
            </span>
          )}
        </div>

        {filteredEmpty ? (
          <NoAuditsForDomain domain={domain!} onClear={() => selectDomain(null)} />
        ) : !audits.loading && !hasAudits ? (
          <EmptyHistory />
        ) : (
          <AuditList
            audits={audits.data ?? []}
            loading={audits.loading}
            linkTo={(auditId) => `/audits/${auditId}`}
          />
        )}
      </section>
    </div>
  );
}

/** What the dashboard says before anything has been audited */
function EmptyHistory() {
  return (
    <div
      className="rounded-xl border border-dashed p-10 text-center"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <p className="text-base font-medium mb-1" style={{ color: 'var(--color-text)' }}>
        No audits yet
      </p>
      <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
        Every audit you run is stored here automatically.
      </p>
      <code
        className="inline-block text-sm px-3 py-2 rounded-lg"
        style={{ backgroundColor: 'var(--color-bg-hover)', color: 'var(--color-text)' }}
      >
        seomator audit https://example.com
      </code>
      <p className="text-xs mt-4" style={{ color: 'var(--color-text-muted)' }}>
        Then come back to this page, or press <Link to="/" className="underline">reload</Link>.
      </p>
    </div>
  );
}

/** The filter matched nothing — which is not the same as having no history */
function NoAuditsForDomain({ domain, onClear }: { domain: string; onClear: () => void }) {
  return (
    <div
      className="rounded-xl border border-dashed p-10 text-center"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <p className="text-base font-medium mb-1" style={{ color: 'var(--color-text)' }}>
        No audits of {domain}
      </p>
      <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
        Your other sites are still here.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="px-3 py-1.5 text-sm rounded-md font-medium border"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
      >
        Show all sites
      </button>
    </div>
  );
}
