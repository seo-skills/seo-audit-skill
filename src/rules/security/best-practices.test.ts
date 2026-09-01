import { describe, it, expect } from 'vitest';
import { createTestContext } from '../test-context.js';
import { coopRule } from './coop.js';
import { cspXssRule } from './csp-xss.js';
import { infoDisclosureRule } from './info-disclosure.js';
import { pasteBlockingRule } from './paste-blocking.js';
import { trustedTypesRule } from './trusted-types.js';

const HTML = '<html><body><p>Fixture</p></body></html>';
const withHeaders = (headers: Record<string, string>) => createTestContext(HTML, { headers });

describe('security-coop', () => {
  it('warns when the header is absent', async () => {
    expect((await coopRule.run(withHeaders({}))).status).toBe('warn');
  });

  it('warns on unsafe-none, which is the default and isolates nothing', async () => {
    const result = await coopRule.run(withHeaders({ 'cross-origin-opener-policy': 'unsafe-none' }));
    expect(result.status).toBe('warn');
  });

  it('passes on same-origin', async () => {
    const result = await coopRule.run(withHeaders({ 'cross-origin-opener-policy': 'same-origin' }));
    expect(result.status).toBe('pass');
  });

  it('ignores a trailing reporting group', async () => {
    const result = await coopRule.run(
      withHeaders({ 'cross-origin-opener-policy': 'same-origin; report-to="coop"' })
    );
    expect(result.status).toBe('pass');
  });
});

describe('security-csp-xss', () => {
  it('does not double-penalise a missing CSP', async () => {
    // security-csp already reports absence; this rule must stay weightless.
    const result = await cspXssRule.run(withHeaders({}));
    expect(result.weight).toBe(0);
  });

  it("fails on 'unsafe-inline' with no nonce or hash", async () => {
    const result = await cspXssRule.run(
      withHeaders({ 'content-security-policy': "script-src 'self' 'unsafe-inline'" })
    );
    expect(result.status).toBe('fail');
  });

  it("accepts 'unsafe-inline' when a nonce makes it inert", async () => {
    const result = await cspXssRule.run(
      withHeaders({
        'content-security-policy':
          "script-src 'self' 'unsafe-inline' 'nonce-abc123'; object-src 'none'; base-uri 'none'",
      })
    );
    expect(result.status).toBe('pass');
  });

  it('fails on a wildcard script source', async () => {
    const result = await cspXssRule.run(withHeaders({ 'content-security-policy': 'script-src *' }));
    expect(result.status).toBe('fail');
  });

  it('warns on unsafe-eval in an otherwise sound policy', async () => {
    const result = await cspXssRule.run(
      withHeaders({
        'content-security-policy': "script-src 'self' 'unsafe-eval'; object-src 'none'; base-uri 'none'",
      })
    );
    expect(result.status).toBe('warn');
  });

  it('passes a tight policy', async () => {
    const result = await cspXssRule.run(
      withHeaders({
        'content-security-policy': "script-src 'self'; object-src 'none'; base-uri 'none'",
      })
    );
    expect(result.status).toBe('pass');
  });
});

describe('security-info-disclosure', () => {
  it('warns when x-powered-by is present', async () => {
    const result = await infoDisclosureRule.run(withHeaders({ 'x-powered-by': 'PHP/8.1.2' }));
    expect(result.status).toBe('warn');
  });

  it('accepts a Server header with no version', async () => {
    const result = await infoDisclosureRule.run(withHeaders({ server: 'nginx' }));
    expect(result.status).toBe('pass');
  });

  it('warns on a Server header carrying a version', async () => {
    const result = await infoDisclosureRule.run(withHeaders({ server: 'nginx/1.18.0' }));
    expect(result.status).toBe('warn');
  });
});

describe('security-paste-blocking', () => {
  it('fails when an input cancels paste', async () => {
    const ctx = createTestContext('<form><input type="text" onpaste="return false"></form>');
    expect((await pasteBlockingRule.run(ctx)).status).toBe('fail');
  });

  it('calls out password fields specifically', async () => {
    const ctx = createTestContext(
      '<form><input type="password" name="pw" onpaste="event.preventDefault()"></form>'
    );
    const result = await pasteBlockingRule.run(ctx);
    expect(result.message).toContain('password');
  });

  it('allows an onpaste handler that only observes', async () => {
    const ctx = createTestContext('<input type="text" onpaste="analytics.track(\'paste\')">');
    expect((await pasteBlockingRule.run(ctx)).status).toBe('pass');
  });

  it('passes a form with no paste handlers', async () => {
    const ctx = createTestContext('<form><input type="text" name="q"></form>');
    expect((await pasteBlockingRule.run(ctx)).status).toBe('pass');
  });
});

describe('security-trusted-types', () => {
  it('stays weightless when there is no CSP to harden', async () => {
    const result = await trustedTypesRule.run(withHeaders({}));
    expect(result.weight).toBe(0);
  });

  it('warns when a CSP omits Trusted Types', async () => {
    const result = await trustedTypesRule.run(
      withHeaders({ 'content-security-policy': "script-src 'self'" })
    );
    expect(result.status).toBe('warn');
  });

  it('passes when Trusted Types are required', async () => {
    const result = await trustedTypesRule.run(
      withHeaders({
        'content-security-policy': "script-src 'self'; require-trusted-types-for 'script'",
      })
    );
    expect(result.status).toBe('pass');
  });
});
