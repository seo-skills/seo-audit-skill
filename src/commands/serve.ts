import chalk from 'chalk';
import { spawn } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import { createServer, generateToken, type Route } from '../dashboard/server.js';
import { createReadRoutes } from '../dashboard/api.js';
import { findWebAssets } from '../dashboard/static.js';
import { DEFAULT_CAPABILITIES } from '../dashboard/audit-session.js';
import { writeServeFile, removeServeFile, getServeFilePath } from '../dashboard/token.js';
import { getAuditsDatabase, closeAuditsDatabase } from '../storage/audits-db/index.js';
import { getGlobalDir } from '../storage/paths.js';
import { getVersion } from '../version.js';
import { tildePath } from '../dashboard/api.js';

/** Where the docs for a given failure live */
const DOCS = 'https://github.com/seo-skills/seo-audit-skill/blob/main/docs/WEB-DASHBOARD.md';

export interface ServeOptions {
  port: number;
  open: boolean;
  verbose: boolean;
}

/** Where this build's files sit, whether running from source or from dist */
function distDirectory(): string {
  // At runtime this file is bundled into dist/cli.js, so its own directory is
  // dist/. Running from source (vitest, tsx) it is src/commands/.
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.basename(here) === 'commands' ? path.resolve(here, '../../dist') : here;
}

/** A source checkout has a src/ directory beside package.json */
function isSourceCheckout(): boolean {
  return fs.existsSync(path.resolve(distDirectory(), '../src'));
}

/** How the CLI was started, so messages suggest the right command */
function invocation(): 'npx' | 'global' {
  return process.env['npm_command'] === 'exec' ? 'npx' : 'global';
}

/** Open the dashboard in the default browser; a failure is only a warning */
function openBrowser(url: string): void {
  if (process.env['BROWSER'] === 'none') return;

  const [command, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]];

  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {
      console.log(chalk.dim(`  Could not open a browser. Visit ${url}`));
    });
    child.unref();
  } catch {
    console.log(chalk.dim(`  Could not open a browser. Visit ${url}`));
  }
}

/**
 * Run the local dashboard.
 *
 * Resolves when the server has stopped, so the CLI process stays alive for as
 * long as it is listening.
 */
export async function runServe(options: ServeOptions): Promise<void> {
  const dataDir = getGlobalDir();
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.accessSync(dataDir, fs.constants.W_OK);
  } catch (error) {
    console.error(chalk.red(`Cannot use the data directory ${tildePath(dataDir)}:`));
    console.error(`  ${error instanceof Error ? error.message : String(error)}`);
    console.error(chalk.dim('  Set SEOMATOR_HOME to a writable path.'));
    console.error(chalk.dim(`  See: ${DOCS}#data-directory`));
    process.exitCode = 1;
    return;
  }

  const distDir = distDirectory();
  const assets = findWebAssets(distDir);
  if (!assets.available) {
    if (isSourceCheckout()) {
      console.log(
        chalk.yellow('  Web assets are not built — serving /api only.') +
          chalk.dim(' Run `npm run build`, or `npm run web:dev` for the Vite loop.')
      );
    } else {
      console.error(chalk.red(`Web assets are missing from this install (${assets.root}).`));
      console.error(chalk.dim(`  Reinstall: npm install -g @seomator/seo-audit@${getVersion()}`));
      console.error(chalk.dim(`  See: ${DOCS}#missing-web-assets`));
      process.exitCode = 1;
      return;
    }
  }

  const token = generateToken();
  const startedAt = Date.now();
  // The index route describes the table it lives in, so the array is created
  // first and the handler reads it through a closure.
  const routes: Route[] = [];
  routes.push(
    ...createReadRoutes({
      db: () => getAuditsDatabase(),
      capabilities: DEFAULT_CAPABILITIES,
      startedAt,
      invocation: invocation(),
      routes: () => routes,
    })
  );

  const { server } = createServer({
    routes,
    distDir,
    token,
    verbose: options.verbose,
  });

  const listening = await new Promise<{ port: number } | Error>((resolve) => {
    server.once('error', (error: NodeJS.ErrnoException) => resolve(error));
    server.listen(options.port, '127.0.0.1', () => {
      const address = server.address();
      resolve({ port: typeof address === 'object' && address ? address.port : options.port });
    });
  });

  if (listening instanceof Error) {
    const error = listening as NodeJS.ErrnoException;
    if (error.code === 'EADDRINUSE') {
      console.error(chalk.red(`Port ${options.port} is in use.`));
      console.error(chalk.dim(`  Try: seomator serve --port ${options.port + 1}`));
      console.error(chalk.dim(`  See: ${DOCS}#port-in-use`));
    } else {
      console.error(chalk.red(`Could not start the dashboard: ${error.message}`));
      console.error(chalk.dim(`  See: ${DOCS}#startup`));
    }
    process.exitCode = 1;
    return;
  }

  const { port } = listening;
  const url = `http://127.0.0.1:${port}`;
  writeServeFile({ port, token, pid: process.pid, startedAt: new Date(startedAt).toISOString() });

  console.log();
  console.log(`  ${chalk.bold('SEOmator dashboard')} → ${chalk.cyan(url)}`);
  console.log(chalk.dim(`  Token: ${token}`));
  console.log(chalk.dim(`  Agents: read it from ${tildePath(getServeFilePath())}, send it as X-SEOmator-Token.`));
  console.log(chalk.dim('  Press Ctrl-C to stop.'));
  console.log();

  if (options.open && assets.available) openBrowser(url);

  await new Promise<void>((resolve) => {
    let stopping = false;

    const shutdown = (): void => {
      if (stopping) {
        // A second signal means the user is done waiting.
        process.exit(130);
      }
      stopping = true;
      console.log(chalk.dim('\n  Stopping…'));

      removeServeFile();
      server.close(() => {
        try {
          closeAuditsDatabase();
        } catch {
          // Already closed
        }
        resolve();
      });
      // An idle keep-alive socket would hold close() open indefinitely.
      server.closeAllConnections();
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });
}
