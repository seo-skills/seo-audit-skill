import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail, notMeasured } from '../define-rule.js';

/**
 * Parse a CSP header into directive name -> source list.
 */
function parseDirectives(header: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const part of header.split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    const name = tokens.shift()?.toLowerCase();
    if (name) directives.set(name, tokens);
  }
  return directives;
}

/**
 * Rule: Grade Content-Security-Policy strength against XSS
 *
 * Separate from `security-csp`, which only asks whether a policy exists. A CSP
 * carrying 'unsafe-inline' without a nonce, or a wildcard script source, blocks
 * nothing in practice — presence alone is not protection.
 */
export const cspXssRule = defineRule({
  id: 'security-csp-xss',
  name: 'CSP Strength Against XSS',
  description:
    'Checks that the Content-Security-Policy actually constrains script execution',
  category: 'security',
  weight: 6,
  run: (context: AuditContext) => {
    const { headers, url } = context;

    const header =
      headers['content-security-policy'] ?? headers['content-security-policy-report-only'];

    // Absence is already reported by security-csp; grading it again would
    // penalise the same gap twice.
    if (!header) {
      return notMeasured('security-csp-xss', 'No Content-Security-Policy to grade', { url });
    }

    const directives = parseDirectives(header);
    const scriptSrc = directives.get('script-src') ?? directives.get('default-src') ?? [];
    const sources = scriptSrc.map((s) => s.toLowerCase());

    const hasNonceOrHash = sources.some(
      (s) => s.startsWith("'nonce-") || s.startsWith("'sha256-") || s.startsWith("'sha384-") || s.startsWith("'sha512-")
    );
    const hasStrictDynamic = sources.includes("'strict-dynamic'");

    const critical: string[] = [];
    const advisory: string[] = [];

    // A nonce or hash makes 'unsafe-inline' inert in browsers that support CSP2+,
    // so it is only a real hole when nothing else constrains inline script.
    if (sources.includes("'unsafe-inline'") && !hasNonceOrHash && !hasStrictDynamic) {
      critical.push("script-src allows 'unsafe-inline' with no nonce or hash");
    }
    if (sources.includes('*') || sources.some((s) => s === 'http:' || s === 'https:')) {
      critical.push('script-src allows any host');
    }
    if (sources.length === 0) {
      critical.push('no script-src or default-src directive');
    }
    if (sources.includes("'unsafe-eval'")) {
      advisory.push("script-src allows 'unsafe-eval'");
    }
    if (!directives.has('object-src') && !directives.has('default-src')) {
      advisory.push("no object-src directive (plugins can execute; set object-src 'none')");
    }
    if (!directives.has('base-uri')) {
      advisory.push("no base-uri directive (a <base> injection can redirect relative scripts)");
    }

    const details = {
      url,
      reportOnly: !headers['content-security-policy'],
      scriptSrc,
      critical,
      advisory,
    };

    if (critical.length > 0) {
      return fail(
        'security-csp-xss',
        `Content-Security-Policy does not effectively restrict scripts: ${critical.join('; ')}`,
        details
      );
    }

    if (advisory.length > 0) {
      return warn(
        'security-csp-xss',
        `Content-Security-Policy restricts scripts but could be tightened: ${advisory.join('; ')}`,
        details
      );
    }

    return pass(
      'security-csp-xss',
      'Content-Security-Policy meaningfully restricts script execution',
      details
    );
  },
});
