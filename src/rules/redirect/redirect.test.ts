import { describe, it, expect } from 'vitest';
import { resourceBrokenRedirectRule } from './resource-broken.js';
import { resourceLoopRedirectRule } from './resource-loop.js';
import { resourceChainRedirectRule } from './resource-chain.js';
import { createTestContext } from '../test-context.js';
import type { AssetInfo } from '../../types.js';

function asset(overrides: Partial<AssetInfo> = {}): AssetInfo {
  return {
    url: 'https://example.com/app.js',
    resourceType: 'script',
    statusCode: 200,
    headers: {},
    redirectChain: [],
    redirectLoop: false,
    ...overrides,
  };
}

describe('resourceBrokenRedirectRule', () => {
  it('reports as unmeasured when no render ran', async () => {
    const result = await resourceBrokenRedirectRule.run(createTestContext('<html></html>'));
    expect(result.weight).toBe(0);
    expect(result.status).toBe('not-measured');
  });

  it('passes when no redirected resource ends in an error status', async () => {
    const result = await resourceBrokenRedirectRule.run(
      createTestContext('<html></html>', {
        assets: [
          asset(),
          asset({
            url: 'https://example.com/old.css',
            redirectChain: [{ url: 'http://example.com/old.css', statusCode: 301 }],
          }),
          // A direct 404 with no redirect is js-failed-requests territory, not this rule's
          asset({ url: 'https://example.com/missing.png', resourceType: 'image', statusCode: 404 }),
        ],
      })
    );
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
  });

  it('fails when a redirected resource ends in a 4xx status', async () => {
    const result = await resourceBrokenRedirectRule.run(
      createTestContext('<html></html>', {
        assets: [
          asset({
            url: 'https://example.com/gone.js',
            statusCode: 404,
            redirectChain: [{ url: 'https://example.com/old-gone.js', statusCode: 301 }],
          }),
        ],
      })
    );
    expect(result.status).toBe('fail');
    expect(result.score).toBe(0);
    expect(result.message).toContain('4xx/5xx');
    expect(result.details?.resources).toHaveLength(1);
  });

  it('fails when a redirected resource ends in a 5xx status', async () => {
    const result = await resourceBrokenRedirectRule.run(
      createTestContext('<html></html>', {
        assets: [
          asset({
            url: 'https://cdn.example.com/font.woff2',
            resourceType: 'font',
            statusCode: 503,
            redirectChain: [
              { url: 'https://example.com/font.woff2', statusCode: 301 },
              { url: 'https://cdn.example.com/fonts/font.woff2', statusCode: 302 },
            ],
          }),
        ],
      })
    );
    expect(result.status).toBe('fail');
    expect(result.message).toContain('4xx/5xx');
  });
});

describe('resourceLoopRedirectRule', () => {
  it('reports as unmeasured when no render ran', async () => {
    const result = await resourceLoopRedirectRule.run(createTestContext('<html></html>'));
    expect(result.weight).toBe(0);
    expect(result.status).toBe('not-measured');
  });

  it('passes when no resource loops', async () => {
    const result = await resourceLoopRedirectRule.run(
      createTestContext('<html></html>', {
        assets: [
          asset(),
          asset({
            redirectChain: [
              { url: 'http://example.com/app.js', statusCode: 301 },
              { url: 'https://example.com/app.js', statusCode: 301 },
            ],
          }),
        ],
      })
    );
    expect(result.status).toBe('pass');
  });

  it('fails when a resource loops back to itself', async () => {
    const result = await resourceLoopRedirectRule.run(
      createTestContext('<html></html>', {
        assets: [
          asset({
            url: 'https://example.com/style.css',
            resourceType: 'stylesheet',
            redirectLoop: true,
            redirectChain: [
              { url: 'https://example.com/style.css', statusCode: 302 },
              { url: 'https://example.com/style.css', statusCode: 302 },
            ],
          }),
        ],
      })
    );
    expect(result.status).toBe('fail');
    expect(result.score).toBe(0);
    expect(result.message).toContain('1 page resource(s)');
  });
});

describe('resourceChainRedirectRule', () => {
  it('reports as unmeasured when no render ran', async () => {
    const result = await resourceChainRedirectRule.run(createTestContext('<html></html>'));
    expect(result.weight).toBe(0);
    expect(result.status).toBe('not-measured');
  });

  it('passes on single-hop redirects and direct loads', async () => {
    const result = await resourceChainRedirectRule.run(
      createTestContext('<html></html>', {
        assets: [
          asset(),
          // Single-hop http -> https is normal and must not warn
          asset({
            redirectChain: [{ url: 'http://example.com/app.js', statusCode: 301 }],
          }),
        ],
      })
    );
    expect(result.status).toBe('pass');
    expect(result.details?.singleHopRedirects).toBe(1);
  });

  it('warns when a resource resolves through a multi-hop chain', async () => {
    const result = await resourceChainRedirectRule.run(
      createTestContext('<html></html>', {
        assets: [
          asset({
            url: 'https://cdn.example.com/app.js',
            redirectChain: [
              { url: 'http://example.com/app.js', statusCode: 301 },
              { url: 'https://example.com/app.js', statusCode: 302 },
            ],
          }),
        ],
      })
    );
    expect(result.status).toBe('warn');
    expect(result.score).toBe(50);
    expect(result.details?.chainedCount).toBe(1);
  });

  it('does not double-flag looping resources already failed by redirect-resource-loop', async () => {
    const result = await resourceChainRedirectRule.run(
      createTestContext('<html></html>', {
        assets: [
          asset({
            redirectLoop: true,
            redirectChain: [
              { url: 'https://example.com/a.js', statusCode: 302 },
              { url: 'https://example.com/b.js', statusCode: 302 },
              { url: 'https://example.com/a.js', statusCode: 302 },
            ],
          }),
        ],
      })
    );
    expect(result.status).toBe('pass');
  });
});
