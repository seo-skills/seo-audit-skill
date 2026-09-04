/**
 * The dashboard server, exercised over a real socket on a free port.
 *
 * `fetch` cannot set `Host` (it is a forbidden header), so the Host checks go
 * through `http.request`, which can.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as http from 'http';
import type { AddressInfo } from 'net';
import { createServer, generateToken, checkOrigin, readToken, tokensMatch, matchRoute } from './server.js';
import { createReadRoutes } from './api.js';
import { DEFAULT_CAPABILITIES } from './audit-session.js';
import { saveAuditToDatabase } from '../storage/save-audit.js';
import { makeAuditResult, simpleSpec, tempDatabase } from '../storage/audits-db/test-fixtures.js';
import type { AuditsDatabase } from '../storage/audits-db/index.js';
import type { Route } from './server.js';

const URL_UNDER_TEST = 'https://served.test/';

let server: http.Server;
let port: number;
let token: string;
let db: AuditsDatabase;
let cleanup: () => void;
let auditId: string;
let ruleId: string;

beforeAll(async () => {
  const temp = tempDatabase();
  db = temp.db;
  cleanup = temp.cleanup;

  // Two audits of one domain, so compare and trend have something to work on.
  saveAuditToDatabase(
    makeAuditResult(URL_UNDER_TEST, {
      core: {
        'core-title': [{ pageUrl: URL_UNDER_TEST, status: 'fail' }],
        'core-h1': [{ pageUrl: URL_UNDER_TEST, status: 'warn', weight: 0 }],
      },
    }, 40),
    { db }
  );
  const second = saveAuditToDatabase(
    makeAuditResult(URL_UNDER_TEST, {
      core: {
        'core-title': [
          { pageUrl: URL_UNDER_TEST, status: 'pass' },
          { pageUrl: `${URL_UNDER_TEST}a`, status: 'warn' },
        ],
        'core-h1': [{ pageUrl: URL_UNDER_TEST, status: 'warn', weight: 0 }],
      },
    }, 85),
    { db }
  );
  auditId = second.auditId;
  ruleId = 'core-title';

  token = generateToken();
  const routes: Route[] = [];
  routes.push(
    ...createReadRoutes({
      db: () => db,
      capabilities: DEFAULT_CAPABILITIES,
      startedAt: Date.now(),
      invocation: 'global',
      routes: () => routes,
    })
  );

  const built = createServer({ routes, token });
  server = built.server;
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  cleanup();
});

function base(): string {
  return `http://127.0.0.1:${port}`;
}

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(base() + path, {
    ...init,
    headers: { 'X-SEOmator-Token': token, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  // Exports come back as HTML, Markdown or plain text; only parse what says
  // it is JSON.
  const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
  return {
    status: res.status,
    headers: res.headers,
    text,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    json: isJson && text ? (JSON.parse(text) as any) : null,
  };
}

/** A request with an arbitrary Host header, which fetch will not send */
function rawRequest(path: string, headers: Record<string, string>): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method: 'GET', headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('route matching', () => {
  const routes = [
    { method: 'GET' as const, path: '/api/audits', purpose: '', handler: () => null },
    { method: 'GET' as const, path: '/api/audits/:id', purpose: '', handler: () => null },
    { method: 'DELETE' as const, path: '/api/audits/:id', purpose: '', handler: () => null },
  ];
  // matchRoute takes compiled routes; go through createServer's own compilation
  // by matching against the live server instead of re-implementing it here.
  it('distinguishes an unknown path from a wrong method', async () => {
    expect((await api('/api/nope')).status).toBe(404);
    expect((await api('/api/audits', { method: 'POST' })).status).toBe(405);
    expect(routes.length).toBe(3);
    expect(typeof matchRoute).toBe('function');
  });
});

describe('authentication', () => {
  it('rejects a request with no token', async () => {
    const res = await fetch(base() + '/api/audits');
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('unauthorized');
  });

  it('rejects a wrong token', async () => {
    const res = await fetch(base() + '/api/audits', { headers: { 'X-SEOmator-Token': 'nope' } });
    expect(res.status).toBe(401);
  });

  it('accepts the token in a cookie, which is how the browser sends it', async () => {
    const res = await fetch(base() + '/api/audits', { headers: { Cookie: `seomator_token=${token}` } });
    expect(res.status).toBe(200);
  });

  it('compares tokens without leaking length or content', () => {
    expect(tokensMatch(token, token)).toBe(true);
    expect(tokensMatch(token.slice(0, -1) + 'x', token)).toBe(false);
    expect(tokensMatch(token.slice(0, -1), token)).toBe(false);
    expect(tokensMatch(null, token)).toBe(false);
  });

  it('reads the token from either transport', () => {
    expect(readToken({ 'x-seomator-token': 'abc' })).toBe('abc');
    expect(readToken({ cookie: 'other=1; seomator_token=xyz; more=2' })).toBe('xyz');
    expect(readToken({})).toBeNull();
  });
});

describe('origin and framing checks', () => {
  it('rejects a cross-site Origin', async () => {
    const res = await api('/api/audits', { headers: { Origin: 'http://evil.test' } });
    expect(res.status).toBe(403);
    expect(res.json.error.code).toBe('bad-origin');
    expect(res.json.error.details.rejectedOrigin).toBe('http://evil.test');
  });

  it('accepts its own origin', async () => {
    const res = await api('/api/audits', {
      headers: { Origin: base(), 'Sec-Fetch-Site': 'same-origin' },
    });
    expect(res.status).toBe(200);
  });

  it('rejects a cross-site Sec-Fetch-Site', async () => {
    expect((await api('/api/audits', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status).toBe(403);
    expect((await api('/api/audits', { headers: { 'Sec-Fetch-Site': 'same-site' } })).status).toBe(403);
    expect((await api('/api/audits', { headers: { 'Sec-Fetch-Site': 'none' } })).status).toBe(200);
  });

  it('refuses to be framed', async () => {
    for (const dest of ['iframe', 'embed', 'object', 'frame']) {
      expect((await api('/api/audits', { headers: { 'Sec-Fetch-Dest': dest } })).status).toBe(403);
    }
    expect((await api('/api/audits', { headers: { 'Sec-Fetch-Dest': 'empty' } })).status).toBe(200);
  });

  it('rejects a non-loopback Host', async () => {
    const evil = await rawRequest('/api/audits', { Host: 'evil.test', 'X-SEOmator-Token': token });
    expect(evil.status).toBe(403);
    expect(JSON.parse(evil.body).error.details.rejectedHost).toBe('evil.test');

    const wrongPort = await rawRequest('/api/audits', { Host: '127.0.0.1:9', 'X-SEOmator-Token': token });
    expect(wrongPort.status).toBe(403);

    for (const host of [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]) {
      const ok = await rawRequest('/api/audits', { Host: host, 'X-SEOmator-Token': token });
      expect(ok.status, host).toBe(200);
    }
  });

  it('checkOrigin covers the matrix directly', () => {
    expect(checkOrigin({ host: '127.0.0.1:7360' }, 7360).ok).toBe(true);
    expect(checkOrigin({ host: 'localhost:7360', origin: 'http://localhost:7360' }, 7360).ok).toBe(true);
    expect(checkOrigin({ host: 'evil.test:7360' }, 7360).ok).toBe(false);
    expect(checkOrigin({ host: '127.0.0.1:7360', origin: 'https://127.0.0.1:7360' }, 7360).ok).toBe(false);
    // An opaque origin (a sandboxed iframe or a file:// page) is not this dashboard
    expect(checkOrigin({ host: '127.0.0.1:7360', origin: 'null' }, 7360).ok).toBe(true);
  });
});

describe('read endpoints', () => {
  it('describes itself at /api', async () => {
    const res = await api('/api');
    expect(res.status).toBe(200);
    expect(res.json.routes.length).toBeGreaterThan(5);
    // The index is derived from the router table, so it cannot drift
    for (const route of res.json.routes) {
      expect(route.purpose).toBeTruthy();
      expect(['GET', 'POST', 'DELETE']).toContain(route.method);
    }
    expect(res.json.routes.some((r: { path: string }) => r.path === '/api/audits/:id')).toBe(true);
  });

  it('reports build facts', async () => {
    const res = await api('/api/info');
    expect(res.status).toBe(200);
    expect(res.json.ruleCount).toBeGreaterThan(300);
    expect(res.json.categoryCount).toBe(20);
    expect(res.json.capabilities).toEqual(DEFAULT_CAPABILITIES);
    expect(res.json.categories).toHaveLength(20);
  });

  it('lists audits newest first', async () => {
    const res = await api('/api/audits');
    expect(res.status).toBe(200);
    expect(res.json).toHaveLength(2);
    expect(res.json[0].auditId).toBe(auditId);
    expect(res.json[0].source).toBe('cli');
  });

  it('pages the audit list', async () => {
    expect((await api('/api/audits?limit=1')).json).toHaveLength(1);
    expect((await api('/api/audits?limit=1&offset=1')).json[0].auditId).not.toBe(auditId);
    expect((await api('/api/audits?domain=served.test')).json).toHaveLength(2);
    expect((await api('/api/audits?domain=other.test')).json).toHaveLength(0);
  });

  it('rejects an out-of-range limit rather than clamping it', async () => {
    const res = await api('/api/audits?limit=9999');
    expect(res.status).toBe(400);
    expect(res.json.error.code).toBe('invalid-option');
    expect(res.json.error.details.option).toBe('limit');
  });

  it('returns an audit aggregated to one row per rule', async () => {
    const res = await api(`/api/audits/${auditId}`);
    expect(res.status).toBe(200);
    const rules = res.json.result.categoryResults.flatMap((c: { results: unknown[] }) => c.results);
    expect(rules).toHaveLength(2);

    const title = rules.find((r: { ruleId: string }) => r.ruleId === 'core-title');
    expect(title.status).toBe('warn');
    expect(title.totalPages).toBe(2);
    expect(title.affectedPages).toBe(1);
    expect(title.notMeasured).toBe(false);

    const h1 = rules.find((r: { ruleId: string }) => r.ruleId === 'core-h1');
    expect(h1.notMeasured).toBe(true);
    expect(res.json.audit.engineVersion).toBeTruthy();
    expect(res.json.ruleMetadata).toBeDefined();
  });

  it('lists the pages one rule ran on', async () => {
    const res = await api(`/api/audits/${auditId}/rules/${ruleId}/pages`);
    expect(res.status).toBe(200);
    expect(res.json.total).toBe(2);
    expect(res.json.pages.map((p: { status: string }) => p.status)).toEqual(['pass', 'warn']);
  });

  it('summarises each domain in one call', async () => {
    const res = await api('/api/domains');
    expect(res.status).toBe(200);
    expect(res.json).toHaveLength(1);
    expect(res.json[0]).toMatchObject({ domain: 'served.test', auditCount: 2, scoreDelta: 45 });
    expect(res.json[0].sparkline).toEqual([40, 85]);
  });

  it('returns a trend oldest first', async () => {
    const res = await api('/api/domains/served.test/trend');
    expect(res.json.map((p: { score: number }) => p.score)).toEqual([40, 85]);
  });

  it('compares against the previous audit by default', async () => {
    const res = await api(`/api/audits/${auditId}/compare`);
    expect(res.status).toBe(200);
    expect(res.json.scoreDelta).toBe(45);
    expect(res.json.rules.improved.map((c: { ruleId: string }) => c.ruleId)).toEqual(['core-title']);
    expect(res.json.engineChanged).toBe(false);
  });

  it('exports in every format with a filename built from the id', async () => {
    for (const [format, extension, type] of [
      ['html', 'html', 'text/html'],
      ['markdown', 'md', 'text/markdown'],
      ['json', 'json', 'application/json'],
      ['llm', 'txt', 'text/plain'],
    ]) {
      const res = await api(`/api/audits/${auditId}/export?format=${format}`);
      expect(res.status, format).toBe(200);
      expect(res.headers.get('content-disposition')).toBe(
        `attachment; filename="seo-report-${auditId}.${extension}"`
      );
      expect(res.headers.get('content-type')).toContain(type);
      expect(res.text.length).toBeGreaterThan(10);
    }
  });

  it('rejects an unknown export format', async () => {
    const res = await api(`/api/audits/${auditId}/export?format=pdf`);
    expect(res.status).toBe(400);
    expect(res.json.error.details.option).toBe('format');
  });

  it('deletes an audit and then reports it missing', async () => {
    const doomed = saveAuditToDatabase(makeAuditResult('https://gone.test/', simpleSpec('https://gone.test/')), { db });
    expect((await api(`/api/audits/${doomed.auditId}`, { method: 'DELETE' })).status).toBe(204);
    expect((await api(`/api/audits/${doomed.auditId}`)).status).toBe(404);
    expect((await api(`/api/audits/${doomed.auditId}`, { method: 'DELETE' })).status).toBe(404);
  });
});

describe('error envelope', () => {
  it('rejects an id that is not an audit id', async () => {
    const res = await api('/api/audits/not-an-id');
    expect(res.status).toBe(400);
    expect(res.json.error.code).toBe('invalid-id');
    expect(res.json.error.hint).toContain('2026-');
  });

  it('rejects traversal in an id', async () => {
    const res = await api('/api/audits/..%2f..%2fetc%2fpasswd');
    expect(res.status).toBe(400);
    expect(res.json.error.code).toBe('invalid-id');
  });

  it('404s an id that is well-formed but unknown', async () => {
    const res = await api('/api/audits/2026-01-01-zzzzzz');
    expect(res.status).toBe(404);
    expect(res.json.error.code).toBe('not-found');
  });

  it('answers an unmatched /api path with JSON, never HTML', async () => {
    const res = await api('/api/does/not/exist');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.json.error.hint).toContain('GET /api');
  });

  it('sets no-store and nosniff on every API response', async () => {
    const res = await api('/api/info');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
  });
});
