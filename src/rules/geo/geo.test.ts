import { describe, it, expect, vi, afterEach } from 'vitest';
import { aiBotAccessRule } from './ai-bot-access.js';
import type { AuditContext } from '../../types.js';
import * as cheerio from 'cheerio';

const HTML = '<html><body><p>Fixture</p></body></html>';

function createContext(): AuditContext {
  return {
    url: 'https://example.com/',
    html: HTML,
    $: cheerio.load(HTML),
    headers: {},
    links: [],
    images: [],
    statusCode: 200,
    responseTime: 100,
    cwv: {},
    invalidLinks: [],
    specialLinks: [],
    figures: [],
    inlineSvgs: [],
    pictureElements: [],
  };
}

/** Serve the given robots.txt to the rule's own fetch */
function stubRobotsTxt(body: string | null): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      body === null
        ? new Response('', { status: 404 })
        : new Response(body, { status: 200, headers: { 'content-type': 'text/plain' } })
    )
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('aiBotAccessRule', () => {
  it('passes when robots.txt allows everything', async () => {
    stubRobotsTxt('User-agent: *\nDisallow:\n');
    const result = await aiBotAccessRule.run(createContext());
    expect(result.status).toBe('pass');
  });

  it('flags a site that blocks current answer engines while allowing GPTBot', async () => {
    // Regression: the old bot list knew only the retired anthropic-ai and
    // Claude-Web, so a site blocking ClaudeBot and OAI-SearchBot scored a
    // clean pass while being invisible to ChatGPT search and Claude.
    stubRobotsTxt(
      [
        'User-agent: ClaudeBot',
        'Disallow: /',
        '',
        'User-agent: OAI-SearchBot',
        'Disallow: /',
        '',
        'User-agent: GPTBot',
        'Allow: /',
      ].join('\n')
    );

    const result = await aiBotAccessRule.run(createContext());
    expect(result.status).toBe('warn');
    expect(result.details?.blockedCitationBots).toEqual(
      expect.arrayContaining(['ClaudeBot', 'OAI-SearchBot'])
    );
  });

  it('does not penalise blocking training-only crawlers', async () => {
    // Opting out of model training is a policy choice, not an SEO defect.
    stubRobotsTxt(
      [
        'User-agent: GPTBot',
        'Disallow: /',
        '',
        'User-agent: CCBot',
        'Disallow: /',
        '',
        'User-agent: Applebot-Extended',
        'Disallow: /',
      ].join('\n')
    );

    const result = await aiBotAccessRule.run(createContext());
    expect(result.status).toBe('pass');
    expect(result.details?.blockedTrainingBots).toEqual(
      expect.arrayContaining(['GPTBot', 'CCBot', 'Applebot-Extended'])
    );
    expect(result.details?.blockedCitationBots).toEqual([]);
  });

  it('fails when a blanket wildcard disallow blocks every answer engine', async () => {
    stubRobotsTxt('User-agent: *\nDisallow: /\n');
    const result = await aiBotAccessRule.run(createContext());
    expect(result.status).toBe('fail');
  });

  it('passes when robots.txt is missing', async () => {
    stubRobotsTxt(null);
    const result = await aiBotAccessRule.run(createContext());
    expect(result.status).toBe('pass');
  });
});
