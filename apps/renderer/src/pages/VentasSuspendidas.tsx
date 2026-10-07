import { useState }              from 'react';
import { useQuery, useMutation } from '@/hooks';
import type { AppConfig, VentaSuspendida } from '@pos/shared';

// =============================================================================
// VentasSuspendidas — Pantalla intermedia de "Continuar Venta"
//
// Solo lista ventas en estado 'suspendida' (pendientes de continuar).
// Si no hay ninguna, se muestra el aviso fijo y NUNCA se abre el POS vacío.
// =============================================================================

interface Props {
  config:        AppConfig;
  onContinuar:   (venta: VentaSuspendida) => void;
  onVolver:      () => void;
}

const fmt$ = (centavos: number, moneda: string) =>
  `${moneda}${(centavos / 100).toFixed(2)}`;

export function VentasSuspendidas({ config, onContinuar, onVolver }: Props) {
  const [eliminarId, setEliminarId] = useState<number | null>(null);

  const { data: ventas, isLoading, error, refetch } =
    useQuery('ventasSuspendidas:listar');

  const { mutate: eliminar, isLoading: eliminando } =
    useMutation('ventasSuspendidas:eliminar', {
      onSuccess: () => { setEliminarId(null); refetch(); },
    });

  const subtotalDe = (venta: VentaSuspendida) =>
    venta.items.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0) - venta.descuento;

  const itemCountDe = (venta: VentaSuspendida) =>
    venta.items.reduce((s, i) => s + i.cantidad, 0);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-surface)' }}
      >
        <div className="flex items-center gap-3">
          <button className="btn-ghost text-xs" onClick={onVolver}>
            ← Volver
          </button>
          <h1 className="text-sm font-semibold uppercase tracking-widest">
            Ventas Suspendidas
          </h1>
        </div>
        <button className="btn-ghost text-xs" onClick={refetch}>
          Actualizar
        </button>
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

      {/* Sin ventas pendientes */}
      {!isLoading && !error && ventas && ventas.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3">
          <div style={{ color: 'var(--text-muted)', fontSize: '2.5rem', opacity: 0.2 }}>⊞</div>
          <p className="text-sm font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
            No existen ventas pendientes para continuar
          </p>
          <button className="btn-ghost text-xs mt-2" onClick={onVolver}>
            Volver al inicio de Caja
          </button>
        </div>
      )}

      {/* Lista de ventas suspendidas */}
      {!isLoading && !error && ventas && ventas.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          <div
            className="grid text-xs font-semibold uppercase tracking-widest px-4 py-2 flex-shrink-0"
            style={{
              gridTemplateColumns: '90px 1fr 160px 90px 110px 160px',
              color: 'var(--text-muted)', borderBottom: '1px solid var(--border-dim)',
              background: 'var(--bg-elevated)',
            }}
          >
            <span>N° Venta</span>
            <span>Cliente</span>
            <span>Fecha / Hora</span>
            <span className="text-right">Items</span>
            <span className="text-right">Total parcial</span>
            <span className="text-right">Acciones</span>
          </div>

          {ventas.map((venta) => {
            const fecha = new Date(venta.created_at);
            return (
              <div
                key={venta.id}
                className="table-row animate-fade-in"
                style={{ gridTemplateColumns: '90px 1fr 160px 90px 110px 160px', display: 'grid' }}
              >
                <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                  #{venta.id}
                </span>
                <span className="text-sm truncate pr-2">
                  {venta.cliente_id ? `Cliente #${venta.cliente_id}` : 'Sin cliente'}
                </span>
                <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {fecha.toLocaleDateString('es')} · {fecha.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-right font-mono text-sm">
                  {itemCountDe(venta)}
                </span>
                <span className="text-right font-mono text-sm font-semibold">
                  {fmt$(subtotalDe(venta), config.moneda)}
                </span>
                <div className="flex items-center justify-end gap-2">
                  <button
                    className="btn-ghost text-xs"
                    style={{ padding: '4px 10px' }}
                    onClick={() => onContinuar(venta)}
                  >
                    Continuar
                  </button>
                  <button
                    className="btn-danger text-xs"
                    style={{ padding: '4px 10px' }}
                    onClick={() => setEliminarId(venta.id)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmación de eliminación */}
      {eliminarId !== null && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.7)' }}
        >
          <div
            className="flex flex-col gap-5 p-6 w-72"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-loud)', borderRadius: '6px' }}
          >
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                ¿Eliminar la venta suspendida #{eliminarId}?
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="btn-ghost flex-1 text-xs"
                onClick={() => setEliminarId(null)}
                disabled={eliminando}
              >
                Cancelar
              </button>
              <button
                className="flex-1 text-xs font-semibold py-2 px-3 rounded"
                style={{ background: 'var(--danger)', color: '#fff', border: 'none', cursor: 'pointer' }}
                onClick={() => eliminar(eliminarId)}
                disabled={eliminando}
              >
                {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}