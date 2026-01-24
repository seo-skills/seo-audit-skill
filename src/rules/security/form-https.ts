import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

interface InsecureForm {
  /** Form action URL */
  action: string;
  /** HTTP method */
  method: string;
  /** Form id attribute */
  id: string;
  /** Form name attribute */
  name: string;
}

/**
 * Rule: Form HTTPS
 *
 * Checks that form actions use HTTPS to protect submitted data.
 * POST forms with HTTP actions are critical security issues.
 */
export const formHttpsRule = defineRule({
  id: 'security-form-https',
  name: 'Form HTTPS',
  description: 'Checks that form actions use HTTPS',
  category: 'security',
  weight: 5,
  run: (context: AuditContext) => {
    const { $, url } = context;
    const isHttpsPage = url.startsWith('https://');

    const forms = $('form');
    if (forms.length === 0) {
      return pass('security-form-https', 'No forms found on page', { formCount: 0 });
    }

    const insecureForms: InsecureForm[] = [];

    forms.each((_, el) => {
      const $form = $(el);
      const action = $form.attr('action') || '';
      const method = ($form.attr('method') || 'get').toLowerCase();

      // Empty action means submit to same page (safe if page is HTTPS)
      if (!action || action.startsWith('#') || action.startsWith('/') || action.startsWith('.')) {
        return;
      }

      // Check for explicit http:// actions
      if (action.toLowerCase().startsWith('http://')) {
        insecureForms.push({
          action,
          method,
          id: $form.attr('id') || '',
          name: $form.attr('name') || '',
        });
      }
    });

    if (insecureForms.length === 0) {
      return pass('security-form-https', `All ${forms.length} form(s) use secure actions`, {
        formCount: forms.length,
        isHttpsPage,
      });
    }

    // POST forms with insecure actions are more critical
    const hasInsecurePost = insecureForms.some(f => f.method === 'post');

    const message = `${insecureForms.length} form(s) submit to insecure HTTP URLs`;
    const details = {
      insecureForms,
      totalForms: forms.length,
      isHttpsPage,
    };

    return hasInsecurePost
      ? fail('security-form-https', message, details)
      : warn('security-form-https', message, details);
  },
});
