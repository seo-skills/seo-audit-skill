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

  const hasAudits = (audits.data?.length ?? 0) > 0 || (domains.data?.length ?? 0) > 0;

  return (
    <div className="max-w-[var(--content-max-width)] mx-auto p-6 space-y-6">
      {domains.data && domains.data.length > 0 && (
        <DomainStrip domains={domains.data} selected={domain} onSelect={selectDomain} />
      )}

      {domain && (trend.data?.length ?? 0) > 1 && (
        <section
          className="p-5 rounded-xl border"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-elevated)' }}
          aria-labelledby="trend-heading"
        >
          <h2 id="trend-heading" className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
            {domain}
          </h2>
          <TrendChart points={trend.data ?? []} />
        </section>
      )}

      <section aria-labelledby="audits-heading">
        <div className="flex items-baseline justify-between mb-3">
          <h2 id="audits-heading" className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            {domain ? `Audits of ${domain}` : 'Recent audits'}
          </h2>
          {audits.data && audits.data.length > 0 && (
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {audits.data.length} shown
            </span>
          )}
        </div>

        {!audits.loading && !hasAudits ? <EmptyHistory /> : (
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
