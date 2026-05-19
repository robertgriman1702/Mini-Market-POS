import React, { useState, useRef, useEffect } from 'react';
import type { LicenseStatus, AppConfig } from '@pos/shared';

// =============================================================================
// Login — Pantalla de acceso con PIN
//
// Aparece DESPUÉS de que la licencia es válida y ANTES del sistema principal.
// El PIN se verifica comparando el SHA-256 del input contra el hash en config.
// La verificación es local — sin IPC, sin red.
// =============================================================================

interface Props {
  config:  AppConfig;
  license: LicenseStatus;
  onLogin: () => void;
}

// SHA-256 via WebCrypto (disponible en Electron renderer)
async function sha256(text: string): Promise<string> {
  const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function Login({ config, license, onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const passRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Si solo hay un usuario (admin) y el username se llena, saltar al password
    if (username.toLowerCase() === 'admin') passRef.current?.focus();
  }, [username]);

  const handleSubmit = async () => {
    if (!username || !password) {
      setError('Ingresa usuario y contraseña.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const hash = await sha256(password);
      if (hash === config.pin) {
        onLogin();
      } else {
        setError('Contraseña incorrecta.');
        setPassword('');
        passRef.current?.focus();
      }
    } catch {
      setError('Error de verificación. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const isExpiring = license.expira_at
    ? new Date(license.expira_at) <= new Date(Date.now() + 7 * 86_400_000)
    : false;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center animate-fade-in"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Card */}
      <div
        className="w-full flex flex-col items-center gap-6 animate-fade-in"
        style={{
          maxWidth:     '360px',
          padding:      '40px 32px 28px',
          background:   'var(--bg-surface)',
          border:       '1px solid var(--border-dim)',
          borderRadius: '6px',
        }}
      >
        {/* ── Logo ── */}
        <Logo />

        {/* ── Inputs ── */}
        <div className="w-full flex flex-col gap-3">
          <InputField
            icon={<IconUser />}
            placeholder="Username"
            value={username}
            onChange={setUsername}
            onKeyDown={handleKey}
            autoFocus
          />
          <InputField
            ref={passRef}
            icon={<IconLock />}
            placeholder="Password"
            type="password"
            value={password}
            onChange={setPassword}
            onKeyDown={handleKey}
          />

          {error && (
            <p
              className="text-xs text-center font-mono animate-fade-in"
              style={{ color: 'var(--danger)' }}
            >
              {error}
            </p>
          )}
        </div>

        {/* ── Button ── */}
        <button
          className="w-full py-3 text-sm font-bold uppercase tracking-widest transition-all duration-150"
          style={{
            background:   loading
              ? 'var(--blue-dim)'
              : 'linear-gradient(135deg, #1a56db 0%, #3b82f6 100%)',
            color:        '#ffffff',
            border:       'none',
            borderRadius: '5px',
            opacity:      loading ? 0.7 : 1,
            cursor:       loading ? 'not-allowed' : 'pointer',
            letterSpacing: '0.12em',
          }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'Verificando...' : 'Access System'}
        </button>

        {/* ── Divider ── */}
        <div className="w-full" style={{ borderTop: '1px solid var(--border-dim)' }} />

        {/* ── Footer: Device ID + License status ── */}
        <div className="w-full flex justify-between items-center">
          {/* HWID */}
          <div>
            <span
              className="text-xs font-mono"
              style={{ color: 'var(--text-muted)' }}
            >
              Device ID:&nbsp;
            </span>
            <span
              className="text-xs font-mono font-semibold"
              style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}
            >
              {license.hwid}
            </span>
          </div>

          {/* License status */}
          {isExpiring ? (
            <span className="text-xs font-mono" style={{ color: 'var(--warn)' }}>
              ⚠ Vence pronto
            </span>
          ) : (
            <span
              className="flex items-center gap-1 text-xs font-medium"
              style={{ color: '#00c853' }}
            >
              <IconCheck />
              License Verified
            </span>
          )}
        </div>
      </div>

      {/* Help button — esquina inferior derecha */}
      <HelpButton />
    </div>
  );
}

// =============================================================================
// Sub-componentes
// =============================================================================

function Logo() {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width:     '80px',
        height:    '80px',
        borderRadius: '50%',
        background: 'radial-gradient(circle at center, #0d47a1 0%, #0a1929 100%)',
        boxShadow:  '0 0 0 3px #0d47a1, 0 0 24px rgba(41,121,255,0.35)',
      }}
    >
      {/* Ring exterior */}
      <div
        style={{
          position:     'absolute',
          inset:        '8px',
          borderRadius: '50%',
          border:       '2px solid #1565c0',
        }}
      />
      {/* Inner circle */}
      <div
        style={{
          width:        '36px',
          height:       '36px',
          borderRadius: '50%',
          background:   'radial-gradient(circle at 40% 35%, #64b5f6 0%, #1565c0 50%, #0d47a1 100%)',
          boxShadow:    'inset 0 2px 6px rgba(255,255,255,0.15)',
        }}
      />
    </div>
  );
}

interface InputFieldProps {
  icon:        React.ReactNode;
  placeholder: string;
  value:       string;
  onChange:    (v: string) => void;
  onKeyDown?:  (e: React.KeyboardEvent) => void;
  type?:       string;
  autoFocus?:  boolean;
}

const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  ({ icon, placeholder, value, onChange, onKeyDown, type = 'text', autoFocus }, ref) => {
    const [focused, setFocused] = useState(false);

    return (
      <div
        className="flex items-center w-full transition-all duration-150"
        style={{
          background:   'var(--bg-elevated)',
          border:       `1px solid ${focused ? 'var(--blue)' : 'var(--border-base)'}`,
          borderRadius: '4px',
          boxShadow:    focused ? '0 0 0 2px rgba(41,121,255,0.15)' : 'none',
          paddingLeft:  '12px',
        }}
      >
        <span style={{ color: focused ? 'var(--blue)' : 'var(--text-muted)', flexShrink: 0 }}>
          {icon}
        </span>
        <input
          ref={ref}
          type={type}
          placeholder={placeholder}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex:        1,
            background:  'transparent',
            border:      'none',
            outline:     'none',
            padding:     '12px 12px 12px 10px',
            fontSize:    '14px',
            color:       'var(--text-primary)',
            fontFamily:  'Inter, system-ui, sans-serif',
          }}
        />
      </div>
    );
  }
);
InputField.displayName = 'InputField';

function HelpButton() {
  return (
    <button
      title="Ayuda / Soporte"
      style={{
        position:     'fixed',
        bottom:       '20px',
        right:        '20px',
        width:        '32px',
        height:       '32px',
        borderRadius: '50%',
        background:   'var(--bg-elevated)',
        border:       '1px solid var(--border-base)',
        color:        'var(--text-muted)',
        fontSize:     '13px',
        fontWeight:   700,
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'center',
        cursor:       'pointer',
        transition:   'all 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--blue)';
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--blue)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-base)';
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
      }}
    >
      ?
    </button>
  );
}

// ── SVG icons inline — sin dependencias externas ──

function IconUser() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}