/**
 * `import x from './file.woff2?inline'` gives the file as a data URL.
 *
 * Vite and Vitest do this natively; the CLI build does it with the small
 * esbuild plugin in `tsup.config.ts`. Used only for the HTML report's fonts,
 * which must travel inside a single offline file.
 */
declare module '*?inline' {
  const dataUrl: string;
  export default dataUrl;
}
