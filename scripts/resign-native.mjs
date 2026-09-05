#!/usr/bin/env node
/**
 * Re-sign rebuilt native modules ad-hoc, on macOS.
 *
 * `electron-rebuild` swaps `better_sqlite3.node` for a build matching Electron's
 * ABI. On Apple Silicon the artifact it restores carries a signature the kernel
 * refuses at load time, even though `codesign -v` reports it "valid on disk"
 * and "satisfies its Designated Requirement". The Electron main process then
 * dies during `dlopen` in `CrBrowserMain`:
 *
 *     Exception:   EXC_BAD_ACCESS, SIGKILL (Code Signature Invalid)
 *     Termination: CODESIGNING, code 2, "Invalid Page"
 *
 * The app never draws a window, and the crash report is the only evidence. That
 * is why the desktop app went untested across four sessions: `npm run
 * electron:dev` looked like it did nothing.
 *
 * `codesign --force --sign -` regenerates the ad-hoc signature and the module
 * loads. Re-signing an already-good binary is harmless, so this runs after every
 * rebuild rather than trying to detect the bad case.
 *
 * No-op off macOS, where none of this applies.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

/** Native modules this project rebuilds between the Node and Electron ABIs. */
const TARGETS = ['node_modules/better-sqlite3/build/Release/better_sqlite3.node'];

if (process.platform !== 'darwin') {
  console.log('resign-native: not macOS, nothing to do.');
  process.exit(0);
}

let signed = 0;
for (const target of TARGETS) {
  if (!existsSync(target)) {
    console.log(`resign-native: ${target} not built, skipping.`);
    continue;
  }
  try {
    execFileSync('codesign', ['--force', '--sign', '-', target], { stdio: 'pipe' });
    console.log(`resign-native: re-signed ${target}`);
    signed++;
  } catch (error) {
    // Not fatal: a machine without the codesign tool can still run the CLI,
    // and only the Electron path needs this.
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`resign-native: could not sign ${target} — ${message.split('\n')[0]}`);
  }
}

console.log(`resign-native: ${signed} module(s) signed.`);
