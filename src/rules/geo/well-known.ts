import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';
import { looksLikeHtml, probeOnce } from './probe.js';

const MANIFESTS = [
  '/.well-known/mcp.json',
  '/.well-known/agent-card.json',
  '/.well-known/agent.json',
];
const LEGACY = '/.well-known/ai-plugin.json';

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Rule: Well-known agent manifests
 *
 * Probes once per origin for an MCP server card or an agent card. A leftover
 * ChatGPT plugin file with no current manifest is called out on its own.
 */
export const wellKnownAgentRule = defineRule({
  id: 'geo-well-known',
  name: 'Well-Known Agent Manifest',
  description: 'Checks for an MCP or agent-card manifest under .well-known',
  category: 'geo',
  weight: 1,
  run: async (context: AuditContext) => {
    const origin = originOf(context.url);
    if (!origin) {
      return pass('geo-well-known', 'Page URL has no origin to probe', { found: false });
    }

    const found: string[] = [];
    for (const path of MANIFESTS) {
      const result = await probeOnce(context, `${origin}${path}`, {});
      if (result && result.status === 200 && !looksLikeHtml(result)) found.push(path);
    }

    if (found.length > 0) {
      return pass('geo-well-known', `Agent manifest found: ${found.join(', ')}`, { found });
    }

    const legacy = await probeOnce(context, `${origin}${LEGACY}`, {});
    if (legacy && legacy.status === 200 && !looksLikeHtml(legacy)) {
      return warn('geo-well-known', 'Only a legacy ai-plugin.json manifest was found', {
        found: [LEGACY],
        recommendation: 'Replace the ChatGPT plugin file with an MCP server card or an agent card.',
      });
    }

    return warn('geo-well-known', 'No MCP or agent-card manifest under .well-known', {
      found: [],
      recommendation: 'Publish /.well-known/mcp.json or /.well-known/agent-card.json if agents should call this site.',
    });
  },
});
