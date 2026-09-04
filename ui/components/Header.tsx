/**
 * The window toolbar: brand, view switcher, audited URL, appearance toggle.
 *
 * Shaped after a macOS unified toolbar rather than a web navbar — frosted
 * material over the scrolling content, a hairline separator instead of a drop
 * shadow, a segmented control for the view switch, and left padding that
 * clears the traffic lights.
 */

import { useTheme } from '../hooks/useTheme.js';
import { Logo } from './Logo.js';

interface HeaderProps {
  url?: string | null;
  crawledPages?: number;
  activeView: 'audit' | 'history';
  onViewChange: (view: 'audit' | 'history') => void;
}

export function Header({ url, crawledPages, activeView, onViewChange }: HeaderProps) {
  const { theme, toggle } = useTheme();

  return (
    <header
      className="toolbar drag-region fixed top-0 left-0 right-0 h-[var(--header-height)] z-50 flex items-center pl-[var(--traffic-light-width)] pr-3 gap-3"
    >
      {/* Brand. The lockup names the product, so no text beside it; its
          wordmark is painted in currentColor and follows the theme. */}
      <div className="flex items-center shrink-0" style={{ color: 'var(--color-text)' }}>
        <Logo height={20} />
      </div>

      {/* View switcher */}
      <nav className="segmented no-drag shrink-0 ml-1" role="tablist" aria-label="View">
        <Segment
          label="Audit"
          active={activeView === 'audit'}
          onClick={() => onViewChange('audit')}
        />
        <Segment
          label="History"
          active={activeView === 'history'}
          onClick={() => onViewChange('history')}
        />
      </nav>

      {/* Audited document. Centred like a native window title, and allowed to
          truncate rather than push the controls around. */}
      <div className="flex-1 flex items-center justify-center gap-2 min-w-0 px-2">
        {url && (
          <>
            <span
              className="text-xs truncate"
              style={{ color: 'var(--color-text-muted)' }}
              title={url}
            >
              {url}
            </span>
            {crawledPages != null && crawledPages > 1 && (
              <span
                className="text-xs px-2 py-0.5 rounded-full shrink-0"
                style={{
                  backgroundColor: 'var(--color-info-bg)',
                  color: 'var(--color-info)',
                }}
              >
                {crawledPages} pages
              </span>
            )}
          </>
        )}
      </div>

      {/* Appearance */}
      <button
        onClick={toggle}
        className="toolbar-button no-drag shrink-0"
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} appearance`}
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} appearance`}
      >
        {theme === 'light' ? <MoonIcon /> : <SunIcon />}
      </button>
    </header>
  );
}

function Segment({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`segment ${active ? 'segment-active' : ''}`}
    >
      {label}
    </button>
  );
}

/**
 * Stroked 16px glyphs, drawn in currentColor.
 *
 * The toggle previously rendered the ☀/☾ text characters, which pick up the
 * emoji font and sit on the text baseline — the giveaway that a control was
 * typed rather than drawn.
 */
function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}
