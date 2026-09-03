/**
 * Small data hooks shared by the pages.
 *
 * Each returns `{ data, error, loading, reload }` rather than throwing, so a
 * stopped server or a deleted audit renders as a message instead of a blank
 * screen.
 */

import { useCallback, useEffect, useState } from 'react';
import { HttpApiError, ServerUnreachableError } from './http-api.js';

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  /** True when the failure was the server going away, not a bad request */
  serverGone: boolean;
  /**
   * True when the server rejected our token.
   *
   * This is what a restarted `seomator serve` looks like to a page that was
   * already open: a new per-launch token is minted, the browser still holds the
   * old cookie, and every API call 401s. The document request would set the new
   * cookie — but the page is not requesting the document, it is requesting the
   * API, so retrying the same fetch fails identically forever. Only a reload
   * fixes it, and the UI has to say so rather than offering a Retry that cannot
   * work.
   */
  stale: boolean;
  loading: boolean;
  reload: () => void;
}

/**
 * Run an async read, re-running it when `deps` change or `reload()` is called.
 */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serverGone, setServerGone] = useState(false);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .then((value) => {
        if (cancelled) return;
        setData(value);
        setError(null);
        setServerGone(false);
        setStale(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setServerGone(cause instanceof ServerUnreachableError);
        setStale(cause instanceof HttpApiError && cause.status === 401);
        // Never store an empty string: callers test `if (error)`, and a falsy
        // error is indistinguishable from no error at all.
        const message = cause instanceof Error ? cause.message.trim() : '';
        setError(message !== '' ? message : 'Something went wrong.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, error, serverGone, stale, loading, reload };
}

/**
 * Re-run something when the window regains focus.
 *
 * A CLI audit finishing in another terminal should appear in the dashboard
 * when the user comes back to it, without a reload.
 */
export function useRefreshOnFocus(refresh: () => void): void {
  useEffect(() => {
    const onFocus = (): void => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);
}
