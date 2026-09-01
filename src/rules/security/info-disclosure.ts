import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Headers that name the software stack. `server` is expected on most responses,
 * so it only counts as disclosure when it carries a version number.
 */
const ALWAYS_DISCLOSING = [
  'x-powered-by',
  'x-aspnet-version',
  'x-aspnetmvc-version',
  'x-generator',
  'x-drupal-cache',
];

/** A version string such as "2.4.41" or "8.1" */
const VERSION_PATTERN = /\d+\.\d+/;

/**
 * Rule: Check for software version disclosure in response headers
 *
 * Naming the exact server and version tells an attacker which published
 * vulnerabilities to try first. Suppressing these headers costs nothing.
 */
export const infoDisclosureRule = defineRule({
  id: 'security-info-disclosure',
  name: 'Software Version Disclosure',
  description:
    'Checks that response headers do not advertise the server software and its version',
  category: 'security',
  weight: 3,
  run: (context: AuditContext) => {
    const { headers, url } = context;

    const disclosed: { header: string; value: string }[] = [];

    for (const name of ALWAYS_DISCLOSING) {
      const value = headers[name];
      if (value) disclosed.push({ header: name, value });
    }

    const server = headers['server'];
    if (server && VERSION_PATTERN.test(server)) {
      disclosed.push({ header: 'server', value: server });
    }

    const details = { url, disclosed };

    if (disclosed.length > 0) {
      const summary = disclosed.map((d) => `${d.header}: ${d.value}`).join(', ');
      return warn(
        'security-info-disclosure',
        `Response headers disclose the software stack (${summary}). Suppress or genericise these headers.`,
        details
      );
    }

    return pass(
      'security-info-disclosure',
      'Response headers do not disclose software versions',
      details
    );
  },
});
