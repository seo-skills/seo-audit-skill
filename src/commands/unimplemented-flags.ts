import chalk from 'chalk';

/**
 * Flags for features this build does not have.
 *
 * `--refresh` on `crawl` bypasses a cache. The link cache holds external link
 * statuses, which only `audit` checks, so a crawl has nothing to bypass: every
 * crawl already fetches every page fresh. On `audit` the flag is real.
 *
 * `--resume` continues an interrupted crawl from the `frontier` table, which
 * `schema.ts` creates — with two indexes — and no code ever writes a row to.
 *
 * Both stay parseable so a script that passes one keeps running; it was
 * already getting a full fresh crawl, and still will. They are out of `--help`,
 * because advertising a flag for a feature that does not exist is the defect.
 * Anyone who passes one is told. Both features are scoped in TODOS.md.
 */
export const UNIMPLEMENTED_FLAGS: Array<{ key: string; flags: string }> = [
  { key: 'refresh', flags: '-r, --refresh' },
  { key: 'resume', flags: '--resume' },
];

/**
 * Say on stderr that a flag the caller passed does nothing.
 *
 * stderr, not stdout, so a redirected report still contains only the report.
 */
export function warnUnimplementedFlags(options: Record<string, unknown>, implemented: string[] = []): void {
  for (const { key, flags } of UNIMPLEMENTED_FLAGS) {
    if (options[key] === true && !implemented.includes(key)) {
      console.error(
        chalk.yellow(
          `Warning: ${flags} is not implemented and has no effect. ` +
            'Every crawl already fetches every page fresh.'
        )
      );
    }
  }
}
