/**
 * A private target that redirects to another private host: the entry chain's
 * hops are pinned, so a local or intranet audit reaches the page asked for.
 */
import { describe, it, expect, vi, afterAll } from 'vitest';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';

// sibling.test is another private machine; everything else resolves for real
vi.mock('node:dns/promises', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:dns/promises')>();
  return {
    ...real,
    lookup: (async (host: string, options: unknown) =>
      host === 'sibling.test' ? [{ address: '10.1.2.3', family: 4 }] : real.lookup(host, options as never)) as typeof real.lookup,
  };
});

const { policyForTarget } = await import('./policy.js');
const { pinEntryRedirects } = await import('./fetch.js');

const servers: http.Server[] = [];
afterAll(() => servers.forEach((s) => s.close()));

async function serve(handler: http.RequestListener): Promise<number> {
  const server = http.createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return (server.address() as AddressInfo).port;
}

describe('pinEntryRedirects', () => {
  it('pins a private host the entry page redirects to', async () => {
    const port = await serve((_req, res) => {
      res.writeHead(301, { location: 'http://sibling.test/landing' });
      res.end();
    });
    const target = `http://127.0.0.1:${port}/`;
    const policy = await pinEntryRedirects(target, await policyForTarget(target, 'auto'), 300);
    expect(policy.pinnedHosts?.get('sibling.test')).toEqual(['10.1.2.3']);
    expect(policy.pinnedHosts?.get('127.0.0.1')).toEqual(['127.0.0.1']);
  });

  it('pins nothing for a public target, and nothing a later page links to', async () => {
    const port = await serve((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<a href="http://sibling.test/">elsewhere</a>');
    });
    const target = `http://127.0.0.1:${port}/`;
    const policy = await pinEntryRedirects(target, await policyForTarget(target, 'auto'), 300);
    expect([...(policy.pinnedHosts?.keys() ?? [])]).toEqual(['127.0.0.1']);
    const pub = await policyForTarget('http://93.184.215.14/', 'auto');
    expect(await pinEntryRedirects('http://93.184.215.14/', pub, 300)).toBe(pub);
  });
});
