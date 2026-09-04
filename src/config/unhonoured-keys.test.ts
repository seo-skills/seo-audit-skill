// Regression: ISSUE-012 — several [crawler] and [external_links] keys are inert
// Found by /qa on 2026-09-04
// Report: .gstack/qa-reports/qa-report-cli-config-2026-09-04b.md
//
// A sweep of all 30 config leaf keys for a real consumer found nine with none.
// Unlike the earlier findings, each of these has a default that matches what
// the code actually does — the queue really is breadth-first, redirects really
// are followed — so a default config is not misleading. Changing one is what
// does nothing, and that is what this warns about.
//
// `crawler.per_host_concurrency = 8` was the clearest case: it produced a
// precise range error ("must be between 1 and 5") for a setting with no
// implementation behind it at all.
import { describe, it, expect } from 'vitest';
import { validateConfig } from './validator.js';
import { getDefaultConfig } from './defaults.js';

/** Warnings whose text says a key is not implemented. */
function unhonoured(config: ReturnType<typeof getDefaultConfig>): string[] {
  return validateConfig(config)
    .warnings.filter((w) => /not implemented/i.test(w.message))
    .map((w) => w.path);
}

describe('a default config is not accused of anything', () => {
  it('warns about nothing when every value is the default', () => {
    // The defaults describe real behaviour. Warning here would train people to
    // ignore the warnings.
    expect(unhonoured(getDefaultConfig())).toEqual([]);
  });

  it('stays quiet when a key is set to exactly its default', () => {
    const config = getDefaultConfig();
    config.crawler.breadth_first = true;
    config.external_links.enabled = true;
    expect(unhonoured(config)).toEqual([]);
  });
});

describe('changing an inert key says so', () => {
  it('warns when breadth_first is turned off', () => {
    const config = getDefaultConfig();
    config.crawler.breadth_first = false;
    expect(unhonoured(config)).toContain('crawler.breadth_first');
  });

  it('warns when follow_redirects is turned off', () => {
    const config = getDefaultConfig();
    config.crawler.follow_redirects = false;
    expect(unhonoured(config)).toContain('crawler.follow_redirects');
  });

  it('warns when per_host_concurrency is changed', () => {
    const config = getDefaultConfig();
    config.crawler.per_host_concurrency = 4;
    expect(unhonoured(config)).toContain('crawler.per_host_concurrency');
  });

  it('warns for the external-link settings, which have no checker behind them', () => {
    const config = getDefaultConfig();
    config.external_links.enabled = false;
    config.external_links.cache_ttl_days = 30;

    const paths = unhonoured(config);
    expect(paths).toContain('external_links.enabled');
    expect(paths).toContain('external_links.cache_ttl_days');
  });

  it('warns when rule_options is populated', () => {
    const config = getDefaultConfig();
    config.rule_options = { 'content-word-count': { min: 500 } };
    expect(unhonoured(config)).toContain('rule_options');
  });

  it('stays a warning, not an error, so the audit still runs', () => {
    const config = getDefaultConfig();
    config.crawler.breadth_first = false;
    expect(validateConfig(config).valid).toBe(true);
  });
});

describe('keys that are honoured are not listed as inert', () => {
  it('says nothing about the settings this build does act on', () => {
    const config = getDefaultConfig();
    config.crawler.delay_ms = 500;
    config.crawler.per_host_delay_ms = 400;
    config.crawler.exclude = ['/cart/**'];
    config.crawler.respect_robots = false;
    config.output.format = 'json';
    config.rules.disable = ['perf-*'];

    // Every one of these was wired on 2026-09-04. Listing any of them here
    // would be the same lie in the other direction.
    expect(unhonoured(config)).toEqual([]);
  });
});
