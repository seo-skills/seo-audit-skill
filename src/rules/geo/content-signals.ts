import type { AuditContext } from '../../types.js';
import { defineRule, notMeasured, pass, warn } from '../define-rule.js';

/** Keys the Content-Signal draft defines. */
const KNOWN_KEYS = new Set(['search', 'ai-input', 'ai-train']);

/**
 * Training crawlers. Blocking these while declaring ai-train=yes contradicts
 * the policy the file just stated.
 */
const TRAINING_BOTS = ['GPTBot', 'CCBot', 'Google-Extended', 'ClaudeBot', 'Bytespider'];

interface SignalParse {
  present: boolean;
  pairs: Map<string, string>;
  errors: string[];
}

function parseSignals(content: string): SignalParse {
  const pairs = new Map<string, string>();
  const errors: string[] = [];
  let present = false;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.replace(/#.*$/, '').trim();
    const match = /^content-signal:\s*(.*)$/i.exec(line);
    if (!match) continue;
    present = true;
    const body = match[1].trim();
    if (!body) {
      errors.push('empty Content-Signal');
      continue;
    }
    for (const part of body.split(',')) {
      const token = part.trim();
      const kv = /^([a-z0-9-]+)\s*=\s*(yes|no)$/i.exec(token);
      if (!kv) {
        errors.push(token || 'empty token');
        continue;
      }
      const key = kv[1].toLowerCase();
      if (!KNOWN_KEYS.has(key)) errors.push(`unknown key ${key}`);
      else pairs.set(key, kv[2].toLowerCase());
    }
  }

  return { present, pairs, errors };
}

function blockedTrainingBots(content: string): string[] {
  const groups: Array<{ agents: string[]; disallows: string[] }> = [];
  let current: { agents: string[]; disallows: string[] } | null = null;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const agent = /^user-agent:\s*(.+)$/i.exec(line);
    if (agent) {
      if (!current || current.disallows.length > 0) {
        current = { agents: [], disallows: [] };
        groups.push(current);
      }
      current.agents.push(agent[1].trim().toLowerCase());
      continue;
    }
    const disallow = /^disallow:\s*(.*)$/i.exec(line);
    if (disallow && current) current.disallows.push(disallow[1].trim());
  }

  return TRAINING_BOTS.filter((bot) => {
    const name = bot.toLowerCase();
    return groups.some(
      (group) =>
        group.agents.some((agent) => agent === '*' || agent === name) &&
        group.disallows.includes('/')
    );
  });
}

/**
 * Rule: Content-Signal in robots.txt
 *
 * Absence is fine: the directive is optional. A typo, an unknown key, or
 * ai-train=yes next to a blanket disallow of a training crawler is not.
 * Without robots.txt on the context there is nothing to read.
 */
export const contentSignalsRule = defineRule({
  id: 'geo-content-signals',
  name: 'Content-Signal Policy',
  description:
    'Checks robots.txt Content-Signal syntax and contradictions with training-crawler blocks',
  category: 'geo',
  weight: 6,
  run: (context: AuditContext) => {
    if (context.robotsTxtContent === undefined) {
      return notMeasured(
        'geo-content-signals',
        'robots.txt was not fetched, so Content-Signal cannot be checked',
        { reason: 'robotsTxtContent missing' },
        'could-not-verify'
      );
    }

    const parsed = parseSignals(context.robotsTxtContent);
    const blocked = blockedTrainingBots(context.robotsTxtContent);
    const train = parsed.pairs.get('ai-train');
    const contradiction = train === 'yes' && blocked.length > 0;

    const details = {
      present: parsed.present,
      signals: Object.fromEntries(parsed.pairs),
      errors: parsed.errors,
      blockedTrainingBots: blocked,
    };

    if (!parsed.present) {
      return pass('geo-content-signals', 'robots.txt has no Content-Signal directive', details);
    }

    if (parsed.errors.length > 0 || contradiction) {
      const parts = [...parsed.errors];
      if (contradiction) {
        parts.push(`ai-train=yes while ${blocked.join(', ')} ${blocked.length === 1 ? 'is' : 'are'} disallowed`);
      }
      return warn('geo-content-signals', `Content-Signal problem: ${parts.join('; ')}`, {
        ...details,
        recommendation:
          'Use search, ai-input, and ai-train with yes or no. If training crawlers are disallowed, set ai-train=no.',
      });
    }

    return pass('geo-content-signals', 'Content-Signal directive is consistent', details);
  },
});
