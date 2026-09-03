/**
 * Every colour and measurement the product draws with, in one place.
 *
 * There used to be two copies: 34 KB of CSS inside `html-reporter.ts` and
 * `ui/styles/globals.css`. Light mode was identical because one was pasted from
 * the other; dark mode had already drifted — the report painted `#000000` where
 * the dashboard painted `#09090b`, and `#0a0a0a` against `#18181b` for raised
 * surfaces. One product, two dark themes, and nothing to catch it.
 *
 * **This module must not import anything.** It is bundled into the CLI through
 * `html-reporter.ts` and read by a build-time generator; the moment it imports
 * the rule registry to map a colour per category, the CLI bundle grows a cycle
 * through `scoring.ts`. A test asserts the file has zero imports.
 *
 * Contrast is not decoration here. Eight of thirteen text pairs failed WCAG AA
 * before this file existed — amber warning text sat at 2.15:1 on white — so
 * every value below that carries text is chosen against its background and
 * checked by `tokens.test.ts`. Consolidating without fixing them would have
 * standardised the failure.
 */

/** A colour that text is drawn in, paired with what it is drawn on */
export interface TextPair {
  /** Token name of the foreground */
  fg: string;
  /** Token name of the background it is read against */
  bg: string;
}

export const LIGHT = {
  'color-bg': '#f8fafc',
  'color-bg-elevated': '#ffffff',
  'color-bg-hover': '#f1f5f9',
  'color-bg-active': '#e2e8f0',
  'color-border': '#e2e8f0',
  'color-border-subtle': '#f1f5f9',

  'color-text': '#0f172a',
  'color-text-secondary': '#475569',
  // Was #94a3b8 at 2.56:1 on white — below AA for normal text, and it carries
  // every timestamp, category label and secondary line in the product.
  'color-text-muted': '#64748b',

  // The status colours are used as text on white AND as text on their own
  // tint, so each is chosen to clear 4.5:1 in both. The previous values were
  // picked to look right as a bar or a dot and then reused as type.
  'color-pass': '#047857',
  'color-pass-bg': '#d1fae5',
  'color-warn': '#92400e',
  'color-warn-bg': '#fef3c7',
  'color-orange': '#c2410c',
  'color-orange-bg': '#ffedd5',
  'color-fail': '#b91c1c',
  'color-fail-bg': '#fee2e2',
  'color-info': '#1d4ed8',
  'color-info-bg': '#dbeafe',
  'color-neutral': '#475569',
  'color-neutral-bg': '#f1f5f9',

  'color-accent': '#064ada',
  'color-accent-hover': '#0540b8',
  'color-accent-light': 'rgba(6, 74, 218, 0.1)',
  /** Text drawn on top of the accent, not the accent itself */
  'color-on-accent': '#ffffff',

  'shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.05)',
  'shadow-md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  'shadow-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',

  'toolbar-bg': 'rgba(255, 255, 255, 0.72)',
  'toolbar-border': 'rgba(0, 0, 0, 0.10)',
  'segment-track': 'rgba(0, 0, 0, 0.05)',
  'segment-active': '#ffffff',
  'segment-shadow': '0 1px 2px rgba(0, 0, 0, 0.14), 0 0 0 0.5px rgba(0, 0, 0, 0.06)',
} as const;

/**
 * Zinc, not pure black.
 *
 * `#000000` with `#0a0a0a` for raised surfaces is 1.03:1 — on an OLED panel the
 * card edges simply vanish, which is part of what "looks bad" meant. The
 * dashboard already used zinc; the report did not. Zinc wins.
 */
export const DARK = {
  'color-bg': '#09090b',
  'color-bg-elevated': '#18181b',
  'color-bg-hover': '#27272a',
  'color-bg-active': '#3f3f46',
  'color-border': '#27272a',
  'color-border-subtle': '#1e1e22',

  'color-text': '#fafafa',
  'color-text-secondary': '#a1a1aa',
  // Was #71717a at 3.63:1 on the elevated surface.
  'color-text-muted': '#8b8b94',

  'color-pass': '#34d399',
  'color-pass-bg': 'rgba(16, 185, 129, 0.12)',
  'color-warn': '#fbbf24',
  'color-warn-bg': 'rgba(245, 158, 11, 0.12)',
  'color-orange': '#fb923c',
  'color-orange-bg': 'rgba(249, 115, 22, 0.12)',
  'color-fail': '#f87171',
  'color-fail-bg': 'rgba(239, 68, 68, 0.12)',
  'color-info': '#60a5fa',
  'color-info-bg': 'rgba(59, 130, 246, 0.12)',
  'color-neutral': '#a1a1aa',
  'color-neutral-bg': 'rgba(161, 161, 170, 0.14)',

  'color-accent': '#7ba3f5',
  'color-accent-hover': '#a5c0f8',
  'color-accent-light': 'rgba(6, 74, 218, 0.2)',
  'color-on-accent': '#0b1220',

  'shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.5)',
  'shadow-md': '0 4px 8px rgba(0, 0, 0, 0.6)',
  'shadow-lg': '0 12px 24px rgba(0, 0, 0, 0.7)',

  'toolbar-bg': 'rgba(24, 24, 27, 0.72)',
  'toolbar-border': 'rgba(255, 255, 255, 0.10)',
  'segment-track': 'rgba(255, 255, 255, 0.06)',
  'segment-active': 'rgba(255, 255, 255, 0.16)',
  'segment-shadow': '0 1px 2px rgba(0, 0, 0, 0.5), 0 0 0 0.5px rgba(255, 255, 255, 0.08)',
} as const;

/** Measurements, which do not change with the theme */
export const METRICS = {
  'header-height': '52px',
  'sidebar-width': '260px',
  'content-max-width': '1200px',
  'traffic-light-width': '92px',
  'radius-sm': '4px',
  'radius-md': '8px',
  'radius-lg': '12px',
  // No webfont is fetched. A tool that runs on localhost should not need the
  // internet to render text, or announce every reader to a third party.
  'font-sans': "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  'font-mono': "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
} as const;

/**
 * Every pair where one token is read as text against another.
 *
 * The contrast test walks this list. A new colour used as text has to be added
 * here, which is the point: it cannot be introduced without being checked.
 */
export const TEXT_PAIRS: readonly TextPair[] = [
  { fg: 'color-text', bg: 'color-bg' },
  { fg: 'color-text', bg: 'color-bg-elevated' },
  { fg: 'color-text-secondary', bg: 'color-bg-elevated' },
  { fg: 'color-text-muted', bg: 'color-bg-elevated' },
  { fg: 'color-text-muted', bg: 'color-bg' },
  { fg: 'color-pass', bg: 'color-bg-elevated' },
  { fg: 'color-pass', bg: 'color-pass-bg' },
  { fg: 'color-warn', bg: 'color-bg-elevated' },
  { fg: 'color-warn', bg: 'color-warn-bg' },
  { fg: 'color-orange', bg: 'color-bg-elevated' },
  { fg: 'color-orange', bg: 'color-orange-bg' },
  { fg: 'color-fail', bg: 'color-bg-elevated' },
  { fg: 'color-fail', bg: 'color-fail-bg' },
  { fg: 'color-info', bg: 'color-bg-elevated' },
  { fg: 'color-info', bg: 'color-info-bg' },
  { fg: 'color-neutral', bg: 'color-bg-elevated' },
  { fg: 'color-neutral', bg: 'color-neutral-bg' },
  { fg: 'color-accent', bg: 'color-bg-elevated' },
  { fg: 'color-on-accent', bg: 'color-accent' },
];

/** Custom-property declarations for one theme, without the wrapping selector */
function declarations(tokens: Record<string, string>, indent = '  '): string {
  return Object.entries(tokens)
    .map(([name, value]) => `${indent}--${name}: ${value};`)
    .join('\n');
}

/**
 * The tokens as CSS.
 *
 * Emitted as plain unlayered `:root` and `[data-theme]` rules on purpose.
 * Tailwind v4's `@theme` block in `ui/styles/tailwind.css` aliases these
 * (`--color-pass: var(--color-pass)`), which resolves only because unlayered
 * CSS outranks cascade layers — putting these declarations inside a layer
 * would make every one of those aliases circular, and the UI would lose all
 * colour at once.
 */
export function toCss(): string {
  return `:root {
${declarations({ ...LIGHT, ...METRICS })}
}

[data-theme='dark'] {
${declarations(DARK)}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
${declarations(DARK, '    ')}
  }
}
`;
}
