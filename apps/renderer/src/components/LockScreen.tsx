import { useState }     from 'react';
import { useMutation }  from '@/hooks';
import type { LicenseStatus } from '@pos/shared';

// =============================================================================
// LockScreen — Pantalla de licencia inválida o no encontrada
//
// Flujo para usuario nuevo:
//   1. Ve su Device ID
//   2. Contacta al distribuidor (tú) con ese ID
//   3. Recibe el contenido del .key por WhatsApp/email
//   4. Lo pega en el campo "Activar licencia"
//   5. Presiona "Activar" → app desbloqueada
// =============================================================================

interface Props {
  status:   LicenseStatus;
  onUnlock: () => void;
}

export function LockScreen({ status, onUnlock }: Props) {
  const [tab,     setTab]     = useState<'info' | 'activate'>('info');
  const [keyText, setKeyText] = useState('');
  const [copied,  setCopied]  = useState(false);

  const { mutate: activate, isLoading, error } = useMutation('system:activateLicense', {
    onSuccess: (result) => {
      if (result && typeof result === 'object' && 'estado' in result) {
        const res = result as LicenseStatus;
        if (res.estado === 'valid') onUnlock();
      }
    },
  });

  const copyHwid = () => {
    navigator.clipboard.writeText(status.hwid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isExpired   = status.estado === 'expired';
  const isInvalid   = status.estado === 'invalid';

  return (
    <div
      className="fixed inset-0 flex items-center justify-center animate-fade-in"
      style={{ background: 'var(--bg-base)' }}
    >
      <div
        className="flex flex-col w-full animate-fade-in"
        style={{
          maxWidth:     '400px',
          background:   'var(--bg-surface)',
          border:       '1px solid var(--border-base)',
          borderRadius: '8px',
          boxShadow:    'var(--shadow-modal)',
          overflow:     'hidden',
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-5"
          style={{
            background:   isExpired ? 'var(--warn-light)' : 'var(--danger-light)',
            borderBottom: `1px solid ${isExpired ? 'rgba(217,119,6,0.2)' : 'var(--danger-border)'}`,
          }}
        >
          <div className="flex items-center gap-3">
            <span style={{ fontSize: '1.5rem' }}>
              {isExpired ? '⏰' : '🔒'}
            </span>
            <div>
              <h1 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                {isExpired  ? 'Licencia expirada'
                 : isInvalid ? 'Licencia no válida'
                 : 'Activación requerida'}
              </h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {isExpired
                  ? 'Contacta al soporte para renovar tu licencia.'
                  : 'Necesitas una licencia para usar este sistema.'}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div
          className="flex"
          style={{ borderBottom: '1px solid var(--border-base)' }}
        >
          {(['info', 'activate'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex:          1,
                padding:       '10px',
                fontSize:      '12px',
                fontWeight:    tab === t ? 700 : 400,
                color:         tab === t ? 'var(--blue)' : 'var(--text-muted)',
                background:    tab === t ? 'var(--blue-light)' : 'transparent',
                border:        'none',
                borderBottom:  tab === t ? '2px solid var(--blue)' : '2px solid transparent',
                cursor:        'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                transition:    'all 0.1s',
              }}
            >
              {t === 'info' ? 'Mi dispositivo' : 'Activar licencia'}
            </button>
          ))}
        </div>

        {/* Tab: Info */}
        {tab === 'info' && (
          <div className="p-6 flex flex-col gap-4 animate-fade-in">
            <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Para activar el sistema, comunícate con tu distribuidor y
              proporciona el <strong>Device ID</strong> de este equipo.
            </p>

            {/* Device ID */}
            <div
              className="p-4 rounded-lg flex items-center justify-between gap-3"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-base)' }}
            >
              <div>
                <p className="stat-label mb-1">Device ID</p>
                <p
                  className="font-mono font-bold"
                  style={{ fontSize: '1.1rem', letterSpacing: '0.08em', color: 'var(--text-primary)' }}
                >
                  {status.hwid}
                </p>
              </div>
              <button
                className="btn-ghost text-xs"
                style={{ whiteSpace: 'nowrap', padding: '6px 12px' }}
                onClick={copyHwid}
              >
                {copied ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>

            {/* Contacto */}
            <div
              className="p-3 rounded-lg text-xs"
              style={{ background: 'var(--blue-light)', border: '1px solid var(--blue-border)', color: 'var(--blue)', lineHeight: 1.6 }}
            >
              📞 Contacta a tu distribuidor con el Device ID para obtener
              tu código de activación.
            </div>

            <button
              className="btn-primary mt-1"
              onClick={() => setTab('activate')}
            >
              Ya tengo mi código → Activar
            </button>
          </div>
        )}

        {/* Tab: Activate */}
        {tab === 'activate' && (
          <div className="p-6 flex flex-col gap-4 animate-fade-in">
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Pega aquí el código de licencia que te envió tu distribuidor.
            </p>

            <textarea
              placeholder="Pega tu código de licencia aquí..."
              value={keyText}
              onChange={(e) => setKeyText(e.target.value)}
              data-selectable
              rows={4}
              style={{
                width:        '100%',
                background:   'var(--bg-elevated)',
                border:       `1px solid ${error ? 'var(--danger)' : 'var(--border-base)'}`,
                borderRadius: '6px',
                color:        'var(--text-primary)',
                padding:      '10px 12px',
                fontSize:     '11px',
                fontFamily:   'JetBrains Mono, monospace',
                outline:      'none',
                resize:       'none',
                transition:   'border-color 0.15s',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--blue)')}
              onBlur={(e)  => (e.target.style.borderColor = error ? 'var(--danger)' : 'var(--border-base)')}
            />

            {error && (
              <p className="text-xs animate-fade-in" style={{ color: 'var(--danger)' }}>
                ✕ {error}
              </p>
            )}

            <button
              className="btn-primary"
              disabled={!keyText.trim() || isLoading}
              onClick={() => activate(keyText.trim())}
            >
              {isLoading ? 'Verificando...' : 'Activar sistema'}
            </button>
          </div>
        )}

        {/* Footer */}
        <div
          className="px-6 py-3 flex items-center justify-between"
          style={{ borderTop: '1px solid var(--border-dim)' }}
        >
          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
            POS MiniMarket v{window.electronAPI.appVersion}
          </span>
          <button className="help-btn" style={{ position: 'static' }} title="Soporte">
            ?
          </button>
        </div>
      </div>
    </div>
  );
}