/**
 * `import font from 'pkg/file.woff2?inline'` → the file as a data URL.
 *
 * Vite honours `?inline` for CSS but, in a Node/SSR build such as Electron's
 * main process, emits a font as a separate file and hands back its path. The
 * HTML report is one offline file and cannot point at a file next to the app,
 * so its fonts must be inlined; this does it the way tsup.config.ts does for
 * the CLI build.
 */
import { readFileSync } from 'fs';

const PREFIX = '\0inline-asset:';

export function inlineAssets() {
  return {
    name: 'seomator-inline-assets',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (!source.endsWith('?inline') || !/\.woff2\?inline$/.test(source)) return null;
      const resolved = await this.resolve(source.replace(/\?inline$/, ''), importer, { skipSelf: true });
      return resolved ? PREFIX + resolved.id : null;
    },
    load(id) {
      if (!id.startsWith(PREFIX)) return null;
      const file = id.slice(PREFIX.length);
      const dataUrl = `data:font/woff2;base64,${readFileSync(file).toString('base64')}`;
      return `export default ${JSON.stringify(dataUrl)};`;
    },
  };
}
