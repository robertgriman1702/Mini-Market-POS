import type { ReactNode } from 'react';
import { useTheme }       from './ThemeProvider';

// =============================================================================
// Layout — Shell con sidebar de navegación + Theme Toggle
// =============================================================================

export type Page = 'pos' | 'inventory' | 'cash-close' | 'settings';

interface Props {
  current:   Page;
  onChange:  (p: Page) => void;
  children:  ReactNode;
  onLogout?: () => void;
}

const NAV: Array<{ id: Page; label: string; icon: JSX.Element }> = [
  {
    id: 'pos', label: 'Caja',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
  },
  {
    id: 'inventory', label: 'Inventario',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      </svg>
    ),
  },
  {
    id: 'cash-close', label: 'Cierre',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    id: 'settings', label: 'Config',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
];

export function Layout({ current, onChange, children, onLogout }: Props) {
  const { isDark, toggle } = useTheme();

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>

      {/* ── Sidebar ── */}
      <aside
        className="flex flex-col flex-shrink-0 h-full"
        style={{
          width:       '60px',
          background:  'var(--bg-surface)',
          borderRight: '1px solid var(--border-base)',
          boxShadow:   '2px 0 8px rgba(0,0,0,0.04)',
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center justify-center h-14 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-base)' }}
        >
          <div
            style={{
              width:        '28px',
              height:       '28px',
              borderRadius: '8px',
              background:   'var(--blue)',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              boxShadow:    '0 2px 8px rgba(37,99,235,0.35)',
            }}
          >
            {/* Icono de caja registradora mini */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2"/>
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
            </svg>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col flex-1 pt-1">
          {NAV.map(({ id, label, icon }) => (
            <button
              key={id}
              className={`nav-item ${current === id ? 'active' : ''}`}
              onClick={() => onChange(id)}
              title={label}
            >
              {icon}
              <span style={{ fontSize: '9px', letterSpacing: '0.04em' }}>{label}</span>
            </button>
          ))}
        </nav>

        {/* Bottom: theme toggle + logout */}
        <div
          className="flex flex-col items-center gap-1 pb-3 pt-2"
          style={{ borderTop: '1px solid var(--border-base)' }}
        >
          {/* Theme toggle */}
          <button
            className="nav-item"
            onClick={toggle}
            title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {isDark ? (
              /* Sun icon */
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              /* Moon icon */
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
            <span style={{ fontSize: '9px' }}>{isDark ? 'Claro' : 'Oscuro'}</span>
          </button>

          {/* Logout */}
          {onLogout && (
            <button
              className="nav-item"
              onClick={onLogout}
              title="Cerrar sesión"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span style={{ fontSize: '9px' }}>Salir</span>
            </button>
          )}

          {/* Version */}
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            v{window.electronAPI.appVersion}
          </span>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-hidden" style={{ background: 'var(--bg-base)' }}>
        {children}
      </main>

    </div>
  );
}