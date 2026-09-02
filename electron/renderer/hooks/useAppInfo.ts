/**
 * Hook that reads build facts — rule count, category count, version — from the
 * main process.
 *
 * The rule registry exists only in the main process, so the renderer cannot
 * count rules itself. It used to print a literal "251 Rules", which sat 81
 * rules behind the engine by the time 332 shipped. Asking the registry is the
 * same thing the CLI banner does, and it cannot drift.
 *
 * Returns null until the answer arrives, and stays null outside Electron, so
 * callers render the surrounding UI without a number rather than a stale one.
 */

import { useEffect, useState } from 'react';
import { getAPI } from '../lib/ipc-client.js';
import type { AppInfoIpc } from '../../shared/ipc-types.js';

export function useAppInfo(): AppInfoIpc | null {
  const [info, setInfo] = useState<AppInfoIpc | null>(null);

  useEffect(() => {
    const api = getAPI();
    if (!api) return;

    let cancelled = false;
    api
      .getAppInfo()
      .then((value) => {
        if (!cancelled) setInfo(value);
      })
      .catch(() => {
        // No counts is better than wrong counts; the badges just stay hidden.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return info;
}
