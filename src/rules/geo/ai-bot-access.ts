import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { fetchPage } from '../../crawler/fetcher.js';

/**
 * Known AI crawler user-agent identifiers.
 * These are the primary bots used by generative AI platforms to index web content.
 */
/**
 * Known AI crawlers, split by what blocking them actually costs you.
 *
 * `citation` bots fetch pages to answer a user's question right now, and the
 * answer can cite you. Blocking one removes you from that surface outright.
 *
 * `training` bots collect corpora for model training. Blocking those is a
 * legitimate, common editorial choice with no direct effect on AI-search
 * visibility, so it should not be reported the same way.
 */
const AI_BOTS_BY_PURPOSE = {
  citation: [
    'OAI-SearchBot', // ChatGPT search index
    'ChatGPT-User', // ChatGPT user-triggered browsing
    'PerplexityBot',
    'Perplexity-User',
    'ClaudeBot',
    'Claude-User',
    'Claude-SearchBot',
    'Google-Extended', // gates Gemini and AI Overviews grounding
    'DuckAssistBot',
    'MistralAI-User',
    'Amazonbot',
    'Applebot',
    'YouBot',
  ],
  training: [
    'GPTBot',
    'Google-CloudVertexBot',
    'Applebot-Extended',
    'meta-externalagent',
    'FacebookBot',
    'CCBot',
    'Bytespider',
    'cohere-ai',
    'Diffbot',
    'Timpibot',
    'omgili',
    'anthropic-ai', // retired, still seen in robots.txt
    'Claude-Web', // retired, still seen in robots.txt
  ],
} as const;

const AI_BOTS = [
  ...AI_BOTS_BY_PURPOSE.citation,
  ...AI_BOTS_BY_PURPOSE.training,
] as const;

const CITATION_BOTS: readonly string[] = AI_BOTS_BY_PURPOSE.citation;

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
 * Scoring is based on answer-engine crawlers, not training crawlers:
 * - No answer engine blocked: pass (even if training crawlers are blocked)
 * - Some answer engines blocked: warn
 * - Every answer engine blocked: fail
 */
export const aiBotAccessRule = defineRule({
  id: 'geo-ai-bot-access',
  name: 'AI Bot Access',
  description:
    'Checks whether robots.txt blocks AI answer engines (OAI-SearchBot, PerplexityBot, ClaudeBot, Google-Extended). Training-only crawlers such as GPTBot are reported but not penalised.',
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
    const blockedCitationBots = blockedBots.filter((bot) => CITATION_BOTS.includes(bot));
    const blockedTrainingBots = blockedBots.filter((bot) => !CITATION_BOTS.includes(bot));

    const details: Record<string, unknown> = {
      robotsTxtUrl,
      robotsTxtAccessible: true,
      blockedBots,
      allowedBots,
      blockedCitationBots,
      blockedTrainingBots,
      totalBotsChecked: AI_BOTS.length,
      citationBotsChecked: CITATION_BOTS.length,
      blockedCount: blockedBots.length,
    };

    if (blockedBots.length === 0) {
      return pass('geo-ai-bot-access', 'AI bots are not blocked in robots.txt', details);
    }

    // Every citation-capable bot blocked: the site cannot appear in AI answers.
    if (blockedCitationBots.length >= CITATION_BOTS.length) {
      return fail(
        'geo-ai-bot-access',
        `All ${CITATION_BOTS.length} AI answer engines are blocked in robots.txt - this site cannot be cited in AI-generated answers`,
        {
          ...details,
          recommendation:
            'Allow the answer-engine crawlers (OAI-SearchBot, PerplexityBot, ClaudeBot, Google-Extended) to appear in AI answers. Training crawlers such as GPTBot can stay blocked if that is your policy.',
        }
      );
    }

    if (blockedCitationBots.length > 0) {
      return warn(
        'geo-ai-bot-access',
        `${blockedCitationBots.length} AI answer engine(s) blocked in robots.txt: ${blockedCitationBots.join(', ')}`,
        {
          ...details,
          recommendation:
            'These crawlers fetch pages to answer user questions and can cite you. Blocking them removes this site from those answers.',
        }
      );
    }

    // Only training crawlers blocked - a deliberate policy, not an SEO defect.
    return pass(
      'geo-ai-bot-access',
      `Answer-engine crawlers are allowed; ${blockedTrainingBots.length} training-only crawler(s) blocked: ${blockedTrainingBots.join(', ')}`,
      {
        ...details,
        note: 'Blocking training-only crawlers does not affect visibility in AI answers.',
      }
    );
  },
});
