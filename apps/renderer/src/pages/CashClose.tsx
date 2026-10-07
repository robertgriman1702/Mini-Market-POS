import { useState, useRef }     from 'react';
import { useQuery }             from '@/hooks';
import type { AppConfig, CierreCaja } from '@pos/shared';

// =============================================================================
// CashClose — Cierre de Caja diario (versión avanzada)
//
// El canal 'reportes:cierreCaja' sigue declarado como CierreCaja en
// packages/shared (sin cambios en este bloque), pero el backend envía en
// runtime campos adicionales de análisis avanzado. Se define aquí un tipo
// local que extiende CierreCaja y se hace un cast explícito sobre el dato
// recibido — no se inventa la forma del backend, se documenta la
// extensión real que ya implementa system.handler.ts.
// =============================================================================

interface TopCliente {
  cliente_id: number;
  nombre:     string;
  total:      number;
  compras:    number;
}

interface ProductoVendido {
  producto_id: number;
  nombre:      string;
  cantidad:    number;
  facturado:   number;
}

interface ProductoSinMovimiento {
  producto_id: number;
  nombre:      string;
}

interface ControlEfectivo {
  fondo_inicial:     number;
  efectivo_esperado: number;
  efectivo_contado:  number | null;
  diferencia:        number | null;
  sobrante:          number | null;
  faltante:          number | null;
}

interface CierreCajaAvanzado extends CierreCaja {
  clientes_atendidos:          number;
  cliente_top:                 { nombre: string; total: number } | null;
  top_clientes:                 TopCliente[];
  productos_mas_vendidos:        ProductoVendido[];
  productos_mayor_facturacion:   ProductoVendido[];
  productos_sin_movimiento:      ProductoSinMovimiento[];
  control_efectivo:             ControlEfectivo;
  ventas_anuladas:               number;
  ventas_con_descuento:          number;
  total_descontado:              number;
  primera_venta:                 string | null;
  ultima_venta:                  string | null;
}

interface Props { config: AppConfig }

const fmt$  = (c: number, m: string) => `${m}${(c / 100).toFixed(2)}`;
const today = () => new Date().toISOString().split('T')[0];
const fmtHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '—';

export function CashClose({ config }: Props) {
  const [fecha, setFecha] = useState(today());
  const [efectivoContado, setEfectivoContado] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error, refetch } =
    useQuery('reportes:cierreCaja', fecha);

  const cierre = data as CierreCajaAvanzado | null;

  const pct = (val: number) =>
    cierre && cierre.total_ventas > 0
      ? Math.round((val / cierre.total_ventas) * 100)
      : 0;

  const METODOS = [
    { key: 'efectivo'      as const, label: 'Efectivo',      icon: '💵', color: 'var(--green)' },
    { key: 'tarjeta'       as const, label: 'Tarjeta',       icon: '💳', color: 'var(--blue)' },
    { key: 'transferencia' as const, label: 'Transferencia', icon: '⇄',  color: 'var(--warn)' },
  ];

  const contadoCentavos = efectivoContado.trim()
    ? Math.round(parseFloat(efectivoContado) * 100)
    : null;

  const diferencia = cierre && contadoCentavos !== null
    ? contadoCentavos - cierre.control_efectivo.efectivo_esperado
    : null;
  const sobrante = diferencia !== null ? Math.max(0, diferencia)  : null;
  const faltante = diferencia !== null ? Math.max(0, -diferencia) : null;

  // ── Exportación CSV (sin dependencias nuevas, descarga local) ──
  const exportarCSV = () => {
    if (!cierre) return;
    const rows: (string | number)[][] = [
      ['Cierre de Caja', cierre.fecha],
      [],
      ['Resumen General'],
      ['Total Vendido',    (cierre.total_ventas / 100).toFixed(2)],
      ['Transacciones',    cierre.cantidad_ventas],
      ['Items Vendidos',   cierre.total_items],
      ['Ticket Promedio',  (cierre.venta_promedio / 100).toFixed(2)],
      ['Clientes Atendidos', cierre.clientes_atendidos],
      [],
      ['Análisis de Pagos'],
      ['Efectivo',      (cierre.por_metodo.efectivo / 100).toFixed(2)],
      ['Tarjeta',        (cierre.por_metodo.tarjeta / 100).toFixed(2)],
      ['Transferencia',  (cierre.por_metodo.transferencia / 100).toFixed(2)],
      ['Mixto',          (cierre.por_metodo.mixto / 100).toFixed(2)],
      [],
      ['Top Clientes'],
      ['Cliente', 'Compras', 'Total'],
      ...cierre.top_clientes.map((c) => [c.nombre, c.compras, (c.total / 100).toFixed(2)]),
      [],
      ['Productos Más Vendidos'],
      ['Producto', 'Cantidad', 'Facturado'],
      ...cierre.productos_mas_vendidos.map((p) => [p.nombre, p.cantidad, (p.facturado / 100).toFixed(2)]),
      [],
      ['Control de Efectivo'],
      ['Fondo Inicial',     (cierre.control_efectivo.fondo_inicial / 100).toFixed(2)],
      ['Efectivo Esperado', (cierre.control_efectivo.efectivo_esperado / 100).toFixed(2)],
      ['Efectivo Contado',  contadoCentavos !== null ? (contadoCentavos / 100).toFixed(2) : ''],
      ['Diferencia',        diferencia !== null ? (diferencia / 100).toFixed(2) : ''],
      [],
      ['Incidencias'],
      ['Ventas Anuladas',     cierre.ventas_anuladas],
      ['Ventas con Descuento', cierre.ventas_con_descuento],
      ['Total Descontado',    (cierre.total_descontado / 100).toFixed(2)],
    ];

    const csv = rows.map((r) => r.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cierre-caja-${fecha}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Exportar PDF / Impresión directa: usa el diálogo nativo del sistema ──
  const imprimirOExportarPDF = () => {
    window.print();
  };

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
          <button className="btn-ghost text-xs" onClick={exportarCSV} disabled={!cierre}>
            Exportar CSV
          </button>
          <button className="btn-primary" style={{ width: 'auto', padding: '8px 16px' }} onClick={imprimirOExportarPDF} disabled={!cierre}>
            Exportar PDF / Imprimir
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
        <div className="p-4 flex flex-col gap-4" ref={printRef}>

          {/* KPI cards row */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Total Vendido',     value: fmt$(cierre.total_ventas, config.moneda), accent: 'var(--green)' },
              { label: 'Transacciones',     value: cierre.cantidad_ventas.toString(), accent: 'var(--blue)' },
              { label: 'Items Vendidos',    value: cierre.total_items.toString(), accent: 'var(--warn)' },
              { label: 'Ticket Promedio',   value: fmt$(cierre.venta_promedio, config.moneda), accent: 'var(--text-secondary)' },
              { label: 'Clientes Atendidos', value: cierre.clientes_atendidos.toString(), accent: 'var(--blue)' },
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

          <div className="grid grid-cols-2 gap-4">

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

            {/* Control de Efectivo */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-dim)' }}>
              <div className="section-header">Control de Efectivo</div>
              <div className="p-4 flex flex-col gap-3">
                <div className="stat-row">
                  <span className="stat-label">Fondo Inicial</span>
                  <span className="stat-value">{fmt$(cierre.control_efectivo.fondo_inicial, config.moneda)}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Efectivo Esperado</span>
                  <span className="stat-value">{fmt$(cierre.control_efectivo.efectivo_esperado, config.moneda)}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="stat-label">Efectivo Contado</span>
                  <input
                    type="number" min="0" step="0.01" placeholder="0.00"
                    className="input-base text-xs"
                    style={{ width: '110px', textAlign: 'right', fontFamily: 'monospace' }}
                    value={efectivoContado}
                    onChange={(e) => setEfectivoContado(e.target.value)}
                    data-selectable
                  />
                </div>
                {diferencia !== null && (
                  <>
                    <div className="stat-row">
                      <span className="stat-label">Diferencia</span>
                      <span
                        className="stat-value"
                        style={{ color: diferencia === 0 ? 'var(--green)' : diferencia > 0 ? 'var(--blue)' : 'var(--danger)' }}
                      >
                        {diferencia >= 0 ? '+' : ''}{fmt$(diferencia, config.moneda)}
                      </span>
                    </div>
                    <div className="flex gap-3">
                      <span
                        className="badge"
                        style={{ background: 'var(--green-light)', color: 'var(--green)', border: '1px solid var(--green-border)' }}
                      >
                        Sobrante: {fmt$(sobrante ?? 0, config.moneda)}
                      </span>
                      <span
                        className="badge"
                        style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid var(--danger-border)' }}
                      >
                        Faltante: {fmt$(faltante ?? 0, config.moneda)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Top Clientes */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-dim)' }}>
              <div className="section-header">Top Clientes</div>
              {cierre.top_clientes.length === 0 ? (
                <p className="text-xs p-4" style={{ color: 'var(--text-muted)' }}>Sin clientes registrados en esta fecha.</p>
              ) : (
                <div>
                  {cierre.top_clientes.map((c, i) => (
                    <div key={c.cliente_id} className="stat-row">
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {i + 1}. {c.nombre} <span style={{ color: 'var(--text-muted)' }}>({c.compras})</span>
                      </span>
                      <span className="stat-value">{fmt$(c.total, config.moneda)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Productos más vendidos */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-dim)' }}>
              <div className="section-header">Productos Más Vendidos</div>
              {cierre.productos_mas_vendidos.length === 0 ? (
                <p className="text-xs p-4" style={{ color: 'var(--text-muted)' }}>Sin ventas de productos en esta fecha.</p>
              ) : (
                <div>
                  {cierre.productos_mas_vendidos.map((p) => (
                    <div key={p.producto_id} className="stat-row">
                      <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                        {p.nombre} <span style={{ color: 'var(--text-muted)' }}>×{p.cantidad}</span>
                      </span>
                      <span className="stat-value">{fmt$(p.facturado, config.moneda)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Incidencias */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-dim)' }}>
              <div className="section-header">Incidencias</div>
              <div className="p-1">
                <div className="stat-row">
                  <span className="stat-label">Ventas Anuladas</span>
                  <span className="stat-value" style={{ color: cierre.ventas_anuladas > 0 ? 'var(--danger)' : undefined }}>
                    {cierre.ventas_anuladas}
                  </span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Ventas con Descuento</span>
                  <span className="stat-value">{cierre.ventas_con_descuento}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Total Descontado</span>
                  <span className="stat-value">{fmt$(cierre.total_descontado, config.moneda)}</span>
                </div>
              </div>
            </div>

            {/* Productos sin movimiento */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-dim)' }}>
              <div className="section-header">Productos Sin Movimiento</div>
              {cierre.productos_sin_movimiento.length === 0 ? (
                <p className="text-xs p-4" style={{ color: 'var(--text-muted)' }}>Todos los productos activos tuvieron movimiento.</p>
              ) : (
                <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
                  {cierre.productos_sin_movimiento.map((p) => (
                    <div key={p.producto_id} className="stat-row">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.nombre}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Hora pico + indicadores + fecha */}
          <div
            className="grid grid-cols-4 gap-3 p-4"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-dim)' }}
          >
            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Primera Venta</p>
              <p className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>{fmtHora(cierre.primera_venta)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Última Venta</p>
              <p className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>{fmtHora(cierre.ultima_venta)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Hora Pico</p>
              <p className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>{cierre.hora_pico ?? '—'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Fecha del Cierre</p>
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