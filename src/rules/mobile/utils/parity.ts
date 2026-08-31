import type { CheerioAPI } from 'cheerio';
import type { AuditContext, RuleResult } from '../../../types.js';
import { notMeasured } from '../../define-rule.js';

/**
 * Shared plumbing for mobile-first parity rules.
 *
 * Each rule compares one SEO-critical element between the desktop-rendered DOM
 * (`rendered$`) and the mobile-rendered DOM (`mobile$`). Both only exist when
 * the audit ran with a browser render (`measureCwv`) and mobile parity enabled
 * (`--mobile`), so the rules share one guard.
 */

/**
 * The two rendered DOMs a parity rule needs, or a `notMeasured` result
 * explaining which render was missing.
 */
export type ParityInputs =
  | { available: true; desktop: CheerioAPI; mobile: CheerioAPI }
  | { available: false; result: RuleResult };

/**
 * Resolve the desktop and mobile DOMs for a parity rule.
 *
 * @param ruleId - The calling rule's id, for the unmeasured result
 * @param context - The audit context
 */
export function parityInputs(ruleId: string, context: AuditContext): ParityInputs {
  if (!context.rendered$ || !context.mobile$) {
    return {
      available: false,
      result: notMeasured(
        ruleId,
        'Mobile parity not measured - run with --mobile (and without --no-cwv) to render desktop and mobile and compare them'
      ),
    };
  }
  return { available: true, desktop: context.rendered$, mobile: context.mobile$ };
}

/** First non-empty trimmed text for a selector, or empty string */
export function firstText($: CheerioAPI, selector: string): string {
  return $(selector).first().text().replace(/\s+/g, ' ').trim();
}

/** An attribute value for the first match of a selector, trimmed */
export function firstAttr($: CheerioAPI, selector: string, attr: string): string {
  return ($(selector).first().attr(attr) ?? '').trim();
}
