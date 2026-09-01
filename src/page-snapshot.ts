import type { AuditContext, PageSnapshot, SnapshotHeading } from './types.js';

/** Headings worth showing in an outline; deeper levels add noise, not structure */
const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';

/** Cap the outline so one long documentation page cannot dominate a report */
const MAX_HEADINGS = 60;

/** Trim a value for display without losing what identifies it */
function clean(text: string | undefined, limit = 300): string | undefined {
  const trimmed = text?.replace(/\s+/g, ' ').trim();
  if (!trimmed) return undefined;
  return trimmed.length > limit ? `${trimmed.slice(0, limit - 1)}…` : trimmed;
}

/**
 * Capture the page-level signals a report shows outside any rule result:
 * the heading outline, the search and social previews, and the headline counts.
 *
 * These are read straight from the parsed document rather than recovered from
 * rule details, because a rule's `details` shape is its own concern and is free
 * to change without warning the reporters.
 *
 * @param context - The audit context for the page
 * @returns Snapshot for reporters to render
 */
export function buildPageSnapshot(context: AuditContext): PageSnapshot {
  const { $, html, links, images } = context;

  const meta = (name: string): string | undefined =>
    clean($(`meta[name="${name}"]`).attr('content'));
  const property = (name: string): string | undefined =>
    clean($(`meta[property="${name}"]`).attr('content'));

  const headings: SnapshotHeading[] = [];
  $(HEADING_SELECTOR).each((_, el) => {
    if (headings.length >= MAX_HEADINGS) return;
    const tag = ((el as { tagName?: string }).tagName ?? '').toLowerCase();
    const level = Number(tag.slice(1));
    if (!Number.isFinite(level)) return;
    headings.push({ level, text: clean($(el).text(), 120) ?? '(empty)' });
  });

  // Text-to-HTML ratio uses the body only: <head> markup is never rendered
  // text, so counting it would understate every page equally.
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const words = bodyText ? bodyText.split(' ').length : 0;

  return {
    title: clean($('title').first().text()),
    description: meta('description'),
    canonical: clean($('link[rel="canonical"]').attr('href')),
    og: {
      title: property('og:title'),
      description: property('og:description'),
      image: property('og:image'),
      siteName: property('og:site_name'),
      type: property('og:type'),
    },
    twitterCard: meta('twitter:card'),
    headings,
    metrics: {
      wordCount: words,
      internalLinks: links.filter((l) => l.isInternal).length,
      externalLinks: links.filter((l) => !l.isInternal).length,
      images: images.length,
      textRatio: html.length > 0 ? Math.round((bodyText.length / html.length) * 1000) / 10 : 0,
    },
  };
}
