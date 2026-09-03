import chalk from 'chalk';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';
import { getGlobalDir, getAuditsDbPath } from '../storage/paths.js';
import { findWebAssets } from '../dashboard/static.js';

export interface SelfDoctorOptions {
  verbose: boolean;
}

interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: string;
}

/**
 * Run a command using execFileSync (safer than execSync)
 */
function tryExecFile(command: string, args: string[] = []): string | null {
  try {
    return execFileSync(command, args, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Check if a command exists in PATH
 */
function commandExists(command: string): boolean {
  if (process.platform === 'win32') {
    return tryExecFile('where', [command]) !== null;
  }
  return tryExecFile('which', [command]) !== null;
}

/**
 * Find Chrome/Chromium executable
 */
function findChrome(): { found: boolean; path?: string; version?: string } {
  const possiblePaths: string[] = [];

  if (process.platform === 'darwin') {
    possiblePaths.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    );
  } else if (process.platform === 'win32') {
    const programFiles = process.env['PROGRAMFILES'] || 'C:\\Program Files';
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    possiblePaths.push(
      `${programFiles}\\Google\\Chrome\\Application\\chrome.exe`,
      `${programFilesX86}\\Google\\Chrome\\Application\\chrome.exe`,
      `${programFiles}\\Microsoft\\Edge\\Application\\msedge.exe`
    );
  } else {
    // Linux
    possiblePaths.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium'
    );
  }

  for (const chromePath of possiblePaths) {
    if (fs.existsSync(chromePath)) {
      // Try to get version
      let version: string | undefined;
      try {
        version = tryExecFile(chromePath, ['--version']) || undefined;
      } catch {
        // Ignore version detection errors
      }
      return { found: true, path: chromePath, version };
    }
  }

  return { found: false };
}

/**
 * Check Node.js version
 */
function checkNode(): CheckResult {
  const version = process.version;
  const [major, minor] = version.slice(1).split('.').map((n) => parseInt(n, 10));

  // 20.3 is the floor: AbortSignal.any(), which cancellation is built on,
  // arrived there. Matches `engines` in package.json.
  if (major > 20 || (major === 20 && minor >= 3)) {
    return {
      name: 'Node.js',
      status: 'pass',
      message: `Node.js ${version} installed`,
    };
  }
  return {
    name: 'Node.js',
    status: 'fail',
    message: `Node.js ${version} is too old (require v20.3+)`,
  };
}

/**
 * Check npm version
 */
function checkNpm(): CheckResult {
  const version = tryExecFile('npm', ['--version']);
  if (version) {
    return {
      name: 'npm',
      status: 'pass',
      message: `npm v${version} installed`,
    };
  }
  return {
    name: 'npm',
    status: 'fail',
    message: 'npm not found in PATH',
  };
}

/**
 * Check Chrome/Chromium for Core Web Vitals
 */
function checkChrome(): CheckResult {
  const chrome = findChrome();
  if (chrome.found) {
    const versionInfo = chrome.version ? ` (${chrome.version.trim()})` : '';
    return {
      name: 'Chrome/Chromium',
      status: 'pass',
      message: `Browser found${versionInfo}`,
      details: chrome.path,
    };
  }
  return {
    name: 'Chrome/Chromium',
    status: 'warn',
    message: 'No Chrome/Chromium found (Core Web Vitals will be skipped)',
    details: 'Install Chrome, Chromium, or Edge for CWV measurement',
  };
}

/**
 * Check seomator global directory
 */
function checkGlobalDir(): CheckResult {
  const globalDir = getGlobalDir();
  const label = process.env['SEOMATOR_HOME'] ? `$SEOMATOR_HOME (${globalDir})` : '~/.seomator';
  if (fs.existsSync(globalDir)) {
    const stats = fs.statSync(globalDir);
    if (stats.isDirectory()) {
      return {
        name: 'Data directory',
        status: 'pass',
        message: `${label} exists`,
        details: globalDir,
      };
    }
    return {
      name: 'Data directory',
      status: 'fail',
      message: `${label} exists but is not a directory`,
      details: globalDir,
    };
  }
  return {
    name: 'Data directory',
    status: 'pass',
    message: `${label} will be created on first use`,
    details: globalDir,
  };
}

/**
 * Check the dashboard's static assets.
 *
 * They ship in the package as `dist/web`. A source checkout builds them, so
 * their absence there is a note rather than a problem.
 */
function checkWebAssets(): CheckResult {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const distDir = path.basename(here) === 'commands' ? path.resolve(here, '../../dist') : here;
  const { root, available } = findWebAssets(distDir);

  if (available) {
    return {
      name: 'Dashboard assets',
      status: 'pass',
      message: '`seomator serve` has a UI to serve',
      details: root,
    };
  }

  const sourceCheckout = fs.existsSync(path.resolve(distDir, '../src'));
  return {
    name: 'Dashboard assets',
    status: sourceCheckout ? 'warn' : 'fail',
    message: sourceCheckout
      ? 'Not built — `seomator serve` will answer /api only'
      : 'Missing from this install',
    details: sourceCheckout ? 'Run `npm run build`' : `Reinstall: npm install -g @seomator/seo-audit`,
  };
}

/**
 * Check local config file
 */
function checkLocalConfig(): CheckResult {
  const configPath = path.join(process.cwd(), 'seomator.toml');
  if (fs.existsSync(configPath)) {
    return {
      name: 'Local config',
      status: 'pass',
      message: 'seomator.toml found in current directory',
      details: configPath,
    };
  }
  return {
    name: 'Local config',
    status: 'pass',
    message: 'No seomator.toml (will use defaults)',
    details: 'Run `seomator init` to create one',
  };
}

/**
 * Check write permissions
 */
function checkPermissions(): CheckResult {
  // Every audit is stored here by default now, so an unwritable data
  // directory turns every run into a warning. Probe the directory itself, or
  // its nearest existing parent when it has not been created yet.
  const globalDir = getGlobalDir();
  let testDir = globalDir;
  while (!fs.existsSync(testDir)) {
    const parent = path.dirname(testDir);
    if (parent === testDir) break;
    testDir = parent;
  }

  try {
    const testFile = path.join(testDir, '.seomator-test-' + Date.now());
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return {
      name: 'Data directory writable',
      status: 'pass',
      message: `Can write to ${testDir}`,
      details: `Audits are stored in ${getAuditsDbPath()}`,
    };
  } catch {
    return {
      name: 'Data directory writable',
      status: 'fail',
      message: `Cannot write to ${testDir}`,
      details: 'Fix the permissions, or point SEOMATOR_HOME at a writable directory',
    };
  }
}

/**
 * Print a check result
 */
function printResult(result: CheckResult, verbose: boolean): void {
  const icon =
    result.status === 'pass'
      ? chalk.green('\u2713')
      : result.status === 'warn'
        ? chalk.yellow('\u26A0')
        : chalk.red('\u2717');

  const color =
    result.status === 'pass'
      ? chalk.green
      : result.status === 'warn'
        ? chalk.yellow
        : chalk.red;

  console.log(`  ${icon} ${result.name}: ${color(result.message)}`);

  if (verbose && result.details) {
    console.log(chalk.gray(`      ${result.details}`));
  }
}

/**
 * Run self doctor diagnostics
 */
export async function runSelfDoctor(options: SelfDoctorOptions): Promise<void> {
  const verbose = options.verbose;

  console.log();
  console.log(chalk.bold('SEOmator Doctor'));
  console.log(chalk.gray('Checking system setup...'));
  console.log();

  const checks: CheckResult[] = [
    checkNode(),
    checkNpm(),
    checkChrome(),
    checkGlobalDir(),
    checkLocalConfig(),
    checkPermissions(),
    checkWebAssets(),
  ];

  for (const check of checks) {
    printResult(check, verbose);
  }

  console.log();

  // Summary
  const passCount = checks.filter((c) => c.status === 'pass').length;
  const warnCount = checks.filter((c) => c.status === 'warn').length;
  const failCount = checks.filter((c) => c.status === 'fail').length;

  if (failCount > 0) {
    console.log(chalk.red(`${failCount} issue(s) found that need attention.`));
    process.exit(1);
  } else if (warnCount > 0) {
    console.log(chalk.yellow(`All good! ${warnCount} warning(s) to consider.`));
  } else {
    console.log(chalk.green(`All ${passCount} checks passed. Ready to audit!`));
  }

  console.log();
}
