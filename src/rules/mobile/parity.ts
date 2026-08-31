import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { extractMainContent, countWords } from '../content/utils/text-extractor.js';
import { parityInputs, firstText, firstAttr } from './utils/parity.js';

/**
 * Mobile-first parity rules.
 *
 * Google indexes the mobile version of a page. When the mobile render drops
 * content, structured data, links, or changes the title or canonical, the
 * indexed page is the weaker one — a ranking risk invisible to a desktop-only
 * audit. Each rule renders both viewports and flags where they diverge.
 */

/**
 * Rule: Mobile Content Parity
 *
 * The flagship parity check. If the mobile page carries substantially less body
 * text than desktop, Google indexes the thinner version. Common causes: content
 * behind "read more" that only expands on desktop, or components that render
 * empty on mobile.
 */
export const mobileParityContentRule = defineRule({
  id: 'mobile-parity-content',
  name: 'Mobile Content Parity',
  description: 'Checks that the mobile render contains as much body content as desktop',
  category: 'mobile',
  weight: 10,
  run: (context: AuditContext) => {
    const inputs = parityInputs('mobile-parity-content', context);
    if (!inputs.available) return inputs.result;

    const desktopWords = countWords(extractMainContent(inputs.desktop));
    const mobileWords = countWords(extractMainContent(inputs.mobile));

    // Ratio of mobile to desktop content. Below 1 means the phone sees less.
    const ratio = desktopWords > 0 ? mobileWords / desktopWords : 1;
    const details = {
      desktopWords,
      mobileWords,
      ratio: Number(ratio.toFixed(2)),
      missingWords: Math.max(0, desktopWords - mobileWords),
    };

    // Very short pages are noisy; don't judge parity on a handful of words.
    if (desktopWords < 100) {
      return pass('mobile-parity-content', 'Too little content to assess parity', details);
    }

    if (ratio < 0.5) {
      return fail(
        'mobile-parity-content',
        `Mobile shows ${mobileWords} words vs ${desktopWords} on desktop (${Math.round(ratio * 100)}%) - Google indexes the mobile version`,
        {
          ...details,
          impact:
            'Under mobile-first indexing, the thinner mobile page is what gets indexed and ranked. Content hidden from mobile is effectively invisible to search.',
        }
      );
    }

    if (ratio < 0.8) {
      return warn(
        'mobile-parity-content',
        `Mobile shows ${Math.round(ratio * 100)}% of the desktop content (${mobileWords} vs ${desktopWords} words)`,
        details
      );
    }

    return pass(
      'mobile-parity-content',
      `Mobile and desktop content are in parity (${mobileWords} vs ${desktopWords} words)`,
      details
    );
  },
});

/**
 * Rule: Mobile Title & Description Parity
 *
 * The title and meta description are top-tier signals. If they differ between
 * mobile and desktop, the SERP snippet Google builds comes from the mobile one.
 */
export const mobileParityTitleRule = defineRule({
  id: 'mobile-parity-title',
  name: 'Mobile Title & Description Parity',
  description: 'Checks that the title and meta description match between mobile and desktop',
  category: 'mobile',
  weight: 8,
  run: (context: AuditContext) => {
    const inputs = parityInputs('mobile-parity-title', context);
    if (!inputs.available) return inputs.result;

    const desktopTitle = firstText(inputs.desktop, 'title');
    const mobileTitle = firstText(inputs.mobile, 'title');
    const desktopDesc = firstAttr(inputs.desktop, 'meta[name="description"]', 'content');
    const mobileDesc = firstAttr(inputs.mobile, 'meta[name="description"]', 'content');

    const titleMatches = desktopTitle === mobileTitle;
    const descMatches = desktopDesc === mobileDesc;
    const details = {
      titleMatches,
      descMatches,
      desktopTitle,
      mobileTitle,
      desktopDescription: desktopDesc,
      mobileDescription: mobileDesc,
    };

    if (!titleMatches) {
      return fail(
        'mobile-parity-title',
        `Title differs between mobile and desktop - mobile: "${mobileTitle}" vs desktop: "${desktopTitle}"`,
        details
      );
    }

    if (!descMatches) {
      return warn(
        'mobile-parity-title',
        'Meta description differs between mobile and desktop renders',
        details
      );
    }

    return pass('mobile-parity-title', 'Title and description match on mobile and desktop', details);
  },
});

/**
 * Rule: Mobile Canonical Parity
 *
 * A mobile canonical pointing somewhere other than the desktop canonical can
 * split or misattribute indexing. Under mobile-first, the mobile canonical wins.
 */
export const mobileParityCanonicalRule = defineRule({
  id: 'mobile-parity-canonical',
  name: 'Mobile Canonical Parity',
  description: 'Checks that the canonical URL matches between mobile and desktop',
  category: 'mobile',
  weight: 8,
  run: (context: AuditContext) => {
    const inputs = parityInputs('mobile-parity-canonical', context);
    if (!inputs.available) return inputs.result;

    const desktopCanonical = firstAttr(inputs.desktop, 'link[rel="canonical"]', 'href');
    const mobileCanonical = firstAttr(inputs.mobile, 'link[rel="canonical"]', 'href');
    const details = { desktopCanonical, mobileCanonical };

    if (desktopCanonical !== mobileCanonical) {
      return fail(
        'mobile-parity-canonical',
        `Canonical differs - mobile: "${mobileCanonical || '(none)'}" vs desktop: "${desktopCanonical || '(none)'}"`,
        {
          ...details,
          impact:
            'Google uses the mobile canonical. A mismatch can point indexing at the wrong URL or undo a deliberate canonical.',
        }
      );
    }

    return pass(
      'mobile-parity-canonical',
      'Canonical URL matches on mobile and desktop',
      details
    );
  },
});

/**
 * Rule: Mobile Structured Data Parity
 *
 * Rich results are generated from the mobile page's structured data. If a
 * JSON-LD block present on desktop is missing on mobile, the rich result is
 * lost even though a desktop audit looks fine.
 */
export const mobileParityStructuredDataRule = defineRule({
  id: 'mobile-parity-structured-data',
  name: 'Mobile Structured Data Parity',
  description: 'Checks that JSON-LD structured data is present on mobile as well as desktop',
  category: 'mobile',
  weight: 8,
  run: (context: AuditContext) => {
    const inputs = parityInputs('mobile-parity-structured-data', context);
    if (!inputs.available) return inputs.result;

    const desktopBlocks = inputs.desktop('script[type="application/ld+json"]').length;
    const mobileBlocks = inputs.mobile('script[type="application/ld+json"]').length;
    const details = { desktopBlocks, mobileBlocks };

    if (desktopBlocks > 0 && mobileBlocks < desktopBlocks) {
      return fail(
        'mobile-parity-structured-data',
        `Mobile has ${mobileBlocks} JSON-LD block(s) vs ${desktopBlocks} on desktop - rich results are built from the mobile page`,
        {
          ...details,
          impact:
            'Structured data missing from the mobile render will not produce rich results, regardless of what desktop carries.',
        }
      );
    }

    if (desktopBlocks === 0 && mobileBlocks === 0) {
      return pass('mobile-parity-structured-data', 'No structured data on either render', details);
    }

    return pass(
      'mobile-parity-structured-data',
      `Structured data present on mobile (${mobileBlocks} block(s)) matches desktop`,
      details
    );
  },
});

/**
 * Rule: Mobile Internal Link Parity
 *
 * Internal links carry ranking signal and are how crawlers discover pages. A
 * mobile page that exposes far fewer links than desktop leaks that signal and
 * can leave pages undiscovered, since crawling follows the mobile render.
 */
export const mobileParityLinksRule = defineRule({
  id: 'mobile-parity-links',
  name: 'Mobile Internal Link Parity',
  description: 'Checks that mobile exposes a comparable number of internal links to desktop',
  category: 'mobile',
  weight: 6,
  run: (context: AuditContext) => {
    const inputs = parityInputs('mobile-parity-links', context);
    if (!inputs.available) return inputs.result;

    const count = ($: typeof inputs.desktop) =>
      $('a[href]').filter((_, el) => {
        const href = $(el).attr('href') ?? '';
        return href.length > 0 && !href.startsWith('#') && !href.startsWith('javascript:');
      }).length;

    const desktopLinks = count(inputs.desktop);
    const mobileLinks = count(inputs.mobile);
    const ratio = desktopLinks > 0 ? mobileLinks / desktopLinks : 1;
    const details = {
      desktopLinks,
      mobileLinks,
      ratio: Number(ratio.toFixed(2)),
      missingLinks: Math.max(0, desktopLinks - mobileLinks),
    };

    // A handful of links is too few to judge.
    if (desktopLinks < 10) {
      return pass('mobile-parity-links', 'Too few links to assess parity', details);
    }

    if (ratio < 0.5) {
      return warn(
        'mobile-parity-links',
        `Mobile exposes ${mobileLinks} links vs ${desktopLinks} on desktop (${Math.round(ratio * 100)}%)`,
        {
          ...details,
          recommendation:
            'Ensure navigation and in-content links render on mobile - hiding them behind a collapsed menu is fine, but they must be in the DOM.',
        }
      );
    }

    return pass(
      'mobile-parity-links',
      `Mobile and desktop expose a comparable number of links (${mobileLinks} vs ${desktopLinks})`,
      details
    );
  },
});
