/**
 * The renderer must never inject HTML it did not write.
 *
 * Rule messages, page URLs and audit metadata all come from audited sites.
 * React escapes them by default; `dangerouslySetInnerHTML` is the one way to
 * opt out, so this fails the build if anyone ever does.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const UI_ROOT = dirname(fileURLToPath(import.meta.url));

function* sourceFiles(directory: string): Generator<string> {
  for (const entry of readdirSync(directory)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      yield* sourceFiles(full);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      // Test files are skipped: this one names the very pattern it looks for.
      yield full;
    }
  }
}

describe('renderer safety', () => {
  it('never uses dangerouslySetInnerHTML', () => {
    const offenders = [...sourceFiles(UI_ROOT)].filter((file) =>
      readFileSync(file, 'utf8').includes('dangerouslySetInnerHTML')
    );
    expect(offenders).toEqual([]);
  });

  it('puts audited URLs through safeHref before they reach an href', () => {
    // Page URLs come from the sites being audited. A javascript: URL in an
    // href is click-to-execute, so every one goes through the scheme check.
    const offenders = [...sourceFiles(UI_ROOT)].filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /href=\{(?!safeHref\()[^}]*\b(message|pageUrl|startUrl)\b/.test(source);
    });
    expect(offenders).toEqual([]);
  });
});
