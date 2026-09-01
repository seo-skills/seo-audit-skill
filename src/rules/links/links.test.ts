import { describe, it, expect } from 'vitest';
import { nonHttpProtocolRule } from './non-http-protocol.js';
import type { AuditContext } from '../../types.js';
import { createTestContext } from '../test-context.js';

// Helper to create minimal AuditContext
function createContext(html: string): AuditContext {
  return createTestContext(html);
}

describe('nonHttpProtocolRule', () => {
  it('should pass when all links use HTTP(S)', async () => {
    const html = `<html><body>
      <a href="https://example.com/page">Internal</a>
      <a href="https://other.com/">External</a>
      <a href="/relative/path">Relative</a>
      <a href="#fragment">Fragment</a>
    </body></html>`;
    const result = await nonHttpProtocolRule.run(createContext(html));
    expect(result.status).toBe('pass');
  });

  it('should pass for tel: and mailto: links (handled by links-tel-mailto)', async () => {
    const html = `<html><body>
      <a href="tel:+1234567890">Call us</a>
      <a href="mailto:info@example.com">Email us</a>
    </body></html>`;
    const result = await nonHttpProtocolRule.run(createContext(html));
    expect(result.status).toBe('pass');
  });

  it('should pass when there are no links', async () => {
    const result = await nonHttpProtocolRule.run(
      createContext('<html><body><p>No links</p></body></html>')
    );
    expect(result.status).toBe('pass');
    expect(result.details?.totalLinksChecked).toBe(0);
  });

  it('should warn for ftp: links', async () => {
    const html = `<html><body>
      <a href="ftp://files.example.com/archive.zip">Download</a>
    </body></html>`;
    const result = await nonHttpProtocolRule.run(createContext(html));
    expect(result.status).toBe('warn');
    expect(result.details?.nonHttpLinkCount).toBe(1);
    expect(result.details?.protocols).toEqual(['ftp']);
  });

  it('should warn for file:, intent: and chrome: links', async () => {
    const html = `<html><body>
      <a href="file:///Users/dev/report.pdf">Local file</a>
      <a href="intent://scan/#Intent;scheme=zxing;end">Scan</a>
      <a href="chrome://extensions">Extensions</a>
    </body></html>`;
    const result = await nonHttpProtocolRule.run(createContext(html));
    expect(result.status).toBe('warn');
    expect(result.details?.nonHttpLinkCount).toBe(3);
    expect(result.details?.protocols).toEqual(['file', 'intent', 'chrome']);
  });

  it('should not flag javascript: links (covered by links-invalid-links)', async () => {
    const html = `<html><body>
      <a href="javascript:void(0)">Click</a>
    </body></html>`;
    const result = await nonHttpProtocolRule.run(createContext(html));
    expect(result.status).toBe('pass');
  });
});
