/**
 * Fixed header with logo, audited URL info, and theme toggle.
 * Left padding accounts for macOS traffic light buttons.
 */

import { useTheme } from '../hooks/useTheme.js';

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
      className="fixed top-0 left-0 right-0 h-[var(--header-height)] bg-[var(--color-bg-elevated)] border-b border-[var(--color-border)] z-50 flex items-center pl-[var(--traffic-light-width)] pr-5 gap-4 drag-region"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
          style={{ background: 'linear-gradient(135deg, var(--color-accent), #3b82f6)' }}
        >
          S
        </div>
        <span className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
          SEOmator
        </span>
      </div>

      {/* Separator */}
      <div className="w-px h-5 shrink-0" style={{ backgroundColor: 'var(--color-border)' }} />

      {/* Nav tabs */}
      <nav className="flex gap-1 no-drag shrink-0">
        <NavTab
          label="Audit"
          active={activeView === 'audit'}
          onClick={() => onViewChange('audit')}
        />
        <NavTab
          label="History"
          active={activeView === 'history'}
          onClick={() => onViewChange('history')}
        />
      </nav>

      {/* URL info */}
      <div className="flex-1 flex items-center gap-2.5 min-w-0 no-drag">
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

      {/* Theme toggle */}
      <button
        onClick={toggle}
        className="no-drag w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--color-bg-hover)] transition-colors shrink-0"
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        <span className="text-base">{theme === 'light' ? '\u263E' : '\u2600'}</span>
      </button>
    </header>
  );
}

function NavTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        active
          ? 'bg-[var(--color-accent-light)]'
          : 'hover:bg-[var(--color-bg-hover)]'
      }`}
      style={{
        color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
      }}
    >
      {label}
    </button>
  );
}
