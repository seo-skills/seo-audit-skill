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

/**
 * The SEOmator brand, as on seomator.com: every neutral has zero chroma, the
 * interface accent is ink, and the one orange belongs to the agent (the
 * emblem's #FE5000) and to the one primary action on a screen. It used to be
 * blue on slate; slate's blue tint reads as a second brand colour next to the
 * orange emblem.
 */
export const LIGHT = {
  'color-bg': '#fafafa',
  'color-bg-elevated': '#ffffff',
  'color-bg-hover': '#f4f4f4',
  'color-bg-active': '#e5e5e5',
  'color-border': '#e5e5e5',
  'color-border-subtle': '#f4f4f4',
  // Control borders: buttons, fields. A step darker than a table line.
  'color-border-strong': '#d4d4d4',

  'color-text': '#171717',
  'color-text-secondary': '#525252',
  // Slate's #94a3b8 was 2.56:1 on white — below AA for normal text, and it
  // carries every timestamp, category label and secondary line in the product.
  'color-text-muted': '#5e5e5e',

  // The status colours are used as text on white AND as text on their own
  // tint, so each is chosen to clear 4.5:1 in both. The previous values were
  // picked to look right as a bar or a dot and then reused as type.
  //
  // DESIGN.md "colour only where it's wrong": fail and warn mark problems;
  // pass (green) means *improved since the last run*, never "this is fine".
  // A passing check is an open square in the muted colour. There is no orange
  // status: the D grade used to be #c2410c, next to the brand orange.
  'color-pass': '#167a34',
  'color-pass-bg': '#dcfce7',
  'color-warn': '#92400e',
  'color-warn-bg': '#fef3c7',
  'color-fail': '#be1212',
  'color-fail-bg': '#fee2e2',
  // A score of 80 or more is drawn in ink, not green (the verdict's 'ink' token).
  'color-ink': '#171717',
  'color-ink-bg': '#f4f4f4',
  'color-info': '#1d4ed8',
  'color-info-bg': '#dbeafe',
  'color-neutral': '#525252',
  'color-neutral-bg': '#f4f4f4',

  // Ink: selection, focus, links, checkboxes and secondary buttons. Not orange,
  // or every selected tab would compete with the agent for the eye.
  'color-accent': '#171717',
  'color-accent-hover': '#262626',
  'color-accent-light': 'rgba(23, 23, 23, 0.06)',
  /** Text drawn on top of the accent, not the accent itself */
  'color-on-accent': '#ffffff',

  // The agent orange: the agent at work (progress) and the one primary action.
  'color-agent': '#fe5000',
  'color-agent-hover': '#e64800',
  // White, as seomator.com's primary button (`agent-foreground`). The owner's
  // call on the website (2026-10-07) and here (2026-11-18): 3.3:1, which is
  // AA for large text only. Checked against a 3:1 floor in BRAND_PAIRS below.
  'color-on-agent': '#ffffff',
  // The agent speaking: its one sentence on the report and the run screen.
  'color-agent-text': '#b83800',
  // The kept part of a "Where the points went" column.
  'color-strip': '#e5e5e5',

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
 * Neutral greys, not pure black.
 *
 * `#000000` with `#0a0a0a` for raised surfaces is 1.03:1 — on an OLED panel the
 * card edges simply vanish, which is part of what "looks bad" meant. So the page
 * is the brand's `#0a0a0a` and raised surfaces step up to `#171717`, the same
 * 1.13:1 step zinc had, without zinc's blue tint.
 */
export const DARK = {
  'color-bg': '#0a0a0a',
  'color-bg-elevated': '#171717',
  'color-bg-hover': '#262626',
  'color-bg-active': '#404040',
  'color-border': '#262626',
  'color-border-subtle': '#1f1f1f',
  'color-border-strong': '#404040',

  'color-text': '#ededed',
  'color-text-secondary': '#a1a1a1',
  // Zinc's #71717a was 3.63:1 on the elevated surface.
  'color-text-muted': '#8b8b8b',

  'color-pass': '#34d399',
  'color-pass-bg': 'rgba(16, 185, 129, 0.12)',
  'color-warn': '#fbbf24',
  'color-warn-bg': 'rgba(245, 158, 11, 0.12)',
  'color-fail': '#f87171',
  'color-fail-bg': 'rgba(239, 68, 68, 0.12)',
  'color-ink': '#ededed',
  'color-ink-bg': 'rgba(237, 237, 237, 0.10)',
  'color-info': '#60a5fa',
  'color-info-bg': 'rgba(59, 130, 246, 0.12)',
  'color-neutral': '#a1a1a1',
  'color-neutral-bg': 'rgba(161, 161, 161, 0.14)',

  'color-accent': '#ededed',
  'color-accent-hover': '#ffffff',
  'color-accent-light': 'rgba(237, 237, 237, 0.10)',
  'color-on-accent': '#0a0a0a',

  // The same orange in both themes: it is the emblem's, not a theme colour.
  'color-agent': '#fe5000',
  'color-agent-hover': '#e64800',
  'color-on-agent': '#ffffff',
  'color-agent-text': '#fe5000',
  'color-strip': '#262626',

  'shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.5)',
  'shadow-md': '0 4px 8px rgba(0, 0, 0, 0.6)',
  'shadow-lg': '0 12px 24px rgba(0, 0, 0, 0.7)',

  'toolbar-bg': 'rgba(23, 23, 23, 0.72)',
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
  // DESIGN.md: 0 for tables and rows, 4px controls, 6px is the cap.
  'radius-md': '4px',
  'radius-lg': '6px',
  // The brand pairs Geist for text with Geist Mono for readouts, URLs and
  // numbers. No webfont is fetched: the dashboard and the desktop app bundle
  // both faces (ui/main.tsx), and the single-file HTML report falls back to
  // the system stack, so a tool that runs on localhost never needs the
  // internet to render text or announces a reader to a third party.
  'font-sans': "'Geist Variable', 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  'font-mono': "'Geist Mono Variable', 'Geist Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
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
  { fg: 'color-ink', bg: 'color-bg-elevated' },
  { fg: 'color-ink', bg: 'color-ink-bg' },
  { fg: 'color-agent-text', bg: 'color-bg-elevated' },
  { fg: 'color-agent-text', bg: 'color-bg' },
  { fg: 'color-fail', bg: 'color-bg-elevated' },
  { fg: 'color-fail', bg: 'color-fail-bg' },
  { fg: 'color-info', bg: 'color-bg-elevated' },
  { fg: 'color-info', bg: 'color-info-bg' },
  { fg: 'color-neutral', bg: 'color-bg-elevated' },
  { fg: 'color-neutral', bg: 'color-neutral-bg' },
  { fg: 'color-accent', bg: 'color-bg-elevated' },
  { fg: 'color-on-accent', bg: 'color-accent' },
  // Solid warn and fail buttons. These carried a hardcoded `#fff`, which is
  // right over the light theme's dark amber and red and close to invisible over
  // the dark theme's bright ones.
  { fg: 'color-on-accent', bg: 'color-warn' },
  { fg: 'color-on-accent', bg: 'color-fail' },
];

/** A pair held below AA on purpose: the ratio it must keep, and why */
export interface BrandPair extends TextPair {
  floor: number;
  why: string;
}

/**
 * Text pairs the brand holds below AA on purpose, with the floor they must keep.
 *
 * White on the agent orange is seomator.com's primary button: the owner chose
 * it over ink knowing it is 3.3:1 (AA for large text only). It stays tested,
 * against 3:1, so the exception cannot drift lower unnoticed.
 */
export const BRAND_PAIRS: readonly BrandPair[] = [
  { fg: 'color-on-agent', bg: 'color-agent', floor: 3, why: 'primary button label, owner call 2026-11-18' },
  { fg: 'color-on-agent', bg: 'color-agent-hover', floor: 3, why: 'hovered primary button label' },
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
