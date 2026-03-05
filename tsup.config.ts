import { defineConfig } from "tsup";

export default defineConfig([
  // CLI entry — gets the shebang for `npx seomator`
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    clean: true,
    dts: true,
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
