/**
 * The failures a page can hit that are not the page's fault: the server
 * stopped, the thing being asked for is not there, or the read itself failed.
 *
 * `read-failed` matters because without it a failed read renders as an empty
 * database — the user is told they have no audits and invited to run their
 * first one, when in fact the ones they have could not be loaded.
 */

import { Link } from 'react-router-dom';

interface PageErrorProps {
  kind: 'server-gone' | 'not-found' | 'read-failed' | 'stale-session';
  /** Overrides the heading; some "not found" cases are not failures */
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function PageError({ kind, title, message, onRetry }: PageErrorProps) {
  const defaultTitle =
    kind === 'stale-session'
      ? 'The dashboard was restarted'
      : kind === 'server-gone'
      ? 'The dashboard server stopped'
      : kind === 'read-failed'
        ? 'Could not load your audits'
        : 'Not found';

  const defaultMessage =
    kind === 'stale-session'
      ? 'It is running, but this tab is holding the previous session. Reloading reconnects it.'
      : kind === 'server-gone'
      ? 'Start it again with `seomator serve`, then retry.'
      : kind === 'read-failed'
        ? 'The database is there but the read failed. Retrying often works; if it does not, the file may be locked by another process.'
        : 'This audit is not in the database. It may have been deleted.';

  return (
    <div className="max-w-[var(--content-max-width)] mx-auto p-6">
      <div
        className="rounded-xl border p-8 text-center"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-elevated)' }}
        role="alert"
      >
        <p className="text-base font-medium mb-1" style={{ color: 'var(--color-text)' }}>
          {title ?? defaultTitle}
        </p>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          {message ?? defaultMessage}
        </p>
        <div className="flex items-center justify-center gap-2">
          {kind === 'stale-session' ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 text-sm rounded-md font-medium"
              style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
            >
              Reload
            </button>
          ) : (
            onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-3 py-1.5 text-sm rounded-md font-medium"
              style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
            >
              Retry
            </button>
            )
          )}
          <Link
            to="/"
            className="px-3 py-1.5 text-sm rounded-md font-medium border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          >
            Back to history
          </Link>
        </div>
      </div>
    </div>
  );
}
