/**
 * Hook that reads build facts — rule count, category count, version — from the
 * main process.
 *
 * The rule registry exists only in the main process, so the renderer cannot
 * count rules itself. It used to print a literal "251 Rules", which sat 81
 * rules behind the engine by the time 332 shipped. Asking the registry is the
 * same thing the CLI banner does, and it cannot drift.
 *
 * Returns null until the answer arrives, so callers render the surrounding UI
 * without a number rather than a stale one. It asks through the host's reads
 * (IPC in the desktop app, `/api/info` in the browser): asking only Electron
 * left the web dashboard with no rule count, no capabilities and no category
 * list, so its run form offered options it could not check.
 */

import { useEffect, useState } from 'react';
import { getReads } from '../lib/api-client.js';
import type { AppInfoIpc } from '../../electron/shared/ipc-types.js';

export function useAppInfo(): AppInfoIpc | null {
  const [info, setInfo] = useState<AppInfoIpc | null>(null);

  useEffect(() => {
    let cancelled = false;
    getReads()
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
