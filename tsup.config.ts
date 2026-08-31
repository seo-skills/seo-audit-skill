import { defineConfig } from "tsup";

export default defineConfig([
  // CLI entry — gets the shebang for `npx seomator`.
  // No dts: an executable has no importable API, and dist/cli.d.ts is
  // referenced by nothing. Generating it would type-check the whole rule graph
  // (cli.ts imports the rule loader for its --version rule count), which trips
  // pre-existing declaration-only type errors in the rule files.
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    clean: true,
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
