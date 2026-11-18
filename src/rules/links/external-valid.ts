import type { AuditContext, RuleOptionValues } from '../../types.js';
import { defineRule, pass, warn, notMeasured, readRuleOptions } from '../define-rule.js';
import { urlServiceFor } from '../../net/url-service.js';
import {
  SINGLE_PAGE_BUDGET_MS,
  brokenReason,
  checkExternalLinks,
  externalTarget,
  unverifiedReason,
} from '../../site/external-links.js';

const ID = 'links-external-valid';
/** Listed per page; the counts cover every link */
const MAX_LISTED = 10;

/**
 * Rule: external links lead somewhere
 *
 * The run checks every external target once, before rules run (see
 * `site/external-links.ts`); this rule reads its page's answers. Only a
 * target that is gone (404, 410, 5xx, a domain that does not resolve) counts
 * as broken. A server that refused the check (401, 403, 429, 999) or did not
 * answer in time could not be verified, and never changes the status.
 */
export const externalValidRule = defineRule({
  id: ID,
  name: 'External Links Valid',
  description: 'Checks that external links are reachable and return valid responses',
  category: 'links',
  weight: 1,
  options: {
    max_urls: {
      type: 'number',
      default: 2000,
      min: 1,
      max: 100000,
      description: 'Most unique external URLs one crawl checks; the rest are reported as not checked',
    },
    max_seconds: {
      type: 'number',
      default: 300,
      min: 5,
      max: 3600,
      description: 'Longest one crawl spends checking external links, in seconds',
    },
  },
  run: async (context: AuditContext, options?: RuleOptionValues) => {
    const opts = readRuleOptions(externalValidRule, options);
    const check =
      context.externalLinks ??
      (await checkExternalLinks(urlServiceFor(context), [context], {
        maxUrls: opts.max_urls as number,
        budgetMs: SINGLE_PAGE_BUDGET_MS,
      }));

    if (!check.enabled) {
      return notMeasured(ID, 'External link checking is turned off ([external_links] enabled = false)', undefined, 'disabled');
    }

    const targets = [
      ...new Set(
        context.links
          .filter((link) => !link.isInternal)
          .map((link) => externalTarget(link.href))
          .filter((target): target is string => target !== null)
      ),
    ];
    if (targets.length === 0) {
      return pass(ID, 'No external links found to check', { totalLinks: 0 });
    }

    const broken: Array<{ href: string; statusCode: number; reason: string }> = [];
    const unverified: Array<{ href: string; reason: string }> = [];
    let reachable = 0;
    let notChecked = 0;
    for (const target of targets) {
      const info = check.results.get(target);
      if (!info) notChecked++;
      else if (info.verdict === 'ok') reachable++;
      else if (info.verdict === 'broken') broken.push({ href: target, statusCode: info.status, reason: brokenReason(info) });
      else unverified.push({ href: target, reason: unverifiedReason(info) });
    }

    const verified = reachable + broken.length;
    const details = {
      totalExternal: targets.length,
      totalChecked: verified,
      ...(broken.length > 0 && { brokenCount: broken.length, brokenLinks: broken.slice(0, MAX_LISTED) }),
      ...(unverified.length > 0 && { couldNotVerifyCount: unverified.length, couldNotVerify: unverified.slice(0, MAX_LISTED) }),
      ...(notChecked > 0 && { notChecked }),
    };
    const aside = [
      unverified.length > 0 ? `${unverified.length} could not be verified` : '',
      notChecked > 0 ? `${notChecked} not checked` : '',
    ]
      .filter(Boolean)
      .join(', ');
    const suffix = aside ? ` (${aside})` : '';

    if (verified === 0) {
      return notMeasured(ID, `No external link could be verified${suffix}`, details, 'could-not-verify');
    }

    if (broken.length > 0) {
      return warn(ID, `Found ${broken.length} broken external link(s) out of ${verified} checked${suffix}`, {
        ...details,
        recommendation: 'Update or remove links to pages that no longer exist.',
      });
    }

    return pass(ID, `All ${verified} checked external link(s) are reachable${suffix}`, details);
  },
});
