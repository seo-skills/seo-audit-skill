/**
 * Render probes: scripts run inside the rendered page that return JSON.
 *
 * Some checks need what only a browser knows: an image's displayed size, the
 * accessibility tree. A probe is a script string, so the CLI (Playwright's
 * `page.evaluate`) and the desktop app (`webContents.executeJavaScript`) run
 * the same code. Each result lands on `context.probes[id]`; a missing result
 * means the rule is not measured.
 */

/** What a fetcher can measure in the page; the web and desktop run pages show these */
export type ProbeFamily = 'imageSizing' | 'accessibilityEngine';

export interface RenderProbe {
  id: string;
  family: ProbeFamily;
  /** A JavaScript expression evaluated in the page; it may return a Promise */
  script: string;
  timeoutMs: number;
}

/** Every probe a render runs, in order. Probe modules add themselves here. */
export const RENDER_PROBES: RenderProbe[] = [];

/** Results by probe id; a probe that threw or timed out is absent */
export type ProbeResults = Record<string, unknown>;

/**
 * Run each probe through `evaluate`, one at a time, each within its timeout.
 * A failure leaves that probe's result out and the others still run.
 */
export async function runProbes(
  evaluate: (script: string) => Promise<unknown>,
  probes: RenderProbe[] = RENDER_PROBES
): Promise<ProbeResults> {
  const results: ProbeResults = {};
  for (const probe of probes) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const value = await Promise.race([
        evaluate(probe.script),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(`probe ${probe.id} timed out`)), probe.timeoutMs);
        }),
      ]);
      // Plain JSON only: what a rule reads must survive storage and IPC
      results[probe.id] = JSON.parse(JSON.stringify(value ?? null));
    } catch {
      // Absent: the rules that need it report not measured
    } finally {
      clearTimeout(timer);
    }
  }
  return results;
}
