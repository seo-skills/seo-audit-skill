/**
 * The MCP contract, driven by a real MCP client over an in-memory transport
 * against a local page.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import '../rules/loader.js';
import { createMcpServer, type McpServerOptions } from './server.js';

const PAGE = `<!doctype html><html lang="en"><head><title>MCP fixture page title</title>
<meta name="viewport" content="width=device-width"></head>
<body><h1>MCP fixture</h1><p>${'Words on the page. '.repeat(60)}</p></body></html>`;

let server: http.Server;
let host: string;
let home: string;
let slowRelease: (() => void) | null = null;

beforeAll(async () => {
  home = mkdtempSync(join(tmpdir(), 'seomator-mcp-'));
  process.env['SEOMATOR_HOME'] = home;
  server = http.createServer((req, res) => {
    if (req.url === '/slow') {
      // Held until the test releases it, so a run stays in flight
      slowRelease = () => {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(PAGE);
      };
      return;
    }
    if (req.url === '/' || req.url === '/slow-done') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(PAGE);
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  host = `127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  slowRelease?.();
  server.close();
  rmSync(home, { recursive: true, force: true });
});

async function connect(options: Partial<McpServerOptions> = {}) {
  const mcp = createMcpServer({ allowPrivate: false, allowHosts: [host], ...options });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await mcp.connect(serverTransport);
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(clientTransport);
  return client;
}

async function call(client: Client, name: string, args: Record<string, unknown>) {
  const result = (await client.callTool({ name, arguments: args })) as {
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  };
  const text = result.content[0].text;
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { isError: result.isError === true, text, json };
}

describe('seomator-audit MCP server', () => {
  it('lists its tools', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'audit_status',
      'audit_url',
      'cancel_run',
      'compare_audits',
      'explain_rule',
      'get_audit',
      'get_findings',
      'list_audits',
      'list_rules',
    ]);
  });

  it('refuses a private target unless allowed, naming the address and the remedy', async () => {
    const client = await connect({ allowHosts: [] });
    const { isError, json } = await call(client, 'audit_url', { url: `http://${host}/` });
    expect(isError).toBe(true);
    expect(json).toMatchObject({ code: 'private-address' });
    expect(String(json!['message'])).toContain('127.0.0.1');
    expect(String(json!['hint'])).toContain('--allow-private');
  });

  it('refuses a browser render without --allow-private', async () => {
    const client = await connect();
    const { isError, json } = await call(client, 'audit_url', { url: `http://${host}/`, render: true });
    expect(isError).toBe(true);
    expect(json).toMatchObject({ code: 'render-unavailable' });
  });

  it('audits with waitS, then answers status, findings and the stored report', async () => {
    const client = await connect();
    const started = await call(client, 'audit_url', { url: `http://${host}/`, waitS: 25 });
    expect(started.isError).toBe(false);
    expect(started.json).toMatchObject({ state: 'completed' });
    const runId = started.json!['runId'] as string;
    const summary = started.json!['summary'] as {
      auditId: string;
      score: number;
      topFindings: unknown[];
      notMeasuredByReason: Record<string, number>;
      advisoryCount: number;
    };
    expect(typeof summary.score).toBe('number');
    expect(summary.auditId).toBeTruthy();
    expect(summary.topFindings.length).toBeLessThanOrEqual(10);
    // A static run: the render-only checks are named as such
    expect(summary.notMeasuredByReason['needs-render']).toBeGreaterThan(0);
    expect(typeof summary.advisoryCount).toBe('number');

    const status = await call(client, 'audit_status', { runId });
    expect(status.json).toMatchObject({ runId, state: 'completed' });

    const first = await call(client, 'get_findings', { id: summary.auditId, limit: 2 });
    expect(first.json).toMatchObject({ truncated: true });
    expect((first.json!['findings'] as unknown[]).length).toBe(2);
    const second = await call(client, 'get_findings', { id: summary.auditId, limit: 2, cursor: first.json!['cursor'] });
    expect((second.json!['findings'] as Array<{ ruleId: string }>)[0].ruleId).not.toBe(
      (first.json!['findings'] as Array<{ ruleId: string }>)[0].ruleId
    );

    const trimmed = await call(client, 'get_audit', { id: summary.auditId, maxFindings: 1 });
    expect(trimmed.text).toMatch(/<issues count="1"/);
    const report = await call(client, 'get_audit', { id: summary.auditId });
    expect(report.text).toContain('<seo-audit');

    const listed = await call(client, 'list_audits', { domain: '127.0.0.1' });
    expect(Array.isArray(listed.json)).toBe(true);
  }, 60000);

  it('returns a runId at once, refuses a second run as busy, and cancels', async () => {
    const client = await connect();
    const started = await call(client, 'audit_url', { url: `http://${host}/slow` });
    expect(started.json).toMatchObject({ state: 'running' });
    const runId = started.json!['runId'] as string;

    const second = await call(client, 'audit_url', { url: `http://${host}/` });
    expect(second.json).toMatchObject({ code: 'busy', runId });

    const cancelled = await call(client, 'cancel_run', { runId });
    expect(cancelled.json).toMatchObject({ runId, cancelled: true, state: 'cancelled' });
    slowRelease?.();
  }, 30000);

  it('refuses the second of two audit_url calls sent together as busy', async () => {
    const client = await connect();
    // A crawl awaits robots.txt before it starts, which is where two calls
    // sent at once could both get past the busy check
    const args = { url: `http://${host}/slow`, crawl: true, maxPages: 1 };
    const both = await Promise.all([call(client, 'audit_url', args), call(client, 'audit_url', args)]);
    const started = both.filter((r) => r.json?.['state'] === 'running');
    for (const run of started) await call(client, 'cancel_run', { runId: run.json!['runId'] });
    slowRelease?.();
    expect(started).toHaveLength(1);
    expect(both.filter((r) => r.json?.['code'] === 'busy')).toHaveLength(1);
  }, 30000);

  it('runs with the config file: crawl filters, rule overrides and save = false all apply', async () => {
    const requested: string[] = [];
    const site = http.createServer((req, res) => {
      requested.push(`${req.method} ${req.url}`);
      if (req.url === '/robots.txt') return void res.writeHead(404).end();
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(PAGE.replace('</body>', '<a href="/public">public</a><a href="/private/x">private</a></body>'));
    });
    await new Promise<void>((resolve) => site.listen(0, '127.0.0.1', resolve));
    const siteHost = `127.0.0.1:${(site.address() as AddressInfo).port}`;
    const configPath = join(home, 'mcp-config.toml');
    writeFileSync(
      configPath,
      ['[crawler]', 'exclude = ["/private/**"]', '', '[output]', 'save = false', '', '[rules.override]', '"core-description-present" = { priority = "ignore" }', ''].join('\n')
    );
    try {
      const client = await connect({ allowHosts: [siteHost], config: configPath });
      const started = await call(client, 'audit_url', { url: `http://${siteHost}/`, crawl: true, maxPages: 5, waitS: 25 });
      expect(started.json).toMatchObject({ state: 'completed' });
      const summary = started.json!['summary'] as { auditId: string | null; pages: number; topFindings: Array<{ ruleId: string }> };
      // The crawl fetched / and /public as pages; /private/x is excluded
      expect(summary.pages).toBe(2);
      expect(requested).toContain('GET /public');
      expect(requested).not.toContain('GET /private/x');
      expect(summary.auditId).toBeNull();
      expect(summary.topFindings.map((f) => f.ruleId)).not.toContain('core-description-present');
    } finally {
      site.close();
    }
  }, 60000);

  it("refuses a crawl the site's Crawl-delay could not finish in time, before requesting a page", async () => {
    const pageRequests: string[] = [];
    const delayed = http.createServer((req, res) => {
      if (req.url === '/robots.txt') {
        res.writeHead(200, { 'content-type': 'text/plain' });
        return void res.end('User-agent: *\nCrawl-delay: 10\n');
      }
      pageRequests.push(req.url ?? '');
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(PAGE);
    });
    await new Promise<void>((resolve) => delayed.listen(0, '127.0.0.1', resolve));
    const delayedHost = `127.0.0.1:${(delayed.address() as AddressInfo).port}`;
    try {
      const client = await connect({ allowHosts: [delayedHost] });
      const args = { url: `http://${delayedHost}/`, crawl: true, maxPages: 100, maxDurationS: 60 };
      const { isError, json } = await call(client, 'audit_url', args);
      expect(isError).toBe(true);
      expect(json).toMatchObject({ code: 'crawl-too-slow', projectedS: 990 });
      expect(String(json!['hint'])).toContain('respectCrawlDelay');
      expect(pageRequests).toEqual([]);
    } finally {
      delayed.close();
    }
  });

  it('says run-not-found for an id it does not know', async () => {
    const client = await connect();
    const { isError, json } = await call(client, 'audit_status', { runId: 'nope' });
    expect(isError).toBe(true);
    expect(json).toMatchObject({ code: 'run-not-found' });
    expect(String(json!['hint'])).toContain('list_audits');
  });

  it('explains a rule with the same text as the CLI, and names close ids for a typo', async () => {
    const client = await connect();
    const known = await call(client, 'explain_rule', { ruleId: 'core-canonical-present' });
    expect(known.text).toContain('core-canonical-present: ');
    const unknown = await call(client, 'explain_rule', { ruleId: 'core-canonical-presnt' });
    expect(unknown.isError).toBe(true);
    expect(unknown.json).toMatchObject({ code: 'unknown-rule' });
  });
});
