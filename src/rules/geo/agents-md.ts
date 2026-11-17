import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';
import { looksLikeHtml, probeOnce } from './probe.js';

const PATHS = ['/AGENTS.md', '/.well-known/AGENTS.md', '/docs/AGENTS.md'];

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Rule: AGENTS.md
 *
 * Looks once per origin for an instructions file coding agents can read.
 * An HTML document at that path is a single-page fallback, not the file.
 */
export const agentsMdRule = defineRule({
  id: 'geo-agents-md',
  name: 'AGENTS.md',
  description: 'Checks that the origin publishes an AGENTS.md file rather than an HTML fallback',
  category: 'geo',
  weight: 2,
  run: async (context: AuditContext) => {
    const origin = originOf(context.url);
    if (!origin) {
      return pass('geo-agents-md', 'Page URL has no origin to probe', { found: false });
    }

    const checks = await Promise.all(
      PATHS.map(async (path) => {
        const result = await probeOnce(context, `${origin}${path}`, {});
        return { path, result };
      })
    );

    const real = checks.find(
      (check) => check.result && check.result.status === 200 && !looksLikeHtml(check.result)
    );
    if (real) {
      return pass('geo-agents-md', `AGENTS.md found at ${real.path}`, { path: real.path });
    }

    const html = checks.find(
      (check) => check.result && check.result.status === 200 && looksLikeHtml(check.result)
    );
    if (html) {
      return warn('geo-agents-md', `${html.path} returned an HTML document instead of the instructions file`, {
        path: html.path,
        recommendation: 'Serve AGENTS.md as text or Markdown, not the site HTML fallback.',
      });
    }

    return warn('geo-agents-md', 'No AGENTS.md at the usual paths', {
      paths: PATHS,
      recommendation: 'Add /AGENTS.md describing how an agent should use this site.',
    });
  },
});
