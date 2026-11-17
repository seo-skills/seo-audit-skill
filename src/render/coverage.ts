/**
 * How much of each script and stylesheet a page used during load.
 *
 * Read from Chromium's coverage through Playwright. Only the per-resource
 * totals travel on: a page's script sources are large and nothing downstream
 * needs them.
 */

export interface ResourceCoverage {
  url: string;
  /** Characters in the resource, a close stand-in for its uncompressed bytes */
  totalBytes: number;
  unusedBytes: number;
}

export interface CodeCoverage {
  js: ResourceCoverage[];
  css: ResourceCoverage[];
}

interface V8Range {
  startOffset: number;
  endOffset: number;
  count: number;
}

/**
 * Unused characters in a script from V8 block coverage.
 *
 * Ranges nest: a function's range holds its blocks' ranges, and a character's
 * state is the count of the innermost range around it. Sorted outer-first, a
 * stack of open ranges walks the script once.
 */
export function unusedFromBlockCoverage(functions: Array<{ ranges: V8Range[] }>): number {
  const ranges = functions
    .flatMap((f) => f.ranges)
    .sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset);
  let unused = 0;
  let position = 0;
  const open: V8Range[] = [];
  const credit = (range: V8Range, from: number, to: number) => {
    if (range.count === 0 && to > from) unused += to - from;
  };
  for (const range of ranges) {
    while (open.length > 0 && open[open.length - 1].endOffset <= range.startOffset) {
      const done = open.pop()!;
      credit(done, position, done.endOffset);
      position = Math.max(position, done.endOffset);
    }
    if (open.length > 0) credit(open[open.length - 1], position, range.startOffset);
    position = Math.max(position, range.startOffset);
    open.push(range);
  }
  while (open.length > 0) {
    const done = open.pop()!;
    credit(done, position, done.endOffset);
    position = Math.max(position, done.endOffset);
  }
  return unused;
}

/** Characters of a stylesheet no rule on the page matched */
export function unusedFromCssRanges(text: string, ranges: Array<{ start: number; end: number }>): number {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  let used = 0;
  let reached = 0;
  for (const range of sorted) {
    const start = Math.max(range.start, reached);
    if (range.end > start) used += range.end - start;
    reached = Math.max(reached, range.end);
  }
  return Math.max(0, text.length - used);
}
