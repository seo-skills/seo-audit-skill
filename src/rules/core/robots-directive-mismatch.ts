import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { parseRobotsDirectives } from './robots-meta.js';

// Reference hints: indexability/mismatched-noindex-directives-in-html-and-header,
// indexability/mismatched-nofollow-directives-in-html-and-header,
// indexability/multiple-noindex-directives,
// indexability/multiple-nofollow-directives,
// indexability/noindex-in-html-and-http-header,
// indexability/nofollow-in-html-and-http-header

/** Directive presence distilled from one declaration location */
interface DirectiveFlags {
  noindex: boolean;
  index: boolean;
  nofollow: boolean;
  follow: boolean;
}

/**
 * Reduce parsed directive tokens to the four index/follow flags, expanding
 * the shorthands: `none` means noindex + nofollow, `all` means index + follow.
 */
function summarizeDirectives(tokens: string[]): DirectiveFlags {
  const expanded = tokens.flatMap((t) =>
    t === 'none' ? ['noindex', 'nofollow'] : t === 'all' ? ['index', 'follow'] : [t]
  );
  return {
    noindex: expanded.includes('noindex'),
    index: expanded.includes('index'),
    nofollow: expanded.includes('nofollow'),
    follow: expanded.includes('follow'),
  };
}

/**
 * Extract the general (non bot-specific) directives from an X-Robots-Tag
 * header value. Bot-prefixed segments such as "googlebot: noindex" are
 * targeted overrides, not page-wide directives, so they are dropped before
 * comparing against the HTML meta robots tag.
 */
function parseHeaderDirectives(headerValue: string): string[] {
  const segments = headerValue
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^[a-z0-9_*-]+:/i.test(s));
  return parseRobotsDirectives(segments.join(','));
}

/**
 * Rule: Robots directive consistency between HTML and HTTP header
 *
 * Compares index/follow directives from meta robots tags against the
 * X-Robots-Tag response header. Flags:
 * - mismatches, where one location declares index/follow and the other
 *   declares noindex/nofollow (search engines apply the most restrictive);
 * - duplicated declarations, where noindex or nofollow is declared in more
 *   than one location (multiple meta robots tags, or both HTML and header).
 */
export const robotsDirectiveMismatchRule = defineRule({
  id: 'core-robots-directive-mismatch',
  name: 'Robots Directive Mismatch',
  description: 'Checks that robots directives in meta tags and the X-Robots-Tag header are consistent and not duplicated',
  category: 'core',
  weight: 5,
  run: async (context: AuditContext) => {
    const { $, headers } = context;

    // Each meta robots tag is one HTML declaration location
    const htmlDeclarations: DirectiveFlags[] = [];
    $('meta[name="robots"]').each((_, el) => {
      const content = $(el).attr('content') || '';
      htmlDeclarations.push(summarizeDirectives(parseRobotsDirectives(content)));
    });

    const html: DirectiveFlags = {
      noindex: htmlDeclarations.some((d) => d.noindex),
      index: htmlDeclarations.some((d) => d.index),
      nofollow: htmlDeclarations.some((d) => d.nofollow),
      follow: htmlDeclarations.some((d) => d.follow),
    };
    const htmlNoindexCount = htmlDeclarations.filter((d) => d.noindex).length;
    const htmlNofollowCount = htmlDeclarations.filter((d) => d.nofollow).length;

    // The X-Robots-Tag header is a single declaration location
    const headerValue = headers['x-robots-tag'] || headers['X-Robots-Tag'] || '';
    const header: DirectiveFlags | null = headerValue
      ? summarizeDirectives(parseHeaderDirectives(headerValue))
      : null;

    const noindexLocations = htmlNoindexCount + (header?.noindex ? 1 : 0);
    const nofollowLocations = htmlNofollowCount + (header?.nofollow ? 1 : 0);

    if (htmlDeclarations.length === 0 && !header) {
      return pass(
        'core-robots-directive-mismatch',
        'No robots directives declared in HTML or HTTP header',
        { htmlDeclarations: 0, header: null }
      );
    }

    // Mismatches: one location explicitly allows what the other forbids
    const mismatches: string[] = [];
    if (header) {
      if ((html.noindex && header.index && !header.noindex) || (header.noindex && html.index && !html.noindex)) {
        mismatches.push('noindex');
      }
      if ((html.nofollow && header.follow && !header.nofollow) || (header.nofollow && html.follow && !html.nofollow)) {
        mismatches.push('nofollow');
      }
    }

    if (mismatches.length > 0) {
      return fail(
        'core-robots-directive-mismatch',
        `Conflicting robots directives between HTML and X-Robots-Tag header: ${mismatches.join(', ')}`,
        {
          mismatches,
          htmlDeclarations,
          header,
          impact: 'Conflicting directives resolve to the most restrictive option, so the page may stay noindexed or nofollowed despite the permissive declaration',
          recommendation: 'Declare robots directives in one location only and make them agree',
        }
      );
    }

    // Duplicated declarations of the same restrictive directive
    const duplicates: string[] = [];
    if (noindexLocations > 1) {
      duplicates.push(`noindex declared in ${noindexLocations} locations`);
    }
    if (nofollowLocations > 1) {
      duplicates.push(`nofollow declared in ${nofollowLocations} locations`);
    }

    if (duplicates.length > 0) {
      return warn(
        'core-robots-directive-mismatch',
        `Robots directives declared multiple times: ${duplicates.join('; ')}`,
        {
          duplicates,
          htmlDeclarations,
          header,
          impact: 'Duplicated directives agree today but make future configuration errors likely',
          recommendation: 'Declare each robots directive once, in either the HTML or the HTTP header',
        }
      );
    }

    return pass(
      'core-robots-directive-mismatch',
      'Robots directives are consistent between HTML and HTTP header',
      { htmlDeclarations, header }
    );
  },
});
