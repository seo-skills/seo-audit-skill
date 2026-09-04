// Regression: ISSUE-008 — `db migrate` moved the only readable copy away
// Found by /qa on 2026-09-04
// Report: .gstack/qa-reports/qa-report-127-0-0-1-2026-09-04.md
//
// `db stats` prints "Run: seomator db migrate". Running it renamed
// `.seomator/crawls` to `.seomator/crawls.bak`, and `analyze` reads
// `.seomator/crawls/*.json` through loadCrawl()/getLatestCrawl(). Nothing
// reads a crawl back out of `project.db`: the only writers are this migration
// and `db stats`. So the recommended migration made every stored crawl
// unreachable — `analyze <id>` answered "Crawl not found" — and said nothing
// about `db restore`, the command that undoes it.
//
// Two smaller defects in the same command: re-running the migration reported
// an already-migrated crawl as `UNIQUE constraint failed: crawls.crawl_id`
// under a green "Migration complete!", and `crawlsSkipped` / `reportsSkipped`
// were printed on every run and never incremented.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrateJsonToSqlite } from './json-to-sqlite.js';

let home: string;
let work: string;
let previousHome: string | undefined;

/** A crawl in the shape `seomator crawl` writes to .seomator/crawls/. */
function writeCrawl(id: string, url = 'https://example.test/'): void {
  const crawlsDir = join(work, '.seomator', 'crawls');
  mkdirSync(crawlsDir, { recursive: true });
  writeFileSync(
    join(crawlsDir, `${id}.json`),
    JSON.stringify({
      id,
      url,
      project: 'example.test',
      timestamp: new Date().toISOString(),
      config: {},
      stats: { totalPages: 1, duration: 100, errorCount: 0 },
      pages: [
        {
          url,
          statusCode: 200,
          html: '<!doctype html><html><head><title>t</title></head><body>b</body></html>',
          headers: {},
          responseTime: 10,
          depth: 0,
          links: [],
          images: [],
        },
      ],
    })
  );
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'seomator-mig-home-'));
  work = mkdtempSync(join(tmpdir(), 'seomator-mig-work-'));
  previousHome = process.env['SEOMATOR_HOME'];
  process.env['SEOMATOR_HOME'] = home;
});

afterEach(() => {
  if (previousHome === undefined) delete process.env['SEOMATOR_HOME'];
  else process.env['SEOMATOR_HOME'] = previousHome;
  rmSync(home, { recursive: true, force: true });
  rmSync(work, { recursive: true, force: true });
});

describe('migrating does not take the crawls away from the only reader', () => {
  it('leaves the JSON files in place by default', () => {
    writeCrawl('2026-01-01-aaaaaa');

    const stats = migrateJsonToSqlite(work, {});

    expect(stats.crawlsMigrated).toBe(1);
    expect(stats.backupCreated).toBe(false);
    // analyze reads this directory; renaming it is what broke the workflow.
    expect(existsSync(join(work, '.seomator', 'crawls', '2026-01-01-aaaaaa.json'))).toBe(true);
    expect(existsSync(join(work, '.seomator', 'crawls.bak'))).toBe(false);
  });

  it('archives only when explicitly asked', () => {
    writeCrawl('2026-01-01-bbbbbb');

    const stats = migrateJsonToSqlite(work, { backup: true });

    expect(stats.backupCreated).toBe(true);
    expect(existsSync(join(work, '.seomator', 'crawls.bak'))).toBe(true);
    expect(existsSync(join(work, '.seomator', 'crawls'))).toBe(false);
  });

  it('migrates the data either way, so the default is not a no-op', () => {
    writeCrawl('2026-01-01-cccccc');
    expect(migrateJsonToSqlite(work, {}).crawlsMigrated).toBe(1);
    // Re-reading it as a skip proves the row really landed in the database.
    expect(migrateJsonToSqlite(work, {}).crawlsSkipped).toBe(1);
  });
});

describe('re-running the migration is a skip, not an error', () => {
  it('counts an already-migrated crawl as skipped', () => {
    writeCrawl('2026-01-01-dddddd');
    migrateJsonToSqlite(work, {});

    const second = migrateJsonToSqlite(work, {});

    expect(second.crawlsSkipped).toBe(1);
    expect(second.crawlsMigrated).toBe(0);
  });

  it('reports no errors on a second run', () => {
    writeCrawl('2026-01-01-eeeeee');
    migrateJsonToSqlite(work, {});

    // This was `UNIQUE constraint failed: crawls.crawl_id`, printed under a
    // green "Migration complete!".
    expect(migrateJsonToSqlite(work, {}).crawlErrors).toEqual([]);
  });

  it('still migrates a new crawl alongside one already done', () => {
    writeCrawl('2026-01-01-ffffff');
    migrateJsonToSqlite(work, {});
    writeCrawl('2026-01-02-999999');

    const second = migrateJsonToSqlite(work, {});

    expect(second.crawlsMigrated).toBe(1);
    expect(second.crawlsSkipped).toBe(1);
    expect(second.crawlErrors).toEqual([]);
  });
});
