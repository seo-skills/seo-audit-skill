import { defineConfig } from "tsup";
import { readFileSync } from "fs";
import { createRequire } from "module";
import type { Plugin } from "esbuild";

const require = createRequire(import.meta.url);

/**
 * `import font from 'pkg/file.woff2?inline'` → the file as a data URL, the way
 * Vite reads the same import. Only the HTML report's fonts use it: a single
 * offline file has nowhere else to load a font from.
 */
const inlineAssets: Plugin = {
  name: "inline-assets",
  setup(build) {
    build.onResolve({ filter: /\?inline$/ }, (args) => ({
      path: require.resolve(args.path.replace(/\?inline$/, ""), { paths: [args.resolveDir] }),
      namespace: "inline-asset",
    }));
    build.onLoad({ filter: /.*/, namespace: "inline-asset" }, (args) => ({
      contents: `export default ${JSON.stringify(
        `data:font/woff2;base64,${readFileSync(args.path).toString("base64")}`
      )};`,
      loader: "js",
    }));
  },
};

export default defineConfig([
  // CLI entry — gets the shebang for `npx seomator`.
  // No dts: an executable has no importable API and nothing references
  // dist/cli.d.ts, so generating it only costs build time.
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    esbuildPlugins: [inlineAssets],
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
    esbuildPlugins: [inlineAssets],
    clean: false, // don't wipe dist/ (cli.js was already written above)
    dts: true,
  },
]);
