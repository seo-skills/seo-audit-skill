import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { fetchPage } from '../../crawler/fetcher.js';

/**
 * Known AI crawler user-agent identifiers.
 * These are the primary bots used by generative AI platforms to index web content.
 */
const AI_BOTS = [
  'GPTBot',
  'ChatGPT-User',
  'Google-Extended',
  'CCBot',
  'anthropic-ai',
  'Claude-Web',
  'Bytespider',
  'PerplexityBot',
  'Amazonbot',
] as const;

/**
 * Extracts the base URL (origin) from a full URL
 */
function getBaseUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.origin;
  } catch {
    return url;
  }
}

/**
 * Parses robots.txt content and returns which AI bots are blocked with
 * a blanket Disallow: / rule.
 *
 * This performs a simplified parse: for each AI bot, it checks whether
 * there is a User-agent section that applies to it (either by name or via
 * the wildcard *) AND whether that section contains `Disallow: /`.
 */
function findBlockedAiBots(content: string): string[] {
  const lines = content.split('\n').map((l) => l.trim());
  const blocked: string[] = [];

  // Build a map: user-agent -> list of disallow paths
  const sections: Map<string, string[]> = new Map();
  let currentAgents: string[] = [];

  for (const line of lines) {
    // Skip comments and empty lines
    if (!line || line.startsWith('#')) {
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) {
      continue;
    }

    const directive = line.substring(0, colonIdx).trim().toLowerCase();
    const value = line.substring(colonIdx + 1).trim();

    if (directive === 'user-agent') {
      // If we encounter a new User-agent after disallow directives,
      // it starts a new group
      currentAgents.push(value);
    } else if (directive === 'disallow') {
      // Assign this disallow to all current agents
      for (const agent of currentAgents) {
        const existing = sections.get(agent) || [];
        existing.push(value);
        sections.set(agent, existing);
      }
    } else {
      // Any other directive does not reset the agent group
    }

    // Reset agent group when we see a blank line (handled above by continue)
  }

  // Re-parse with proper group handling: groups are separated by blank lines
  // Use a simpler, more robust approach
  const groups: Array<{ agents: string[]; disallows: string[] }> = [];
  let group: { agents: string[]; disallows: string[] } = { agents: [], disallows: [] };

  for (const line of lines) {
    if (!line || line.startsWith('#')) {
      if (group.agents.length > 0) {
        groups.push(group);
        group = { agents: [], disallows: [] };
      }
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const directive = line.substring(0, colonIdx).trim().toLowerCase();
    const value = line.substring(colonIdx + 1).trim();

    if (directive === 'user-agent') {
      // If we already have disallows, start a new group
      if (group.disallows.length > 0) {
        groups.push(group);
        group = { agents: [], disallows: [] };
      }
      group.agents.push(value);
    } else if (directive === 'disallow') {
      group.disallows.push(value);
    }
  }
  if (group.agents.length > 0) {
    groups.push(group);
  }

  // Check each AI bot against groups
  for (const bot of AI_BOTS) {
    const botLower = bot.toLowerCase();
    let isBlocked = false;

    for (const g of groups) {
      // Check if this group applies to this bot (exact match or wildcard)
      const applies = g.agents.some(
        (agent) =>
          agent === '*' || agent.toLowerCase() === botLower
      );

      if (applies && g.disallows.includes('/')) {
        isBlocked = true;
        break;
      }
    }

    if (isBlocked) {
      blocked.push(bot);
    }
  }

  return blocked;
}

/**
 * Rule: AI Bot Access
 *
 * Checks whether the site's robots.txt blocks AI crawlers. Blocking
 * generative-AI bots prevents content from appearing in AI-generated
 * answers (ChatGPT, Perplexity, Google AI Overviews, etc.).
 *
 * This rule fetches /robots.txt and looks for User-agent sections that
 * target known AI bots with a blanket Disallow: /.
 *
 * Scoring:
 * - No AI bots blocked: pass
 * - Some AI bots blocked: warn
 * - All major AI bots blocked: fail
 */
export const aiBotAccessRule = defineRule({
  id: 'geo-ai-bot-access',
  name: 'AI Bot Access',
  description:
    'Checks if robots.txt blocks AI crawlers (GPTBot, ChatGPT-User, Google-Extended, Claude-Web, etc.)',
  category: 'geo',
  weight: 20,
  run: async (context: AuditContext) => {
    const baseUrl = getBaseUrl(context.url);
    const robotsTxtUrl = `${baseUrl}/robots.txt`;

    let robotsContent: string | null = null;

    try {
      const result = await fetchPage(robotsTxtUrl);
      if (result.statusCode === 200) {
        robotsContent = result.html;
      }
    } catch {
      // Could not fetch robots.txt - not an error for this rule
    }

    if (robotsContent === null) {
      return pass(
        'geo-ai-bot-access',
        'No robots.txt found or not accessible - AI bots are not blocked',
        {
          robotsTxtUrl,
          robotsTxtAccessible: false,
          blockedBots: [],
          totalBotsChecked: AI_BOTS.length,
        }
      );
    }

    const blockedBots = findBlockedAiBots(robotsContent);
    const allowedBots = AI_BOTS.filter((bot) => !blockedBots.includes(bot));

    const details: Record<string, unknown> = {
      robotsTxtUrl,
      robotsTxtAccessible: true,
      blockedBots,
      allowedBots,
      totalBotsChecked: AI_BOTS.length,
      blockedCount: blockedBots.length,
    };

    if (blockedBots.length === 0) {
      return pass(
        'geo-ai-bot-access',
        'AI bots are not blocked in robots.txt',
        details
      );
    }

    if (blockedBots.length >= AI_BOTS.length) {
      return fail(
        'geo-ai-bot-access',
        `All ${AI_BOTS.length} major AI bots are blocked in robots.txt`,
        {
          ...details,
          recommendation:
            'Remove or relax AI bot restrictions to allow your content to appear in AI-generated answers',
        }
      );
    }

    return warn(
      'geo-ai-bot-access',
      `${blockedBots.length}/${AI_BOTS.length} AI bots blocked in robots.txt: ${blockedBots.join(', ')}`,
      {
        ...details,
        recommendation:
          'Consider allowing AI bots to crawl your content for better visibility in AI-generated answers',
      }
    );
  },
});
