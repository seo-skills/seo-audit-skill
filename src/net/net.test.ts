import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { isBlockedAddress } from './address.js';
import {
  netFetch,
  readBodyCapped,
  readTextPrefix,
  BodyTooLargeError,
  isPrivateAddressError,
} from './fetch.js';
import { runWithNetPolicy, policyForTarget, type NetPolicy } from './policy.js';
import { classifyError } from '../errors.js';

describe('isBlockedAddress', () => {
  it.each([
    '127.0.0.1',
    '127.255.0.9',
    '0.0.0.0',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '224.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:169.254.169.254',
    '64:ff9b::7f00:1',
    '64:ff9b:1::a',
    '::ffff:0:7f00:1',
    '2002:7f00:1::1',
    '2002:a9fe:a9fe::1',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'fe80::1%en0',
    'ff02::1',
    '[::1]',
    'not-an-ip',
  ])('blocks %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '172.32.0.1', '93.184.215.14', '2606:4700:4700::1111', '::ffff:8.8.8.8', '2002:808:808::1'])(
    'allows public %s',
    (ip) => {
      expect(isBlockedAddress(ip)).toBe(false);
    }
  );
});

const STRICT: NetPolicy = { blockPrivate: true, allowHosts: new Set() };

describe('isMetadataAddress', () => {
  it.each([
    '169.254.169.254',
    '::ffff:169.254.169.254',
    '::169.254.169.254',
    '64:ff9b::a9fe:a9fe',
    '::ffff:0:169.254.169.254',
    '2002:a9fe:a9fe::1',
    'fe80::1',
    '[fe80::1]',
    'fd00:ec2::254',
    '100.100.100.200',
    '::ffff:100.100.100.200',
    '192.0.0.192',
    '64:ff9b:1::a9fe:a9fe',
  ])('is true for %s, a metadata or link-local address in any spelling', async (ip) => {
    const { isMetadataAddress } = await import('./address.js');
    expect(isMetadataAddress(ip)).toBe(true);
  });

  it.each(['10.0.0.1', '127.0.0.1', '::1', 'fd00::1', '::ffff:10.0.0.1', '93.184.215.14'])(
    'is false for %s',
    async (ip) => {
      const { isMetadataAddress } = await import('./address.js');
      expect(isMetadataAddress(ip)).toBe(false);
    }
  );
});

describe('netFetch under a blocking policy', () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/to-localhost') {
        // A private target redirecting to another name for the same machine
        res.writeHead(301, { location: `http://localhost:${port}/ok` });
        res.end();
        return;
      }
      if (req.url === '/hop') {
        // Redirect to the same server through a different, private-only name
        res.writeHead(302, { location: `http://127.0.0.1:${port}/ok` });
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(() => {
    server.close();
  });

  it('refuses an IP literal that skips the resolver', async () => {
    await expect(runWithNetPolicy(STRICT, () => netFetch(`http://127.0.0.1:${port}/ok`))).rejects.toSatisfy(
      isPrivateAddressError
    );
  });

  it('refuses a hostname that resolves to loopback, checked at lookup', async () => {
    await expect(runWithNetPolicy(STRICT, () => netFetch(`http://localhost:${port}/ok`))).rejects.toSatisfy(
      isPrivateAddressError
    );
  });

  it('refuses a decimal spelling of 127.0.0.1', async () => {
    await expect(runWithNetPolicy(STRICT, () => netFetch(`http://2130706433:${port}/ok`))).rejects.toSatisfy(
      isPrivateAddressError
    );
  });

  it('refuses a redirect hop to a private address', async () => {
    // localhost:port is allowed, so the first request connects; the hop to the
    // 127.0.0.1 spelling is a new connection and is refused.
    const policy: NetPolicy = { blockPrivate: true, allowHosts: new Set([`localhost:${port}`]) };
    await expect(runWithNetPolicy(policy, () => netFetch(`http://localhost:${port}/hop`))).rejects.toSatisfy(
      isPrivateAddressError
    );
  });

  it('lets an allow-listed host through', async () => {
    const policy: NetPolicy = { blockPrivate: true, allowHosts: new Set([`127.0.0.1:${port}`]) };
    const response = await runWithNetPolicy(policy, () => netFetch(`http://127.0.0.1:${port}/ok`));
    expect(await response.text()).toBe('ok');
  });

  it('is the plain platform fetch outside any blocking policy', async () => {
    const response = await netFetch(`http://127.0.0.1:${port}/ok`);
    expect(response.status).toBe(200);
  });

  it('reaches a pinned host at its pinned addresses, without asking DNS again', async () => {
    // rebind.test resolves nowhere: the request can only succeed through the pin,
    // which is what keeps a later DNS answer from moving the audited host
    const policy: NetPolicy = { blockPrivate: true, allowHosts: new Set(), pinnedHosts: new Map([['rebind.test', ['127.0.0.1']]]) };
    const response = await runWithNetPolicy(policy, () => netFetch(`http://rebind.test:${port}/ok`));
    expect(await response.text()).toBe('ok');
  });

  it('reaches a pinned address written as an IP literal, and refuses every other private address', async () => {
    const policy: NetPolicy = { blockPrivate: true, allowHosts: new Set(), pinnedHosts: new Map([['localhost', ['127.0.0.1']]]) };
    const response = await runWithNetPolicy(policy, () => netFetch(`http://127.0.0.1:${port}/ok`));
    expect(response.status).toBe(200);
    await expect(runWithNetPolicy(policy, () => netFetch('http://169.254.169.254/latest/meta-data/'))).rejects.toSatisfy(
      isPrivateAddressError
    );
  });

  it('follows a pinned target redirecting to another name for a pinned address', async () => {
    // localhost resolves to ::1 and 127.0.0.1; only the pinned 127.0.0.1 is used
    const policy: NetPolicy = { blockPrivate: true, allowHosts: new Set(), pinnedHosts: new Map([['127.0.0.1', ['127.0.0.1']]]) };
    const response = await runWithNetPolicy(policy, () => netFetch(`http://127.0.0.1:${port}/to-localhost`));
    expect(response.status).toBe(200);
  });

  it('still refuses a hostname whose private addresses are not pinned', async () => {
    const policy: NetPolicy = { blockPrivate: true, allowHosts: new Set(), pinnedHosts: new Map([['intranet.test', ['10.255.255.1']]]) };
    await expect(runWithNetPolicy(policy, () => netFetch(`http://localhost:${port}/ok`))).rejects.toSatisfy(isPrivateAddressError);
  });

  it('keeps a bounded number of connection agents however many targets are pinned', async () => {
    const { cachedAgentCount } = await import('./fetch.js');
    for (let i = 0; i < 30; i++) {
      const policy: NetPolicy = { blockPrivate: true, allowHosts: new Set(), pinnedHosts: new Map([[`target-${i}.test`, ['127.0.0.1']]]) };
      const response = await runWithNetPolicy(policy, () => netFetch(`http://target-${i}.test:${port}/ok`));
      await response.text();
    }
    expect(cachedAgentCount()).toBeLessThanOrEqual(8);
  });

  it('classifies a refusal as private-address, not as an unreachable site', async () => {
    const error = await runWithNetPolicy(STRICT, () => netFetch(`http://127.0.0.1:${port}/ok`)).catch((e) => e);
    expect(classifyError(error).code).toBe('private-address');
  });
});

describe('policyForTarget', () => {
  it('auto never turns the guard off: a private target is pinned to the addresses it resolved to', async () => {
    const ip = await policyForTarget('http://127.0.0.1:3000/', 'auto');
    expect(ip.blockPrivate).toBe(true);
    expect(ip.pinnedHosts?.get('127.0.0.1')).toEqual(['127.0.0.1']);
    const named = await policyForTarget('http://localhost:3000/', 'auto');
    expect(named.blockPrivate).toBe(true);
    expect(named.pinnedHosts?.get('localhost')?.length).toBeGreaterThan(0);
    const pub = await policyForTarget('http://93.184.215.14/', 'auto');
    expect(pub.blockPrivate).toBe(true);
    expect(pub.pinnedHosts).toBeUndefined();
  });

  it('auto fails closed when the target cannot be resolved', async () => {
    expect((await policyForTarget('http://no-such-host.invalid/', 'auto')).blockPrivate).toBe(true);
  });

  it('strict blocks and open never does', async () => {
    expect((await policyForTarget('http://127.0.0.1/', 'strict')).blockPrivate).toBe(true);
    expect((await policyForTarget('http://93.184.215.14/', 'open')).blockPrivate).toBe(false);
  });
});

describe('capped body reads', () => {
  it('stops reading at the cap', async () => {
    const big = new Response('x'.repeat(5000));
    await expect(readBodyCapped(big, 1000)).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it('refuses a declared length over the cap without reading', async () => {
    const declared = new Response('small', { headers: { 'content-length': '999999' } });
    await expect(readBodyCapped(declared, 1000)).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it('reads a body under the cap', async () => {
    const bytes = await readBodyCapped(new Response('hello'), 1000);
    expect(new TextDecoder().decode(bytes)).toBe('hello');
  });

  it('reads only a prefix when asked', async () => {
    expect(await readTextPrefix(new Response('abcdefghij'), 4)).toBe('abcd');
  });
});

describe('one way out', () => {
  /** Every .ts source file under src/, tests excluded */
  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sources(path);
      return path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : [];
    });
  }

  it('no source file calls fetch() directly outside src/net', () => {
    const root = new URL('..', import.meta.url).pathname;
    const offenders = sources(root)
      .filter((file) => !relative(root, file).startsWith('net/'))
      .filter((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .some((line) => !/^\s*(\/\/|\*)/.test(line) && /(?<![A-Za-z.])fetch\(/.test(line))
      )
      .map((file) => relative(root, file));
    expect(offenders).toEqual([]);
  });
});
