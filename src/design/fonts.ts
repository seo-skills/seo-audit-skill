/**
 * Geist and Geist Mono, inlined, for the single-file HTML report.
 *
 * The dashboard and the desktop app bundle these faces as files
 * (`ui/main.tsx`). A report that is emailed and opened offline has nowhere to
 * load a file from, so it carries the Latin variable cuts as data URLs: about
 * 70 KB, OFL-1.1, and no request to anyone. The family names match the token
 * stack (`METRICS['font-sans']`), so the report's CSS needs no other change.
 */

import geist from '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?inline';
import geistMono from '@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2?inline';

export const REPORT_FONT_FACES = `
    @font-face { font-family: 'Geist Variable'; src: url(${geist}) format('woff2'); font-weight: 100 900; font-display: swap; }
    @font-face { font-family: 'Geist Mono Variable'; src: url(${geistMono}) format('woff2'); font-weight: 100 900; font-display: swap; }
`;
