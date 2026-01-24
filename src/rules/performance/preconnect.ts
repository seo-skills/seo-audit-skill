import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Known critical third-party origins that benefit from preconnect
 */
const CRITICAL_ORIGINS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'www.google-analytics.com',
  'www.googletagmanager.com',
  'connect.facebook.net',
  'platform.twitter.com',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'unpkg.com',
  'ajax.googleapis.com',
];

interface PreconnectAnalysis {
  preconnects: string[];
  dnsPrefetches: string[];
  thirdPartyOrigins: string[];
  missingPreconnects: string[];
}

/**
 * Extract origin from URL
 */
function extractOrigin(url: string): string | null {
  try {
    const parsed = new URL(url, 'https://example.com');
    if (parsed.hostname === 'example.com') return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Analyze preconnect hints on the page
 */
function analyzePreconnects($: AuditContext['$'], pageUrl: string): PreconnectAnalysis {
  const preconnects: string[] = [];
  const dnsPrefetches: string[] = [];
  const thirdPartyOrigins = new Set<string>();

  // Get page origin for comparison
  let pageOrigin: string;
  try {
    pageOrigin = new URL(pageUrl).origin;
  } catch {
    pageOrigin = '';
  }

  // Collect existing preconnects
  $('link[rel="preconnect"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      try {
        const origin = new URL(href).origin;
        preconnects.push(origin);
      } catch {
        preconnects.push(href);
      }
    }
  });

  // Collect existing dns-prefetch
  $('link[rel="dns-prefetch"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      dnsPrefetches.push(href.replace(/^\/\//, 'https://'));
    }
  });

  // Find third-party origins from various resources
  const collectOrigins = (selector: string, attr: string) => {
    $(selector).each((_, el) => {
      const url = $(el).attr(attr);
      if (url) {
        const origin = extractOrigin(url);
        if (origin && origin !== pageOrigin) {
          thirdPartyOrigins.add(origin);
        }
      }
    });
  };

  // Scripts
  collectOrigins('script[src]', 'src');
  // Images
  collectOrigins('img[src]', 'src');
  // Stylesheets
  collectOrigins('link[rel="stylesheet"]', 'href');
  // Iframes
  collectOrigins('iframe[src]', 'src');

  // Find missing preconnects for critical origins
  const existingHints = new Set([
    ...preconnects,
    ...dnsPrefetches.map((d) => {
      try {
        return new URL(d).origin;
      } catch {
        return d;
      }
    }),
  ]);

  const missingPreconnects: string[] = [];
  for (const origin of thirdPartyOrigins) {
    // Check if it's a critical origin that should have preconnect
    const hostname = new URL(origin).hostname;
    const isCritical = CRITICAL_ORIGINS.some(
      (critical) => hostname === critical || hostname.endsWith(`.${critical}`)
    );

    if (isCritical && !existingHints.has(origin)) {
      missingPreconnects.push(origin);
    }
  }

  return {
    preconnects,
    dnsPrefetches,
    thirdPartyOrigins: Array.from(thirdPartyOrigins),
    missingPreconnects,
  };
}

/**
 * Rule: Check for preconnect hints to critical third-party origins
 *
 * Preconnect hints tell the browser to establish early connections
 * to third-party origins, reducing latency for critical resources.
 * Priority origins: fonts, analytics, CDNs
 */
export const preconnectRule = defineRule({
  id: 'perf-preconnect',
  name: 'Preconnect Hints',
  description: 'Checks for preconnect hints to critical third-party origins',
  category: 'performance',
  weight: 15,
  run: (context: AuditContext) => {
    const { $, url } = context;
    const analysis = analyzePreconnects($, url);

    const details = {
      preconnects: analysis.preconnects,
      dnsPrefetches: analysis.dnsPrefetches,
      thirdPartyOrigins: analysis.thirdPartyOrigins.slice(0, 10),
      missingPreconnects: analysis.missingPreconnects,
      criticalOrigins: CRITICAL_ORIGINS,
    };

    // No third-party resources
    if (analysis.thirdPartyOrigins.length === 0) {
      return pass('perf-preconnect', 'No third-party origins detected', details);
    }

    // Check for missing preconnects
    if (analysis.missingPreconnects.length > 0) {
      const missing = analysis.missingPreconnects.slice(0, 5);
      return warn(
        'perf-preconnect',
        `Missing preconnect for ${analysis.missingPreconnects.length} critical origin(s): ${missing.join(', ')}`,
        details
      );
    }

    // All critical origins have preconnect/dns-prefetch
    const hintCount = analysis.preconnects.length + analysis.dnsPrefetches.length;
    if (hintCount > 0) {
      return pass(
        'perf-preconnect',
        `Preconnect hints configured (${hintCount} origin(s))`,
        details
      );
    }

    // No critical origins used, but has third-party resources
    return pass(
      'perf-preconnect',
      `${analysis.thirdPartyOrigins.length} third-party origin(s) detected (no critical origins requiring preconnect)`,
      details
    );
  },
});
