/**
 * The two failures a page can hit that are not the page's fault: the server
 * stopped, or the thing being asked for is not there.
 */

import { Link } from 'react-router-dom';

interface PageErrorProps {
  kind: 'server-gone' | 'not-found';
  /** Overrides the heading; some "not found" cases are not failures */
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function PageError({ kind, title, message, onRetry }: PageErrorProps) {
  const serverGone = kind === 'server-gone';

  return (
    <div className="max-w-[var(--content-max-width)] mx-auto p-6">
      <div
        className="rounded-xl border p-8 text-center"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-elevated)' }}
        role="alert"
      >
        <p className="text-base font-medium mb-1" style={{ color: 'var(--color-text)' }}>
          {title ?? (serverGone ? 'The dashboard server stopped' : 'Not found')}
        </p>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          {message ??
            (serverGone
              ? 'Start it again with `seomator serve`, then retry.'
              : 'This audit is not in the database. It may have been deleted.')}
        </p>
        <div className="flex items-center justify-center gap-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-3 py-1.5 text-sm rounded-md font-medium"
              style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}
            >
              Retry
            </button>
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
