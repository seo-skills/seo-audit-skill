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
  /** `Crawl-delay` in seconds, when the group declares one */
  crawlDelay?: number;
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

    if (field === 'crawl-delay') {
      if (!current) continue;
      acceptingAgents = false;
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds >= 0) current.crawlDelay = seconds;
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
  /** The governing group's `Crawl-delay`, in seconds, when it declares one */
  readonly crawlDelaySeconds: number | undefined;

  /**
   * @param content - The robots.txt body, or empty when the site has none
   * @param userAgent - The crawler's user-agent string
   */
  constructor(content: string, userAgent: string) {
    const group = RobotsMatcher.selectGroup(parseRobotsTxt(content), userAgent);
    this.rules = group?.rules ?? [];
    this.crawlDelaySeconds = group?.crawlDelay;
  }

  /**
   * The product tokens a user-agent string carries, lower-cased.
   *
   * "SEOmatorBot/3.0 (+https://...)" carries "seomatorbot"; a browser-style
   * string carries one token per `name/version` pair. A string with no
   * version, such as "Googlebot", is its own token.
   */
  static productTokens(userAgent: string): string[] {
    const tokens = [...userAgent.matchAll(/([A-Za-z][A-Za-z0-9_-]*)\//g)].map((m) => m[1].toLowerCase());
    return tokens.length > 0 ? tokens : [userAgent.trim().toLowerCase()];
  }

  /**
   * Pick the group that governs this crawler.
   *
   * A group applies when its user-agent line is the start of one of the
   * crawler's product tokens, case-insensitively: "SEOmator" and
   * "seomatorbot" govern SEOmatorBot, but "bot" does not, which a substring
   * match of the whole user-agent string let through. A named group wins over
   * `*`, and among named groups the longest wins.
   */
  private static selectGroup(groups: RobotsGroup[], userAgent: string): RobotsGroup | null {
    const tokens = RobotsMatcher.productTokens(userAgent);

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
        if (tokens.some((token) => token.startsWith(agent)) && agent.length > bestLength) {
          best = group;
          bestLength = agent.length;
        }
      }
    }

    return best;
  }

  /**
   * Whether the crawler is permitted to fetch this URL.
   *
   * @param url - Absolute URL to test
   * @returns True when fetching is permitted
   */
  isAllowed(url: string): boolean {
    return this.explain(url).allowed;
  }

  /**
   * The decision for a URL, and the pattern of the rule that made it.
   *
   * The longest matching pattern decides; when an Allow and a Disallow match
   * with equal length, Allow wins, which is what the spec requires.
   *
   * @param url - Absolute URL to test
   * @returns Whether fetching is permitted, and the deciding pattern (null when no rule matched)
   */
  explain(url: string): { allowed: boolean; pattern: string | null } {
    if (this.rules.length === 0) return { allowed: true, pattern: null };

    let path: string;
    try {
      const parsed = new URL(url);
      path = parsed.pathname + parsed.search;
    } catch {
      return { allowed: true, pattern: null };
    }

    let decision = true;
    let decidedBy = -1;
    let pattern: string | null = null;

    for (const rule of this.rules) {
      if (!rule.regex.test(path)) continue;
      const specificity = rule.pattern.length;
      if (specificity > decidedBy || (specificity === decidedBy && rule.allow)) {
        decision = rule.allow;
        decidedBy = specificity;
        pattern = rule.pattern;
      }
    }

    return { allowed: decision, pattern: decision ? null : pattern };
  }
}
