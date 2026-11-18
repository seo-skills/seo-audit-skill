import type { AuditContext } from '../../types.js';
import { defineRule, notMeasured, pass, warn } from '../define-rule.js';

interface CanonicalForm {
  protocol: string;
  host: string;
  slash: boolean;
}

function formOf(canonical: string): CanonicalForm | null {
  try {
    const url = new URL(canonical);
    return {
      protocol: url.protocol,
      host: url.hostname.replace(/^www\./i, ''),
      slash: url.pathname.length > 1 && url.pathname.endsWith('/'),
    };
  } catch {
    return null;
  }
}

/**
 * Rule: Canonical form drift
 *
 * Half the site canonicalising to www and half to the apex, or mixing
 * http with https, or mixing trailing slashes, splits the site into two
 * identities. The homepage path is not counted as a trailing-slash choice.
 */
export const canonicalFormDriftRule = defineRule({
  id: 'crawl-canonical-form-drift',
  name: 'Canonical Form Drift',
  description: 'Checks that crawled canonicals agree on www, scheme, and trailing slash',
  category: 'crawl',
  weight: 6,
  run: (context: AuditContext) => {
    const pages = context.site?.pages;
    if (!pages || (context.site?.pageCount ?? 0) < 2) {
      return notMeasured(
        'crawl-canonical-form-drift',
        'Canonical form comparison needs a crawl of at least two pages — run with --crawl', undefined, 'needs-crawl'
      );
    }

    const forms: CanonicalForm[] = [];
    for (const info of pages.values()) {
      if (typeof info.canonical !== 'string') continue;
      const form = formOf(info.canonical);
      if (form) forms.push(form);
    }

    if (forms.length < 2) {
      return pass('crawl-canonical-form-drift', 'Fewer than two canonicals to compare', {
        canonicals: forms.length,
      });
    }

    const issues: string[] = [];
    const protocols = new Set(forms.map((form) => form.protocol));
    if (protocols.size > 1) issues.push(`schemes ${[...protocols].join(' and ')}`);

    const hosts = new Set<string>();
    let sawWww = false;
    let sawApex = false;
    for (const info of pages.values()) {
      if (typeof info.canonical !== 'string') continue;
      try {
        const host = new URL(info.canonical).hostname.toLowerCase();
        hosts.add(host.replace(/^www\./, ''));
        if (host.startsWith('www.')) sawWww = true;
        else sawApex = true;
      } catch {
        // formOf already skipped unparseable values
      }
    }
    if (sawWww && sawApex) issues.push('www and apex hosts');
    if (hosts.size > 1) issues.push(`hostnames ${[...hosts].join(', ')}`);

    const slashes = new Set(forms.map((form) => form.slash));
    if (slashes.size > 1) issues.push('trailing-slash and no-trailing-slash paths');

    if (issues.length === 0) {
      return pass('crawl-canonical-form-drift', 'Canonicals use one host, scheme, and slash form', {
        canonicals: forms.length,
      });
    }

    return warn('crawl-canonical-form-drift', `Canonicals disagree on ${issues.join('; ')}`, {
      canonicals: forms.length,
      issues,
      recommendation:
        'Pick one canonical form — https, one host, and one trailing-slash rule — and use it on every page.',
    });
  },
});
