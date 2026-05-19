import { useState }             from 'react';
import { useQuery }             from '@/hooks';
import type { AppConfig }       from '@pos/shared';

// =============================================================================
// CashClose — Cierre de Caja diario
// =============================================================================

interface Props { config: AppConfig }

const fmt$ = (c: number, m: string) => `${m}${(c / 100).toFixed(2)}`;
const today = () => new Date().toISOString().split('T')[0];

export function CashClose({ config }: Props) {
  const [fecha, setFecha] = useState(today());

  const { data: cierre, isLoading, error, refetch } =
    useQuery('reportes:cierreCaja', fecha);

  const pct = (val: number) =>
    cierre && cierre.total_ventas > 0
      ? Math.round((val / cierre.total_ventas) * 100)
      : 0;

  const METODOS = [
    { key: 'efectivo'      as const, label: 'Efectivo',      icon: '💵', color: 'var(--green)' },
    { key: 'tarjeta'       as const, label: 'Tarjeta',       icon: '💳', color: 'var(--blue)' },
    { key: 'transferencia' as const, label: 'Transferencia', icon: '⇄',  color: 'var(--warn)' },
  ];

  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-surface)' }}
      >
        <h1 className="text-sm font-semibold uppercase tracking-widest">
          Cierre de Caja
        </h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="input-base text-xs w-40"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            max={today()}
            data-selectable
          />
          <button className="btn-ghost text-xs" onClick={refetch}>
            Actualizar
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center flex-1">
          <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>Cargando...</p>
        </div>
      )}

      {error && (
        <div className="m-4 p-3 text-xs" style={{ background: 'rgba(244,67,54,0.08)', color: 'var(--danger)', border: '1px solid rgba(244,67,54,0.2)' }}>
          {error}
        </div>
      )}

      {cierre && (
        <div className="p-4 flex flex-col gap-4">

          {/* KPI cards row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total Vendido', value: fmt$(cierre.total_ventas, config.moneda), accent: 'var(--green)' },
              { label: 'Transacciones', value: cierre.cantidad_ventas.toString(), accent: 'var(--blue)' },
              { label: 'Items Vendidos', value: cierre.total_items.toString(), accent: 'var(--warn)' },
              { label: 'Ticket Promedio', value: fmt$(cierre.venta_promedio, config.moneda), accent: 'var(--text-secondary)' },
            ].map(({ label, value, accent }) => (
              <div
                key={label}
                className="p-4"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-dim)' }}
              >
                <p className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                  {label}
                </p>
                <p className="text-xl font-mono font-semibold" style={{ color: accent }}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Payment method breakdown */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-dim)' }}>
            <div className="section-header">Desglose por Método de Pago</div>
            <div className="p-4 flex flex-col gap-3">
              {METODOS.map(({ key, label, icon, color }) => {
                const val = cierre.por_metodo[key];
                const p   = pct(val);
                return (
                  <div key={key} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                        <span>{icon}</span> {label}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{p}%</span>
                        <span className="font-mono text-sm font-semibold" style={{ color }}>
                          {fmt$(val, config.moneda)}
                        </span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div
                      className="h-1 w-full rounded-full overflow-hidden"
                      style={{ background: 'var(--bg-elevated)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${p}%`, background: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hour pico + footer */}
          <div
            className="flex items-center justify-between p-4"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-dim)' }}
          >
            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
                Hora Pico
              </p>
              <p className="font-mono text-lg" style={{ color: 'var(--text-primary)' }}>
                {cierre.hora_pico ?? '—'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
                Fecha del Cierre
              </p>
              <p className="font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>
                {new Date(fecha + 'T12:00:00').toLocaleDateString('es', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                })}
              </p>
            </div>
          </div>

        </div>
      )}

      {!isLoading && !error && !cierre && (
        <div className="flex items-center justify-center flex-1">
          <p className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Sin ventas registradas para esta fecha
          </p>
        </div>
      )}
    </div>
  );
}
