/**
 * Indexing directive coverage and canonical fragments.
 */
import { describe, it, expect } from 'vitest';
import { createTestContext } from '../test-context.js';
import { unavailableAfterRule, parseUnavailableAfter, unavailableAfterValues } from './unavailable-after.js';
import { obsoleteRobotsDirectivesRule } from './obsolete-robots-directives.js';
import { canonicalFragmentRule } from './canonical-fragment.js';

/** The run's clock for every test: 2026-11-17 12:00 UTC */
const NOW = Date.UTC(2026, 10, 17, 12);

function page(head: string, headers: Record<string, string> = {}) {
  const context = createTestContext(`<html><head>${head}</head><body></body></html>`, { url: 'https://example.com/a', headers });
  context.now = NOW;
  return context;
}

describe('unavailable_after dates', () => {
  it('reads the three formats Google documents', () => {
    expect(parseUnavailableAfter('2026-06-25')).toBe(Date.UTC(2026, 5, 25));
    expect(parseUnavailableAfter('2026-06-25T15:00:00Z')).toBe(Date.UTC(2026, 5, 25, 15));
    expect(parseUnavailableAfter('Thu, 25 Jun 2026 15:00:00 PST')).toBe(Date.UTC(2026, 5, 25, 23));
    expect(parseUnavailableAfter('Thursday, 25-Jun-26 15:00:00 PST')).toBe(Date.UTC(2026, 5, 25, 23));
    expect(parseUnavailableAfter('25 Jun 2026 15:00:00 +0200')).toBe(Date.UTC(2026, 5, 25, 13));
    expect(parseUnavailableAfter('next tuesday')).toBeNull();
  });

  it('keeps the comma inside an RFC 822 date', () => {
    expect(unavailableAfterValues('noarchive, unavailable_after: Thu, 25 Jun 2026 15:00:00 PST, nosnippet')).toEqual([
      'Thu, 25 Jun 2026 15:00:00 PST',
    ]);
  });

  it('fails a past date, from a meta tag', async () => {
    const result = await unavailableAfterRule.run(page('<meta name="robots" content="unavailable_after: 2026-01-01">'));
    expect(result.status).toBe('fail');
  });

  it('warns a date within 30 days, from the header', async () => {
    const result = await unavailableAfterRule.run(page('', { 'x-robots-tag': 'unavailable_after: 2026-12-01' }));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('day(s) away');
  });

  it('passes a later date and shows it', async () => {
    const result = await unavailableAfterRule.run(page('<meta name="googlebot" content="unavailable_after: 2027-06-01">'));
    expect(result.status).toBe('pass');
    expect(result.details).toMatchObject({ earliest: '2027-06-01T00:00:00.000Z' });
  });

  it('warns a date it cannot read', async () => {
    const result = await unavailableAfterRule.run(page('<meta name="robots" content="unavailable_after: soon">'));
    expect(result.status).toBe('warn');
    expect(result.details).toMatchObject({ unparseable: ['soon'] });
  });

  it('reads a googlebot-scoped header, and ignores one for another crawler', async () => {
    const google = await unavailableAfterRule.run(page('', { 'x-robots-tag': 'googlebot: unavailable_after: 2026-01-01' }));
    expect(google.status).toBe('fail');
    const bing = await unavailableAfterRule.run(page('', { 'x-robots-tag': 'bingbot: unavailable_after: 2026-01-01' }));
    expect(bing.status).toBe('not-measured');
  });

  it('is not measured when the page declares none', async () => {
    expect(await unavailableAfterRule.run(page('<meta name="robots" content="index, follow">'))).toMatchObject({
      status: 'not-measured',
      reason: 'not-applicable',
    });
  });

  it('is advisory: reported, not scored', () => {
    expect(unavailableAfterRule.advisory).toBe(true);
  });
});

describe('obsolete robots directives', () => {
  it('warns about noodp and noydir wherever they are declared', async () => {
    const result = await obsoleteRobotsDirectivesRule.run(
      page('<meta name="robots" content="index, noodp">', { 'x-robots-tag': 'slurp: noydir' })
    );
    expect(result.status).toBe('warn');
    expect(result.message).toContain('noodp and noydir');
  });

  it('passes current directives, and is not measured without any', async () => {
    expect((await obsoleteRobotsDirectivesRule.run(page('<meta name="robots" content="noindex">'))).status).toBe('pass');
    expect((await obsoleteRobotsDirectivesRule.run(page(''))).status).toBe('not-measured');
  });
});

describe('canonical with a fragment', () => {
  it('warns about a fragment in the element', async () => {
    const result = await canonicalFragmentRule.run(page('<link rel="canonical" href="https://example.com/a#top">'));
    expect(result.status).toBe('warn');
    expect(result.details).toMatchObject({ resolvesTo: 'https://example.com/a' });
  });

  it('warns about a fragment in the Link header', async () => {
    const result = await canonicalFragmentRule.run(page('', { link: '<https://example.com/a#top>; rel="canonical"' }));
    expect(result.status).toBe('warn');
  });

  it('warns when either of two declarations has one', async () => {
    const result = await canonicalFragmentRule.run(
      page('<link rel="canonical" href="https://example.com/a">', { link: '<https://example.com/a#x>; rel="canonical"' })
    );
    expect(result.status).toBe('warn');
  });

  it('names a hash-bang canonical as one', async () => {
    const result = await canonicalFragmentRule.run(page('<link rel="canonical" href="https://example.com/#!/products">'));
    expect(result.message).toContain('hash-bang');
  });

  it('passes a clean canonical, and is not measured without one', async () => {
    expect((await canonicalFragmentRule.run(page('<link rel="canonical" href="https://example.com/a">'))).status).toBe('pass');
    expect((await canonicalFragmentRule.run(page(''))).status).toBe('not-measured');
  });
});
