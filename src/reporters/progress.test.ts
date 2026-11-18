/**
 * Progress output that arrives while a live bar owns the terminal line must
 * go through the bar: a line written beside it cuts the bar in two and leaves
 * a broken copy on screen.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ProgressReporter } from './progress.js';

afterEach(() => vi.restoreAllMocks());

function captureOutput(): string[] {
  const written: string[] = [];
  const record = ((chunk: unknown) => {
    written.push(String(chunk));
    return true;
  }) as never;
  vi.spyOn(process.stderr, 'write').mockImplementation(record);
  vi.spyOn(process.stdout, 'write').mockImplementation(record);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => void written.push(`${args.join(' ')}\n`));
  return written;
}

describe('the external-link notice', () => {
  it('shows in the live bar during a crawl, not as a line beside it', () => {
    const written = captureOutput();
    // The bar only draws in a terminal; in a pipe it never starts
    const tty = Object.getOwnPropertyDescriptor(process.stderr, 'isTTY');
    Object.defineProperty(process.stderr, 'isTTY', { value: true, configurable: true });
    try {
      const progress = new ProgressReporter({ crawl: true });
      progress.startCrawlProgress(5);
      progress.onExternalLinks(23);
      const bar = (progress as unknown as { crawlBar: { payload: { url: string } } }).crawlBar;
      expect(bar.payload.url).toBe('checking 23 external links');
      expect(written.join('')).not.toContain('checking 23 external links\n');
      progress.stop();
    } finally {
      if (tty) Object.defineProperty(process.stderr, 'isTTY', tty);
      else delete (process.stderr as { isTTY?: boolean }).isTTY;
    }
  });

  it('is a line of its own when no bar is on screen', () => {
    const written = captureOutput();
    new ProgressReporter({}).onExternalLinks(1);
    expect(written.join('')).toContain('checking 1 external link\n');
  });
});
