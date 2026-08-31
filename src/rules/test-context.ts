import * as cheerio from 'cheerio';
import type { AuditContext } from '../types.js';

/**
 * Builds a complete AuditContext for rule tests.
 *
 * Rules destructure context fields and dereference them without guarding, so a
 * hand-built context that omits one produces a TypeError that the Auditor
 * records as a score-0 rule failure — the exact defect that shipped in the
 * `analyze` command. Centralising the shape here means adding a field to
 * AuditContext updates every test at once instead of leaving stale literals
 * scattered across the suite.
 *
 * @param html - Page HTML; also used to build the Cheerio instance
 * @param overrides - Any context fields to replace
 */
export function createTestContext(
  html: string,
  overrides: Partial<AuditContext> = {}
): AuditContext {
  return {
    url: 'https://example.com/',
    html,
    $: cheerio.load(html),
    headers: {},
    statusCode: 200,
    responseTime: 100,
    cwv: {},
    links: [],
    images: [],
    invalidLinks: [],
    specialLinks: [],
    figures: [],
    inlineSvgs: [],
    pictureElements: [],
    ...overrides,
  };
}
