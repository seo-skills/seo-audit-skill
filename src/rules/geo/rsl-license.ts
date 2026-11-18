import type { AuditContext } from '../../types.js';
import { defineRule, notMeasured, pass, warn } from '../define-rule.js';
import { looksLikeHtml, probeOnce } from './probe.js';

function licenseUrls(robots: string, pageUrl: string): string[] {
  const urls: string[] = [];
  for (const raw of robots.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    const match = /^license:\s*(\S+)/i.exec(line);
    if (!match) continue;
    try {
      urls.push(new URL(match[1], pageUrl).href);
    } catch {
      urls.push(match[1]);
    }
  }
  return urls;
}

function looksLikeLicense(body: string): boolean {
  return /rsl|license|permits|prohibitions|usage/i.test(body);
}

/**
 * Rule: robots.txt License target
 *
 * Absence of a License line is fine. A line whose target does not resolve,
 * or resolves to HTML, is a broken declaration.
 */
export const rslLicenseRule = defineRule({
  id: 'geo-rsl-license',
  name: 'Robots License Target',
  description: 'Checks that a robots.txt License URL resolves to a license document',
  category: 'geo',
  weight: 4,
  run: async (context: AuditContext) => {
    if (context.robotsTxtContent === undefined) {
      return notMeasured(
        'geo-rsl-license',
        'robots.txt was not fetched, so a License directive cannot be checked',
        undefined,
        'could-not-verify'
      );
    }

    const urls = licenseUrls(context.robotsTxtContent, context.url);
    if (urls.length === 0) {
      return pass('geo-rsl-license', 'robots.txt has no License directive', { urls: [] });
    }

    const broken: string[] = [];
    for (const url of urls) {
      const result = await probeOnce(context, url, {});
      if (!result || result.status !== 200 || looksLikeHtml(result) || !looksLikeLicense(result.body)) {
        broken.push(url);
      }
    }

    if (broken.length === 0) {
      return pass('geo-rsl-license', 'License target resolves', { urls });
    }

    return warn('geo-rsl-license', `License target did not resolve as a license document: ${broken.join(', ')}`, {
      urls,
      broken,
      recommendation: 'Point License: at a document that returns 200 and describes the license, not an HTML page.',
    });
  },
});
