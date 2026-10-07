import type { AppConfig } from '@pos/shared';

// =============================================================================
// CajaInicio — Pantalla inicial del módulo de Caja
//
// Punto de entrada tras una apertura de caja vigente. Solo dos acciones:
// iniciar una venta nueva (pasa por identificación obligatoria de cliente)
// o continuar una venta suspendida existente. El POS nunca se muestra
// directamente desde aquí.
// =============================================================================

interface Props {
  config:          AppConfig;
  onNuevaVenta:    () => void;
  onContinuarVenta: () => void;
}

export function CajaInicio({ onNuevaVenta, onContinuarVenta }: Props) {
  return (
    <div
      className="flex flex-col items-center justify-center h-full animate-fade-in"
      style={{ background: 'var(--bg-base)' }}
    >
      <div
        className="w-full flex flex-col items-center gap-6"
        style={{ maxWidth: '420px', padding: '0 24px' }}
      >
        {/* Icono */}
        <div
          style={{
            width: '56px', height: '56px', borderRadius: '14px',
            background: 'var(--blue)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(37,99,235,0.3)',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2"/>
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
          </svg>
        </div>

        <div className="text-center">
          <h1 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>
            Caja
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            ¿Qué deseas hacer?
          </p>
        </div>

        {/* Acciones */}
        <div className="w-full flex flex-col gap-3">
          <button
            className="card flex items-center gap-4 p-5 text-left transition-all duration-150"
            style={{ cursor: 'pointer', border: '1px solid var(--border-base)' }}
            onClick={onNuevaVenta}
          >
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: '42px', height: '42px', borderRadius: '10px',
                background: 'var(--green-light)', border: '1px solid var(--green-border)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Nueva Venta</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Identifica al cliente y abre el punto de venta
              </p>
            </div>
          </button>

          <button
            className="card flex items-center gap-4 p-5 text-left transition-all duration-150"
            style={{ cursor: 'pointer', border: '1px solid var(--border-base)' }}
            onClick={onContinuarVenta}
          >
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: '42px', height: '42px', borderRadius: '10px',
                background: 'var(--blue-light)', border: '1px solid var(--blue-border)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 12 9 6 13 10 21 2"/><polyline points="16 2 21 2 21 7"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Continuar Venta</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Recupera una venta suspendida en curso
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}