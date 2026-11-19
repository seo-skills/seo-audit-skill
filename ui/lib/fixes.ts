/**
 * What to fix first, as the report shows it (DESIGN.md "The numbers").
 *
 * The server attaches `points` to every rule summary: the score points the
 * audit gains if that rule passes (`src/rules/points.ts`). Everything here is
 * presentation over that number — one queue ranked by it, failures and
 * warnings together, the fix text split into a headline, and the agent's one
 * sentence, which may only say what the numbers support.
 */

import type { AuditResult } from '../../src/types.js';
import type { RuleMetadata, RuleSummary } from '../../src/dashboard/contract.js';
import { formatRuleIdAsName } from './format.js';
import { splitFix } from '../../src/reporters/fix-brief.js';
import { overridePriorityFactor } from '../../src/rules/overrides.js';

export {
  agentLine,
  capHeadline,
  formatPoints,
  missingPoints,
  nextGrade,
  nextGradeLine,
  splitFix,
  tied,
} from '../../src/reporters/fix-brief.js';

export const CATEGORY_NAMES: Record<string, string> = {
  core: 'Core SEO', technical: 'Technical SEO', perf: 'Performance',
  links: 'Links', images: 'Images', security: 'Security',
  crawl: 'Crawlability', schema: 'Structured Data', a11y: 'Accessibility',
  content: 'Content', social: 'Social', eeat: 'E-E-A-T',
  url: 'URL Structure', mobile: 'Mobile', i18n: 'Internationalization',
  legal: 'Legal', js: 'JS Rendering', redirect: 'Redirects',
  htmlval: 'HTML Validation', geo: 'AI/GEO',
};

export interface Fix {
  ruleId: string;
  categoryId: string;
  categoryName: string;
  status: 'fail' | 'warn';
  /** The rule's name, for the evidence panel */
  name: string;
  /** The fix text up to its first colon or semicolon: the row's headline */
  headline: string;
  /** The rest of the fix text, sentence-cased; empty when there is none */
  rest: string;
  /** What the check saw */
  message: string;
  /** What the check is for */
  description: string;
  /** Score points this fix returns; 0 when the server sent none */
  points: number;
  /** `[rules.override]` placement, which re-ranks without changing points */
  override?: 'high' | 'normal' | 'low' | 'ignore';
  priority: number;
  affectedPages: number;
  measuredPages: number;
  details: Record<string, unknown> | undefined;
}

/**
 * Every scored failure and warning, most points first.
 *
 * Advisory findings are left out: they score nothing yet, so they cannot be
 * "what to fix first". Ignored findings are left out unless `includeIgnored`
 * is set, so score totals can still include them. High and low overrides scale
 * the order without changing the points shown.
 * The report lists advisories with the measurement gaps.
 */
export function rankedFixes(
  result: AuditResult,
  ruleMetadata: Record<string, RuleMetadata> | undefined,
  options: { includeIgnored?: boolean } = {}
): Fix[] {
  const fixes: Fix[] = [];
  for (const category of result.categoryResults) {
    for (const rule of category.results as RuleSummary[]) {
      if (rule.status !== 'fail' && rule.status !== 'warn') continue;
      if (rule.advisory) continue;
      if (!options.includeIgnored && rule.overridden?.priority === 'ignore') continue;
      const meta = ruleMetadata?.[rule.ruleId];
      const { headline, rest } = splitFix(meta?.fix || meta?.name || formatRuleIdAsName(rule.ruleId));
      fixes.push({
        ruleId: rule.ruleId,
        categoryId: category.categoryId,
        categoryName: CATEGORY_NAMES[category.categoryId] ?? category.categoryId,
        status: rule.status,
        name: meta?.name ?? formatRuleIdAsName(rule.ruleId),
        headline,
        rest,
        message: rule.message,
        description: meta?.description ?? '',
        points: rule.points ?? 0,
        ...(rule.overridden?.priority && { override: rule.overridden.priority }),
        priority: rule.priority ?? 0,
        affectedPages: rule.affectedPages ?? 1,
        measuredPages: rule.measuredPages ?? 1,
        details: rule.details,
      });
    }
  }
  // Overrides scale the points-only sort key, not the points printed or the
  // score. The server's priority breaks ties and orders an older payload that
  // sent no points; the rule id makes the order total.
  const rank = (fix: Fix) => fix.points * overridePriorityFactor(fix.override);
  return fixes.sort(
    (a, b) => rank(b) - rank(a) || b.priority - a.priority || a.ruleId.localeCompare(b.ruleId)
  );
}
