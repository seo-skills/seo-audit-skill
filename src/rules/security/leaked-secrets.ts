import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

interface LeakedSecret {
  /** Secret type/provider */
  type: string;
  /** Masked match value */
  match: string;
  /** Surrounding context */
  context: string;
}

/**
 * Patterns for detecting common secrets.
 * Each pattern targets a specific provider or secret type.
 */
const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  // AWS
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g },
  { name: 'AWS Secret Key', pattern: /aws_secret_access_key\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})["']?/gi },

  // Google
  { name: 'Google API Key', pattern: /AIza[0-9A-Za-z_-]{35}/g },
  { name: 'Google OAuth', pattern: /[0-9]+-[0-9A-Za-z_]{32}\.apps\.googleusercontent\.com/g },

  // GitHub
  { name: 'GitHub Token', pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g },

  // Stripe
  { name: 'Stripe Secret Key', pattern: /sk_(?:live|test)_[0-9a-zA-Z]{24,}/g },
  { name: 'Stripe Restricted Key', pattern: /rk_(?:live|test)_[0-9a-zA-Z]{24,}/g },

  // Slack
  { name: 'Slack Token', pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*/g },
  { name: 'Slack Webhook', pattern: /hooks\.slack\.com\/services\/T[A-Z0-9]{8,}\/B[A-Z0-9]{8,}\/[a-zA-Z0-9]{20,}/g },

  // Firebase
  { name: 'Firebase URL', pattern: /[a-z0-9-]+\.firebaseio\.com/gi },

  // Twilio
  { name: 'Twilio API Key', pattern: /SK[a-f0-9]{32}/g },
  { name: 'Twilio Account SID', pattern: /AC[a-f0-9]{32}/g },

  // SendGrid
  { name: 'SendGrid API Key', pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g },

  // Mailgun
  { name: 'Mailgun API Key', pattern: /key-[0-9a-zA-Z]{32}/g },

  // NPM
  { name: 'NPM Token', pattern: /npm_[A-Za-z0-9]{36}/g },

  // Private Keys
  { name: 'RSA Private Key', pattern: /-----BEGIN RSA PRIVATE KEY-----/g },
  { name: 'SSH Private Key', pattern: /-----BEGIN (?:OPENSSH|EC|DSA|PGP) PRIVATE KEY-----/g },
  { name: 'PEM Private Key', pattern: /-----BEGIN PRIVATE KEY-----/g },

  // Generic patterns (more prone to false positives, but important)
  { name: 'Basic Auth in URL', pattern: /https?:\/\/[^:]+:[^@]+@[^\s"'<>]+/gi },
  { name: 'Bearer Token (JWT)', pattern: /bearer\s+eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/gi },

  // Database connection strings
  { name: 'MongoDB URI', pattern: /mongodb(?:\+srv)?:\/\/[^:]+:[^@]+@[^\s"'<>]+/gi },
  { name: 'PostgreSQL URI', pattern: /postgres(?:ql)?:\/\/[^:]+:[^@]+@[^\s"'<>]+/gi },
  { name: 'MySQL URI', pattern: /mysql:\/\/[^:]+:[^@]+@[^\s"'<>]+/gi },

  // Shopify
  { name: 'Shopify Access Token', pattern: /shpat_[a-fA-F0-9]{32}/g },
  { name: 'Shopify Shared Secret', pattern: /shpss_[a-fA-F0-9]{32}/g },
];

/**
 * Mask a secret value for safe display.
 */
function maskSecret(value: string): string {
  if (value.length <= 12) {
    return value.slice(0, 4) + '****';
  }
  return value.slice(0, 8) + '...' + value.slice(-4);
}

/**
 * Rule: Leaked Secrets
 *
 * Detects exposed API keys, credentials, and secrets in HTML and inline JavaScript.
 * This is a critical security issue that requires immediate action.
 */
export const leakedSecretsRule = defineRule({
  id: 'security-leaked-secrets',
  name: 'Leaked Secrets',
  description: 'Detects exposed API keys, credentials, and secrets in HTML/JS',
  category: 'security',
  weight: 10,
  run: (context: AuditContext) => {
    const { $, html } = context;

    const leakedSecrets: LeakedSecret[] = [];
    const seenMatches = new Set<string>();

    // Get all inline script content
    const scriptContent: string[] = [];
    $('script:not([src])').each((_, el) => {
      const content = $(el).html();
      if (content) scriptContent.push(content);
    });

    // Combine HTML and scripts for scanning
    const contentToScan = html + '\n' + scriptContent.join('\n');

    for (const { name, pattern } of SECRET_PATTERNS) {
      // Reset regex state for global patterns
      pattern.lastIndex = 0;

      let match;
      let matchCount = 0;

      while ((match = pattern.exec(contentToScan)) !== null && matchCount < 5) {
        const matchValue = match[0];

        // Skip duplicates
        if (seenMatches.has(matchValue)) continue;
        seenMatches.add(matchValue);

        // Get surrounding context
        const start = Math.max(0, match.index - 20);
        const end = Math.min(contentToScan.length, match.index + matchValue.length + 20);
        const contextStr = contentToScan.slice(start, end).replace(/\s+/g, ' ').trim();

        leakedSecrets.push({
          type: name,
          match: maskSecret(matchValue),
          context: contextStr.slice(0, 60) + (contextStr.length > 60 ? '...' : ''),
        });

        matchCount++;
      }
    }

    if (leakedSecrets.length === 0) {
      return pass('security-leaked-secrets', 'No exposed secrets detected', {
        patternsChecked: SECRET_PATTERNS.length,
      });
    }

    // Group by type for summary
    const byType = leakedSecrets.reduce((acc, secret) => {
      acc[secret.type] = (acc[secret.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return fail(
      'security-leaked-secrets',
      `Found ${leakedSecrets.length} potential exposed secret(s)`,
      {
        secrets: leakedSecrets.slice(0, 10),
        totalSecrets: leakedSecrets.length,
        byType,
      }
    );
  },
});
