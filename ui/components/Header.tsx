/**
 * The window toolbar: brand, view switcher, audited URL, appearance toggle.
 *
 * Shaped after a macOS unified toolbar rather than a web navbar — frosted
 * material over the scrolling content, a hairline separator instead of a drop
 * shadow, a segmented control for the view switch, and left padding that
 * clears the traffic lights.
 */

import { NavLink, useLocation } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme.js';
import { Logo } from './Logo.js';

interface HeaderProps {
  /** Whether this host can start an audit; the web build cannot until Phase 3 */
  canRunAudits: boolean;
}

export function Header({ canRunAudits }: HeaderProps) {
  const { theme, toggle } = useTheme();
  const { pathname } = useLocation();

  return (
    <header
      className="toolbar drag-region fixed top-0 left-0 right-0 h-[var(--header-height)] z-50 flex items-center pl-[var(--traffic-light-width)] pr-3 gap-3"
    >
      {/* Brand. The lockup names the product, so no text beside it; its
          wordmark is painted in currentColor and follows the theme. */}
      <div className="flex items-center shrink-0" style={{ color: 'var(--color-text)' }}>
        <Logo height={20} />
      </div>

      {/* View switcher. Real links, so the browser's back button and
          Cmd-click behave the way the URL bar promises they will. */}
      <nav className="segmented no-drag shrink-0 ml-1" aria-label="View">
        <Segment to="/" label="History" active={pathname === '/'} />
        {canRunAudits && <Segment to="/run" label="New audit" active={pathname === '/run'} />}
      </nav>

      <div className="flex-1 min-w-0 px-2" />

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

function Segment({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <NavLink
      to={to}
      aria-current={active ? 'page' : undefined}
      className={`segment ${active ? 'segment-active' : ''}`}
    >
      {label}
    </NavLink>
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
