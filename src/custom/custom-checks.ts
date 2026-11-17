/**
 * Custom checks: a team's own searches and extractions, from seomator.toml.
 *
 * They run as their own pass beside the rules, never as rules: the rule
 * registry is process-wide, and per-run rules would leak between the runs of
 * `serve` and the desktop app. They have no weight, so the score keeps
 * describing the site rather than a team's private checklist.
 */
import * as vm from 'node:vm';
import * as cheerio from 'cheerio';
import type { AuditContext } from '../types.js';
import type { CustomConfig, CustomExtractConfig, CustomSearchConfig } from '../config/schema.js';

/** A regular expression gets this long on one page before it is stopped */
export const REGEX_TIME_LIMIT_MS = 50;
/** Failing pages listed per search; the counts cover every page */
const LISTED_PAGES = 50;

type Normalised = Required<Omit<CustomSearchConfig, 'selector' | 'text' | 'scope'>> &
  Pick<CustomSearchConfig, 'selector' | 'text' | 'scope'>;

function normalise(search: CustomSearchConfig): Normalised {
  return {
    ...search,
    where: search.where ?? 'text',
    match: search.match ?? 'literal',
    expect: search.expect ?? 'present',
    severity: search.severity ?? 'warn',
    fail_ci: search.fail_ci ?? false,
  };
}

/**
 * What is wrong with each entry, in words a person can fix: a missing name,
 * a selector the parser rejects, a regular expression that does not compile.
 * Checked before a run, so a typo stops it with exit 2 instead of quietly
 * passing every page.
 */
export function customConfigProblems(custom: Partial<CustomConfig> | undefined): Array<{ path: string; message: string }> {
  const problems: Array<{ path: string; message: string }> = [];
  const $ = cheerio.load('<html><head></head><body></body></html>');
  const label = (kind: string, i: number, name: unknown) => `custom.${kind}[${i}]${typeof name === 'string' && name ? ` ("${name}")` : ''}`;
  const selectorProblem = (selector: string): string | null => {
    try {
      $(selector);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  };
  const regexProblem = (pattern: string): string | null => {
    try {
      new RegExp(pattern);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  };

  (custom?.search ?? []).forEach((raw, i) => {
    const at = label('search', i, raw?.name);
    const add = (message: string) => problems.push({ path: at, message });
    if (typeof raw?.name !== 'string' || !raw.name.trim()) add('needs a name');
    const search = normalise(raw ?? ({} as CustomSearchConfig));
    if (!['text', 'html', 'head', 'body', 'selector'].includes(search.where)) add(`where must be text, html, head, body or selector, not "${search.where}"`);
    if (!['literal', 'regex'].includes(search.match)) add(`match must be literal or regex, not "${search.match}"`);
    if (!['present', 'absent'].includes(search.expect)) add(`expect must be present or absent, not "${search.expect}"`);
    if (!['warn', 'fail'].includes(search.severity)) add(`severity must be warn or fail, not "${search.severity}"`);
    if (search.where === 'selector') {
      if (!search.selector) add('needs a selector when where = "selector"');
      else {
        const problem = selectorProblem(search.selector);
        if (problem) add(`selector "${search.selector}" is not valid CSS: ${problem}`);
      }
    } else if (!search.text) {
      add('needs text to search for');
    }
    if (search.match === 'regex') {
      for (const [field, pattern] of [['text', search.text], ['scope', search.scope]] as const) {
        if (!pattern) continue;
        const problem = regexProblem(pattern);
        if (problem) add(`${field} is not a valid regular expression: ${problem}`);
      }
    }
  });

  (custom?.extract ?? []).forEach((extract, i) => {
    const at = label('extract', i, extract?.name);
    const add = (message: string) => problems.push({ path: at, message });
    if (typeof extract?.name !== 'string' || !extract.name.trim()) add('needs a name');
    if (!extract?.selector) add('needs a selector');
    else {
      const problem = selectorProblem(extract.selector);
      if (problem) add(`selector "${extract.selector}" is not valid CSS: ${problem}`);
    }
  });
  return problems;
}

/**
 * Test a regular expression inside a separate context with a time limit, so
 * a pattern that backtracks catastrophically on one page is stopped instead
 * of hanging the crawl. Null when it was stopped.
 */
export function regexTest(pattern: string, subject: string): boolean | null {
  const sandbox = vm.createContext({ pattern, subject });
  try {
    return vm.runInContext('new RegExp(pattern).test(subject)', sandbox, { timeout: REGEX_TIME_LIMIT_MS }) as boolean;
  } catch {
    return null;
  }
}

export interface CustomSearchResult {
  name: string;
  expect: 'present' | 'absent';
  severity: 'warn' | 'fail';
  failCi: boolean;
  /** Pages in scope the search ran on */
  checked: number;
  failing: number;
  /** Pages where the regular expression hit the time limit */
  stopped: number;
  failingPages: string[];
  stoppedPages: string[];
}

export interface CustomExtractResult {
  name: string;
  pages: Array<{ url: string; values: string[] }>;
}

export interface CustomResults {
  searches: CustomSearchResult[];
  extractions: CustomExtractResult[];
}

function inScope(search: Normalised, url: string): boolean | null {
  if (!search.scope) return true;
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return false;
  }
  return search.match === 'regex' ? regexTest(search.scope, path) : path.startsWith(search.scope);
}

/** Whether the page shows what the search looks for; null when the time limit stopped it */
function found(search: Normalised, context: AuditContext): boolean | null {
  const { $ } = context;
  if (search.where === 'selector') {
    const matches = $(search.selector!);
    if (!search.text) return matches.length > 0;
    const texts = matches.map((_, el) => $(el).text()).get();
    for (const text of texts) {
      const hit = search.match === 'regex' ? regexTest(search.text, text) : text.includes(search.text);
      if (hit !== false) return hit;
    }
    return false;
  }
  const subject =
    search.where === 'html' ? context.html
    : search.where === 'head' ? ($('head').html() ?? '')
    : search.where === 'body' ? ($('body').html() ?? '')
    : $('body').text();
  return search.match === 'regex' ? regexTest(search.text!, subject) : subject.includes(search.text!);
}

/**
 * An extracted value as reports may print it: control characters dropped (an
 * escape sequence in a page would otherwise reach the terminal) and runs of
 * whitespace collapsed.
 */
function cleanValue(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extract(spec: CustomExtractConfig, context: AuditContext): string[] {
  const { $ } = context;
  const elements = $(spec.selector).toArray();
  const values = (spec.multiple ? elements : elements.slice(0, 1))
    .map((el) => cleanValue(spec.attribute ? ($(el).attr(spec.attribute) ?? '') : $(el).text()))
    .filter((value) => value !== '');
  return values;
}

/** Collects one run's custom results, page by page */
export class CustomRunner {
  private readonly searches: Normalised[];
  private readonly searchResults: CustomSearchResult[];
  private readonly extractResults: CustomExtractResult[];

  constructor(private readonly config: Partial<CustomConfig>) {
    this.searches = (config.search ?? []).map(normalise);
    this.searchResults = this.searches.map((s) => ({
      name: s.name,
      expect: s.expect,
      severity: s.severity,
      failCi: s.fail_ci,
      checked: 0,
      failing: 0,
      stopped: 0,
      failingPages: [],
      stoppedPages: [],
    }));
    this.extractResults = (config.extract ?? []).map((e) => ({ name: e.name, pages: [] }));
  }

  get empty(): boolean {
    return this.searches.length === 0 && this.extractResults.length === 0;
  }

  runPage(context: AuditContext): void {
    this.searches.forEach((search, i) => {
      const result = this.searchResults[i];
      const scoped = inScope(search, context.url);
      if (scoped === false) return;
      if (scoped === null) {
        result.stopped++;
        if (result.stoppedPages.length < LISTED_PAGES) result.stoppedPages.push(context.url);
        return;
      }
      result.checked++;
      const hit = found(search, context);
      if (hit === null) {
        result.stopped++;
        if (result.stoppedPages.length < LISTED_PAGES) result.stoppedPages.push(context.url);
        return;
      }
      const passes = search.expect === 'present' ? hit : !hit;
      if (!passes) {
        result.failing++;
        if (result.failingPages.length < LISTED_PAGES) result.failingPages.push(context.url);
      }
    });
    (this.config.extract ?? []).forEach((spec, i) => {
      const values = extract(spec, context);
      if (values.length > 0) this.extractResults[i].pages.push({ url: context.url, values });
    });
  }

  results(): CustomResults {
    return { searches: this.searchResults, extractions: this.extractResults };
  }
}
