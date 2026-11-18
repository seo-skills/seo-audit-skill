import { describe, expect, it, afterEach, vi } from 'vitest';
import { createTestContext } from './test-context.js';
import { autocompleteRule } from './a11y/autocomplete.js';
import { ariaHiddenBodyRule } from './a11y/aria-hidden-body.js';
import { buttonNameRule } from './a11y/button-name.js';
import { xmlLangMismatchRule } from './a11y/xml-lang-mismatch.js';
import { geoMetaRule } from './eeat/geo-meta.js';
import { agentsMdRule } from './geo/agents-md.js';
import { markdownResponseRule } from './geo/markdown-response.js';
import { rslLicenseRule } from './geo/rsl-license.js';
import { duplicateJsRule } from './perf/duplicate-js.js';
import { sourceMapsRule } from './perf/source-maps.js';
import { brandImpersonationRule } from './security/brand-impersonation.js';
import { obfuscatedScriptRule } from './security/obfuscated-script.js';
import { consentModeRule } from './technical/consent-mode.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('phase 3 page rules', () => {
  it('warns on an unnamed button and passes a named one', async () => {
    const unnamed = await buttonNameRule.run(
      createTestContext('<html><body><button><img src="/i.svg"></button></body></html>')
    );
    const named = await buttonNameRule.run(
      createTestContext('<html><body><button>Save</button></body></html>')
    );
    expect(unnamed.status).toBe('warn');
    expect(named.status).toBe('pass');
  });

  it('warns when an email input has no autocomplete token', async () => {
    const result = await autocompleteRule.run(
      createTestContext('<html><body><input type="email" name="email"></body></html>')
    );
    expect(result.status).toBe('warn');
  });

  it('fails when body is aria-hidden', async () => {
    const result = await ariaHiddenBodyRule.run(
      createTestContext('<html><body aria-hidden="true"><p>Hidden</p></body></html>')
    );
    expect(result.status).toBe('fail');
  });

  it('warns when lang and xml:lang disagree', async () => {
    const result = await xmlLangMismatchRule.run(
      createTestContext('<html lang="en" xml:lang="fr"><body></body></html>')
    );
    expect(result.status).toBe('warn');
  });

  it('warns on local-business schema without geo meta', async () => {
    const html = `<html><body>
      <script type="application/ld+json">{"@type":"LocalBusiness","name":"Cafe"}</script>
    </body></html>`;
    expect((await geoMetaRule.run(createTestContext(html))).status).toBe('warn');
  });

  it('passes a page that is not local', async () => {
    expect((await geoMetaRule.run(createTestContext('<html><body><p>Hi</p></body></html>'))).status).toBe('pass');
  });

  it('warns when jquery is loaded twice', async () => {
    const html = `<html><body>
      <script src="/jquery.min.js"></script>
      <script src="/vendor/jquery-3.6.0.js"></script>
    </body></html>`;
    expect((await duplicateJsRule.run(createTestContext(html))).status).toBe('warn');
  });

  it('warns on a sourceMappingURL comment', async () => {
    const html = '<html><body><script>var a=1;\n//# sourceMappingURL=app.js.map</script></body></html>';
    expect((await sourceMapsRule.run(createTestContext(html))).status).toBe('warn');
  });

  it('warns when a Google tag has no consent update', async () => {
    const html = '<html><body><script src="https://www.googletagmanager.com/gtag/js?id=G-TEST1234"></script></body></html>';
    expect((await consentModeRule.run(createTestContext(html))).status).toBe('warn');
  });

  it('passes when there is no Google tag', async () => {
    expect((await consentModeRule.run(createTestContext('<html></html>'))).status).toBe('pass');
  });

  it('warns when a Google sign-in link leaves the brand and the site', async () => {
    const html = '<html><body><a href="https://evil.example/login">Sign in with Google</a></body></html>';
    expect((await brandImpersonationRule.run(createTestContext(html))).status).toBe('warn');
  });

  it('passes a Google sign-in link that stays on accounts.google.com', async () => {
    const html = '<html><body><a href="https://accounts.google.com/o">Sign in with Google</a></body></html>';
    expect((await brandImpersonationRule.run(createTestContext(html))).status).toBe('pass');
  });

  it('warns on a long eval script and passes a short one', async () => {
    let code = 'eval(';
    for (let i = 0; i < 1800; i++) code += String.fromCharCode(33 + ((i * 17) % 90));
    code += ')';
    const bad = await obfuscatedScriptRule.run(
      createTestContext(`<html><body><script>${code}</script></body></html>`)
    );
    const fine = await obfuscatedScriptRule.run(
      createTestContext('<html><body><script>eval("x")</script></body></html>')
    );
    expect(bad.status).toBe('warn');
    expect(fine.status).toBe('pass');
  });
});

describe('origin probes', () => {
  it('warns when AGENTS.md is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    const result = await agentsMdRule.run(createTestContext('<html></html>'));
    expect(result.status).toBe('warn');
  });

  it('passes when AGENTS.md is plain text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        String(url).endsWith('/AGENTS.md')
          ? new Response('# Agents\n', { status: 200, headers: { 'content-type': 'text/plain' } })
          : new Response('', { status: 404 })
      )
    );
    const result = await agentsMdRule.run(createTestContext('<html></html>'));
    expect(result.status).toBe('pass');
  });

  it('is not measured for a license check without robots.txt', async () => {
    const result = await rslLicenseRule.run(createTestContext('<html></html>'));
    expect(result.status).toBe('not-measured');
  });

  it('passes when robots.txt declares no license', async () => {
    const result = await rslLicenseRule.run(
      createTestContext('<html></html>', { robotsTxtContent: 'User-agent: *\nAllow: /\n' })
    );
    expect(result.status).toBe('pass');
  });

  it('warns when the origin will not serve markdown', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }))
    );
    const result = await markdownResponseRule.run(createTestContext('<html></html>'));
    expect(result.status).toBe('warn');
  });
});
