import type { AuditContext, AuditRule, RuleOptionValues, RuleResult } from '../../types.js';
import { defineRule, pass, warn, fail, notMeasured, readRuleOptions } from '../define-rule.js';
import type { AxeResult, AxeViolation } from '../../render/axe.js';

/**
 * axe rules a static SEOmator rule already answers. Their violations are
 * left out of the grouped rules, so one problem is not reported twice. Two of
 * the static rules use axe's verdict when a render ran (see `axeVerdict`).
 */
export const AXE_STATIC_EQUIVALENTS: Record<string, string> = {
  accesskeys: 'a11y-accesskey-unique',
  'aria-hidden-body': 'a11y-aria-hidden-body',
  'aria-hidden-focus': 'a11y-aria-hidden-focusable',
  'aria-required-children': 'a11y-aria-required',
  'aria-required-parent': 'a11y-aria-required',
  'aria-roles': 'a11y-aria-valid',
  'aria-valid-attr': 'a11y-aria-valid',
  'aria-command-name': 'a11y-aria-labels',
  'aria-input-field-name': 'a11y-aria-labels',
  'aria-toggle-field-name': 'a11y-aria-labels',
  'link-name': 'a11y-aria-labels',
  'autocomplete-valid': 'a11y-autocomplete',
  'button-name': 'a11y-button-name',
  'input-button-name': 'a11y-button-name',
  'color-contrast': 'a11y-color-contrast',
  'duplicate-id-aria': 'a11y-duplicate-id',
  'empty-heading': 'a11y-empty-heading',
  'form-field-multiple-labels': 'a11y-form-multiple-labels',
  'heading-order': 'a11y-heading-order',
  'identical-links-same-purpose': 'a11y-identical-links-purpose',
  'frame-title': 'a11y-iframe-title',
  'input-image-alt': 'a11y-input-image-alt',
  label: 'a11y-form-labels',
  'select-name': 'a11y-form-labels',
  'label-content-name-mismatch': 'a11y-label-name-mismatch',
  'landmark-one-main': 'a11y-main-landmark',
  list: 'a11y-list-structure',
  listitem: 'a11y-list-structure',
  'object-alt': 'a11y-object-alt',
  'presentation-role-conflict': 'a11y-presentation-role-conflict',
  'image-redundant-alt': 'a11y-redundant-alt',
  'skip-link': 'a11y-skip-link',
  bypass: 'a11y-skip-link',
  'svg-img-alt': 'a11y-svg-img-alt',
  'th-has-data-cells': 'a11y-table-headers',
  'td-headers-attr': 'a11y-table-headers',
  'target-size': 'a11y-touch-targets',
  'valid-lang': 'a11y-valid-lang-element',
  'video-caption': 'a11y-video-captions',
  'html-xml-lang-mismatch': 'a11y-xml-lang-mismatch',
  'meta-viewport': 'a11y-zoom-disabled',
  'meta-viewport-large': 'a11y-zoom-disabled',
  'image-alt': 'images-alt-present',
  'document-title': 'core-title-present',
  'html-has-lang': 'i18n-lang-attribute',
  'page-has-heading-one': 'core-h1-present',
  'meta-refresh': 'redirect-meta-refresh',
  'meta-refresh-no-exceptions': 'redirect-meta-refresh',
  tabindex: 'a11y-tabindex-positive',
};

/** The grouped rules, by WCAG area. An axe id in none of them goes to "other". */
const GROUPS: Array<{ key: string; name: string; area: string; ids: string[] }> = [
  { key: 'names', name: 'Accessible Names (axe)', area: 'names and labels', ids: ['area-alt', 'role-img-alt', 'summary-name', 'label-title-only', 'aria-dialog-name', 'aria-meter-name', 'aria-progressbar-name', 'aria-tooltip-name', 'aria-treeitem-name', 'aria-tab-name'] },
  { key: 'landmarks', name: 'Landmarks (axe)', area: 'landmarks', ids: ['region', 'landmark-banner-is-top-level', 'landmark-contentinfo-is-top-level', 'landmark-main-is-top-level', 'landmark-no-duplicate-banner', 'landmark-no-duplicate-contentinfo', 'landmark-no-duplicate-main', 'landmark-unique'] },
  { key: 'keyboard', name: 'Keyboard and Focus (axe)', area: 'keyboard and focus', ids: ['scrollable-region-focusable', 'nested-interactive', 'frame-focusable-content'] },
  { key: 'tables', name: 'Tables (axe)', area: 'tables', ids: ['empty-table-header', 'scope-attr-valid', 'table-duplicate-name'] },
  { key: 'lists', name: 'Lists (axe)', area: 'lists', ids: ['definition-list', 'dlitem'] },
  { key: 'media', name: 'Media and Motion (axe)', area: 'media and motion', ids: ['no-autoplay-audio', 'blink', 'marquee'] },
  { key: 'frames', name: 'Frames (axe)', area: 'frames', ids: ['frame-tested', 'frame-title-unique'] },
  { key: 'aria', name: 'ARIA Validity (axe)', area: 'ARIA validity', ids: ['aria-allowed-attr', 'aria-allowed-role', 'aria-braille-equivalent', 'aria-conditional-attr', 'aria-deprecated-role', 'aria-prohibited-attr', 'aria-required-attr', 'aria-valid-attr-value', 'aria-text'] },
  { key: 'language', name: 'Document Language (axe)', area: 'document language', ids: ['html-lang-valid'] },
  { key: 'other', name: 'Other Accessibility (axe)', area: 'other', ids: [] },
];

const GROUPED = new Set(GROUPS.flatMap((g) => g.ids));
const SERIOUS = new Set(['serious', 'critical']);

function axeResult(context: AuditContext): AxeResult | undefined {
  const axe = context.probes?.['axe'] as AxeResult | undefined;
  return axe && Array.isArray(axe.violations) ? axe : undefined;
}

/** A finding from axe violations: serious or critical fails, the rest warn */
function fromViolations(ruleId: string, version: string, area: string, violations: AxeViolation[]): RuleResult {
  if (violations.length === 0) {
    return pass(ruleId, `axe ${version} found no ${area} problems in the rendered page`, { engine: `axe-core ${version}` });
  }
  const findings = violations.map((v) => ({ axeRule: v.id, impact: v.impact, wcag: v.tags, help: v.help, helpUrl: v.helpUrl, elements: v.nodes, examples: v.targets }));
  const message = `axe found ${area} problems: ${violations.map((v) => `${v.id} (${v.impact ?? 'unrated'}, ${v.nodes} element${v.nodes === 1 ? '' : 's'})`).join('; ')}`;
  const details = { engine: `axe-core ${version}`, violations: findings };
  return violations.some((v) => v.impact && SERIOUS.has(v.impact)) ? fail(ruleId, message, details) : warn(ruleId, message, details);
}

/**
 * axe's answer for a static rule, when a render ran axe; null otherwise, so
 * the rule falls back to its own heuristic. The heuristic reads the source
 * and guesses; axe reads computed styles and layout.
 */
export function axeVerdict(context: AuditContext, ruleId: string, axeId: string, area: string): RuleResult | null {
  const axe = axeResult(context);
  if (!axe) return null;
  return fromViolations(ruleId, axe.version, area, axe.violations.filter((v) => v.id === axeId));
}

function groupRule(group: (typeof GROUPS)[number]): AuditRule {
  const id = `a11y-axe-${group.key}`;
  const rule: AuditRule = defineRule({
    id,
    name: group.name,
    description:
      group.key === 'other'
        ? 'Accessibility problems axe-core finds in the rendered page that no other rule covers'
        : `Accessibility problems with ${group.area}, found by axe-core in the rendered page`,
    category: 'a11y',
    weight: 3,
    advisory: true,
    requiresRender: true,
    options: {
      disable_axe_rules: {
        type: 'string[]',
        default: [],
        description: 'axe rule ids to leave out, for known exceptions',
      },
    },
    run: (context: AuditContext, options?: RuleOptionValues) => {
      const axe = axeResult(context);
      if (!axe) {
        return notMeasured(id, 'The accessibility engine did not run in this render', undefined, 'probe-failed');
      }
      const disabled = new Set(readRuleOptions(rule, options).disable_axe_rules as string[]);
      const mine = axe.violations.filter((v) => {
        if (disabled.has(v.id) || AXE_STATIC_EQUIVALENTS[v.id]) return false;
        return group.key === 'other' ? !GROUPED.has(v.id) : group.ids.includes(v.id);
      });
      return fromViolations(id, axe.version, group.area, mine);
    },
  });
  return rule;
}

export const axeGroupRules: AuditRule[] = GROUPS.map(groupRule);
