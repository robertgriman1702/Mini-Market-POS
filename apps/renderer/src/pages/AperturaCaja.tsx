import { useState, useRef, useEffect } from 'react';
import { useMutation }                  from '@/hooks';
import type { AppConfig, AperturaCaja as AperturaCajaEntity } from '@pos/shared';

// =============================================================================
// AperturaCaja — Apertura obligatoria de caja antes de operar el POS
//
// Se muestra cuando no existe una apertura vigente para la fecha actual.
// No hay tabla de usuarios real en el sistema (login es un PIN único), por
// lo que el campo "usuario" se solicita como texto libre.
// =============================================================================

interface Props {
  config:    AppConfig;
  fecha:     string; // 'YYYY-MM-DD'
  onAbierta: (apertura: AperturaCajaEntity) => void;
}

const fmt$ = (centavos: number, moneda: string) =>
  `${moneda}${(centavos / 100).toFixed(2)}`;

export function AperturaCaja({ config, fecha, onAbierta }: Props) {
  const [fondo,         setFondo]         = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [usuario,       setUsuario]       = useState('');
  const [error,         setError]         = useState('');
  const usuarioRef = useRef<HTMLInputElement>(null);

  useEffect(() => { usuarioRef.current?.focus(); }, []);

  const { mutate: abrir, isLoading } = useMutation('cajaSesion:abrir', {
    onSuccess: (apertura) => { if (apertura) onAbierta(apertura); },
    onError:   (err) => setError(err),
  });

  const fondoCentavos = Math.round(parseFloat(fondo || '0') * 100);

  const handleSubmit = () => {
    if (!usuario.trim()) { setError('El usuario es obligatorio.'); return; }
    if (!fondo || fondoCentavos < 0) { setError('Ingresa un fondo inicial válido.'); return; }
    setError('');
    abrir({
      fondo_inicial: fondoCentavos,
      observaciones: observaciones.trim() || null,
      usuario:       usuario.trim(),
      fecha,
    });
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div
      className="flex flex-col items-center justify-center h-full animate-fade-in"
      style={{ background: 'var(--bg-base)' }}
      onKeyDown={handleKey}
    >
      <div
        className="w-full flex flex-col"
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
          style={{ background: 'var(--blue-light)', borderBottom: '1px solid var(--blue-border)' }}
        >
          <div className="flex items-center gap-3">
            <span style={{ fontSize: '1.4rem' }}>🗄️</span>
            <div>
              <h1 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                Apertura de Caja
              </h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Requerida antes de operar el punto de venta hoy
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 flex flex-col gap-4">
          <div>
            <label className="stat-label" style={{ display: 'block', marginBottom: '5px' }}>
              Usuario *
            </label>
            <input
              ref={usuarioRef}
              className="input-base text-sm"
              placeholder="Nombre del cajero"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              data-selectable
            />
          </div>

          <div>
            <label className="stat-label" style={{ display: 'block', marginBottom: '5px' }}>
              Fondo inicial *
            </label>
            <div className="flex items-center gap-2">
              <span className="text-lg font-mono" style={{ color: 'var(--text-muted)' }}>
                {config.moneda}
              </span>
              <input
                type="number" min="0" step="0.01" placeholder="0.00"
                value={fondo}
                onChange={(e) => setFondo(e.target.value)}
                data-selectable
                style={{
                  flex: 1, background: 'var(--bg-base)',
                  border: '2px solid var(--border-loud)', borderRadius: '6px',
                  color: 'var(--text-primary)', padding: '10px 12px',
                  fontSize: '1.3rem', fontFamily: 'monospace', fontWeight: 700,
                  outline: 'none',
                }}
              />
            </div>
            {fondo && fondoCentavos >= 0 && (
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                Fondo registrado: {fmt$(fondoCentavos, config.moneda)}
              </p>
            )}
          </div>

          <div>
            <label className="stat-label" style={{ display: 'block', marginBottom: '5px' }}>
              Observaciones <span style={{ color: 'var(--text-muted)' }}>(opcional)</span>
            </label>
            <textarea
              className="input-base text-sm"
              placeholder="Notas sobre esta apertura..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              data-selectable
              rows={3}
              style={{ resize: 'none' }}
            />
          </div>

          {error && (
            <p className="text-xs animate-fade-in" style={{ color: 'var(--danger)' }}>
              ✕ {error}
            </p>
          )}

          <button
            className="btn-primary mt-1"
            disabled={isLoading || !usuario.trim() || !fondo}
            onClick={handleSubmit}
          >
            {isLoading ? 'Abriendo caja...' : 'Abrir Caja'}
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-3" style={{ borderTop: '1px solid var(--border-dim)' }}>
          <p className="text-xs font-mono text-center" style={{ color: 'var(--text-muted)' }}>
            Jornada: {fecha}
          </p>
        </div>
      </div>
    </div>
  );
}