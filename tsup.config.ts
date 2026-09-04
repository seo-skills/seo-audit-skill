import { defineConfig } from "tsup";

export default defineConfig([
  // CLI entry — gets the shebang for `npx seomator`.
  // No dts: an executable has no importable API and nothing references
  // dist/cli.d.ts, so generating it only costs build time.
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    // `npm run clean` handles this: dist/ also holds the dashboard's static
    // assets, and whichever build ran second would wipe the first.
    clean: false,
    dts: false,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
  // Library entry — no shebang, for programmatic `import { createAuditor } from '@seomator/seo-audit'`
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    clean: false, // don't wipe dist/ (cli.js was already written above)
    dts: true,
  },
]);
