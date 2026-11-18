import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, notMeasured } from '../define-rule.js';

const ID = 'social-twitter-attribute';

/**
 * Rule: twitter:* tags use name=
 *
 * X's card markup is `<meta name="twitter:card">`. Written with `property=`,
 * the Open Graph attribute, X still reads it, but other consumers of the
 * card markup may not. The mirror of how Open Graph tags written with
 * `name=` are reported.
 */
export const twitterAttributeRule = defineRule({
  id: ID,
  name: 'Twitter Card Attribute',
  description: 'Checks that twitter:* tags are declared with name=, as the card markup specifies',
  category: 'social',
  weight: 1,
  advisory: true,
  run: (context: AuditContext) => {
    const { $ } = context;
    const withName = $('meta[name^="twitter:" i]').length;
    const withProperty = $('meta[property^="twitter:" i]')
      .map((_, el) => ($(el).attr('property') ?? '').toLowerCase())
      .get();
    if (withName + withProperty.length === 0) {
      return notMeasured(ID, 'No Twitter card tags on this page', undefined, 'not-applicable');
    }
    if (withProperty.length === 0) {
      return pass(ID, 'Twitter card tags are declared with name=', { tags: withName });
    }
    return warn(ID, `${withProperty.join(', ')} declared with property= instead of name=`, {
      properties: withProperty,
      recommendation: 'Write Twitter card tags as <meta name="twitter:..." content="...">.',
    });
  },
});
