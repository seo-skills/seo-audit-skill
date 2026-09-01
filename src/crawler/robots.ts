/**
 * robots.txt parsing and path matching, following RFC 9309.
 *
 * The crawler used to ignore robots.txt entirely: `respect_robots` was declared
 * in the config schema, defaulted to true, validated, and read by nothing. A
 * crawl would happily fetch paths the site had asked crawlers to stay out of.
 */

/** One Allow or Disallow rule within a group. */
interface RobotsRule {
  /** True for Allow, false for Disallow */
  allow: boolean;
  /** The raw path pattern, which may contain * and $ */
  pattern: string;
  /** Compiled matcher for the pattern */
  regex: RegExp;
}

/** A group of rules that applies to one or more user-agents. */
interface RobotsGroup {
  /** Lower-cased user-agent tokens this group applies to */
  agents: string[];
  rules: RobotsRule[];
}

/**
 * Convert a robots.txt path pattern into a regular expression.
 *
 * `*` matches any run of characters and `$` at the end anchors the match.
 * Everything else is escaped, so a pattern like `/search?q=` is treated
 * literally rather than as regex syntax.
 *
 * @param pattern - The raw path pattern from an Allow/Disallow line
 * @returns A regex anchored at the start of the path
 */
function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;

  const source = body
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');

  return new RegExp(`^${source}${anchored ? '$' : ''}`);
}

/**
 * Parse a robots.txt body into its user-agent groups.
 *
 * @param content - The robots.txt body
 * @returns The groups it declares, in file order
 */
export function parseRobotsTxt(content: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  // Consecutive User-agent lines share one group; a rule line ends the run.
  let acceptingAgents = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.split('#')[0]!.trim();
    if (!line) continue;

    const sep = line.indexOf(':');
    if (sep === -1) continue;

    const field = line.slice(0, sep).trim().toLowerCase();
    const value = line.slice(sep + 1).trim();

    if (field === 'user-agent') {
      if (!current || !acceptingAgents) {
        current = { agents: [], rules: [] };
        groups.push(current);
        acceptingAgents = true;
      }
      current.agents.push(value.toLowerCase());
      continue;
    }

    if (field !== 'allow' && field !== 'disallow') continue;
    if (!current) continue;

    acceptingAgents = false;

    // "Disallow:" with an empty value permits everything and carries no rule.
    if (field === 'disallow' && value === '') continue;
    if (value === '') continue;

    current.rules.push({
      allow: field === 'allow',
      pattern: value,
      regex: patternToRegex(value),
    });
  }

  return groups;
}

/**
 * Decides whether a path may be fetched, for one user-agent.
 *
 * Built once per crawl from the site's robots.txt.
 */
export class RobotsMatcher {
  private readonly rules: RobotsRule[];

  /**
   * @param content - The robots.txt body, or empty when the site has none
   * @param userAgent - The crawler's user-agent string
   */
  constructor(content: string, userAgent: string) {
    this.rules = RobotsMatcher.selectGroup(parseRobotsTxt(content), userAgent);
  }

  /**
   * Pick the group that governs this crawler.
   *
   * A group naming the agent wins over the `*` group, and among named groups
   * the longest token wins, so "seomator-bot" beats a bare "seomator".
   */
  private static selectGroup(groups: RobotsGroup[], userAgent: string): RobotsRule[] {
    const ua = userAgent.toLowerCase();

    let best: RobotsGroup | null = null;
    let bestLength = -1;

    for (const group of groups) {
      for (const agent of group.agents) {
        if (agent === '*') {
          if (bestLength < 0) {
            best = group;
            bestLength = 0;
          }
          continue;
        }
        if (ua.includes(agent) && agent.length > bestLength) {
          best = group;
          bestLength = agent.length;
        }
      }
    }

    return best?.rules ?? [];
  }

  /**
   * Whether the crawler is permitted to fetch this URL.
   *
   * The longest matching pattern decides; when an Allow and a Disallow match
   * with equal length, Allow wins, which is what the spec requires.
   *
   * @param url - Absolute URL to test
   * @returns True when fetching is permitted
   */
  isAllowed(url: string): boolean {
    if (this.rules.length === 0) return true;

    let path: string;
    try {
      const parsed = new URL(url);
      path = parsed.pathname + parsed.search;
    } catch {
      return true;
    }

    let decision = true;
    let decidedBy = -1;

    for (const rule of this.rules) {
      if (!rule.regex.test(path)) continue;
      const specificity = rule.pattern.length;
      if (specificity > decidedBy || (specificity === decidedBy && rule.allow)) {
        decision = rule.allow;
        decidedBy = specificity;
      }
    }

    return decision;
  }
}
