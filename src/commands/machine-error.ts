import chalk from 'chalk';

/** A failure a command reports before it has any document to emit. */
export interface CommandFailure {
  /** Whether the caller asked for machine-readable output. */
  json: boolean;
  /** Stable, greppable identifier: `crawl-not-found`, `no-audits`, … */
  code: string;
  /** One sentence, for a person. */
  message: string;
  /** What to do about it. Optional. */
  hint?: string;
  /** Process exit code. Defaults to 1, which is what these paths already used. */
  exitCode?: number;
}

/**
 * Report a command-level failure in whatever shape the caller is reading.
 *
 * `audit --format json` has always emitted `{"error": true, "code": …}` for a
 * failure. `analyze --json`, `compare --json` and `report --format json` did
 * not: they printed a red line to stderr and left stdout completely empty, so
 * an agent asking for JSON could not tell a missing crawl from a crash. This
 * gives all of them the same object.
 *
 * It sets `process.exitCode` rather than calling `process.exit()`, which
 * matters twice over. `process.exit()` truncates a large stdout write at the
 * pipe buffer, and it skips `finally` blocks — `compare` closes its SQLite
 * handle in one, and three of its error paths exited straight past it.
 */
export function emitCommandError(failure: CommandFailure): void {
  const { json, code, message, hint, exitCode = 1 } = failure;

  if (json) {
    console.log(
      JSON.stringify(
        {
          error: true,
          code,
          message,
          ...(hint && { hint }),
          timestamp: new Date().toISOString(),
        },
        null,
        2
      )
    );
  } else {
    console.error(chalk.red('Error: ') + message);
    if (hint) console.error(chalk.dim(`  ${hint}`));
  }

  process.exitCode = exitCode;
}
