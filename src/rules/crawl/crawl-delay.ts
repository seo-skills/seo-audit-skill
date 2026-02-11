import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Threshold in seconds above which crawl-delay is considered excessive
 */
const EXCESSIVE_DELAY_THRESHOLD = 10;

/**
 * Parse Crawl-delay value from robots.txt content for relevant user-agents
 */
function parseCrawlDelay(content: string): { delay: number | null; userAgent: string | null } {
  const lines = content.split('\n').map((line) => line.trim());

  let inRelevantUserAgent = false;
  let sawAnyUserAgent = false;
  let currentUserAgent: string | null = null;

  for (const line of lines) {
    if (line.startsWith('#') || !line) {
      continue;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const directive = line.substring(0, colonIndex).trim().toLowerCase();
    const value = line.substring(colonIndex + 1).trim();

    if (directive === 'user-agent') {
      sawAnyUserAgent = true;
      const isRelevant =
        value === '*' ||
        value.toLowerCase().includes('googlebot') ||
        value.toLowerCase().includes('bingbot');
      if (isRelevant) {
        inRelevantUserAgent = true;
        currentUserAgent = value;
      } else {
        inRelevantUserAgent = false;
      }
    } else if ((inRelevantUserAgent || !sawAnyUserAgent) && directive === 'crawl-delay') {
      const delay = parseFloat(value);
      if (!isNaN(delay) && delay >= 0) {
        return { delay, userAgent: currentUserAgent || '*' };
      }
    }
  }

  return { delay: null, userAgent: null };
}

/**
 * Rule: Crawl Delay
 *
 * Checks for a Crawl-delay directive in robots.txt. While Google ignores
 * this directive, Bing and other engines honor it. Excessive crawl-delay
 * values can significantly slow down how quickly search engines discover
 * and index new content.
 */
export const crawlDelayRule = defineRule({
  id: 'crawl-crawl-delay',
  name: 'Crawl Delay',
  description: 'Checks for Crawl-delay directive in robots.txt',
  category: 'crawl',
  weight: 5,
  run: async (context: AuditContext) => {
    const robotsTxtContent = (context as any).robotsTxtContent as string | undefined;

    if (!robotsTxtContent) {
      return pass(
        'crawl-crawl-delay',
        'No robots.txt content available to check',
        { robotsTxtAvailable: false }
      );
    }

    const { delay, userAgent } = parseCrawlDelay(robotsTxtContent);

    if (delay === null) {
      return pass(
        'crawl-crawl-delay',
        'No Crawl-delay directive found in robots.txt',
        { hasCrawlDelay: false }
      );
    }

    const details = {
      crawlDelay: delay,
      userAgent,
      thresholdSeconds: EXCESSIVE_DELAY_THRESHOLD,
    };

    if (delay > EXCESSIVE_DELAY_THRESHOLD) {
      return warn(
        'crawl-crawl-delay',
        `Crawl-delay is ${delay} seconds (excessive for user-agent: ${userAgent})`,
        {
          ...details,
          impact: 'High crawl-delay slows down content discovery and indexing by search engines',
          recommendation: `Reduce Crawl-delay to 1-${EXCESSIVE_DELAY_THRESHOLD} seconds or remove it; Google ignores this directive`,
        }
      );
    }

    return pass(
      'crawl-crawl-delay',
      `Crawl-delay is ${delay} second(s) for user-agent: ${userAgent} (reasonable)`,
      details
    );
  },
});
