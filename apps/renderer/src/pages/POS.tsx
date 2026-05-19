import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useBcv }                              from '@/hooks';
import { ipcInvoke }                                from '@/lib/ipc';
import type { Producto, NuevaVentaPayload,
              MetodoPago, AppConfig }               from '@pos/shared';
import { BalanzaIndicator } from './Balanzaindicator';

// =============================================================================
// POS — Punto de venta
//
// Flujo de cobro:
//   1. Cajero escanea productos → se agregan al carrito
//   2. Presiona "Cobrar"
//   3. Aparece CheckoutModal con el total
//   4. Elige método: Efectivo / Tarjeta / Transferencia / Cashea
//   5. Efectivo → escribe lo recibido → app calcula vuelto automático
//   6. Tarjeta/Transferencia → instrucción para usar el datafono → confirmar
//   7. Confirmar → registra venta → limpia carrito → vuelve al scan
// =============================================================================

interface CartItem {
  producto: Producto;
  cantidad: number;
}

interface Props { config: AppConfig }

const fmt$ = (centavos: number, moneda: string) =>
  `${moneda}${(centavos / 100).toFixed(2)}`;

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function POS({ config }: Props) {
  const [cart,         setCart]         = useState<CartItem[]>([]);
  const [scan,         setScan]         = useState('');
  const [descuento,    setDescuento]    = useState(0);
  const [lastScan,     setLastScan]     = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toBS, tasa } = useBcv();


  const { mutate: crearVenta, isLoading: procesando } =
    useMutation('ventas:crear', {
      onSuccess: () => {
        setCart([]);
        setScan('');
        setDescuento(0);
        setShowCheckout(false);
        setLastScan(null);
        setTimeout(() => inputRef.current?.focus(), 100);
      },
      onError: (err) => {
        setLastScan(`Error: ${err}`);
        setShowCheckout(false);
      },
    });

  useEffect(() => { inputRef.current?.focus(); }, []);

  // ── Totals ──

  const subtotal  = cart.reduce((s, i) => s + i.producto.precio * i.cantidad, 0);
  const ivaBase   = config.flags.iva
    ? Math.round(subtotal * config.iva_porcentaje / (100 + config.iva_porcentaje))
    : 0;
  const total     = Math.max(0, subtotal - descuento);
  const itemCount = cart.reduce((s, i) => s + i.cantidad, 0);
  {tasa && (
    <div className="stat-row">
      <span className="stat-label">Equivalente Bs</span>
      <span className="stat-value text-sm" style={{ color: 'var(--warn)' }}>
      {toBS(total)}
      </span>
  </div>
  )}
  {tasa && (
    <div className="px-4 pb-2 text-xs" style={{ color: 'var(--text-muted)' }}>
      1 USD = Bs {tasa.toFixed(2)} · BCV
  </div>
  )}

  // ── Scan ──

  const handleScan = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLastScan('Buscando...');
    try {
      const res = await ipcInvoke('productos:getByQR', trimmed);
      if (res) {
        setCart((prev) => {
          const ex = prev.find((i) => i.producto.id === res.id);
          return ex
            ? prev.map((i) => i.producto.id === res.id ? { ...i, cantidad: i.cantidad + 1 } : i)
            : [...prev, { producto: res, cantidad: 1 }];
        });
        setLastScan(null);
      } else {
        setLastScan(`✕ Código no encontrado: ${trimmed}`);
      }
    } catch {
      setLastScan('✕ Error al buscar producto');
    } finally {
      setScan('');
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && scan.trim()) { e.preventDefault(); handleScan(scan); return; }
    if (e.key === 'Enter' && !scan.trim() && cart.length > 0) { e.preventDefault(); setShowCheckout(true); return; }
    if (e.key === 'F4') { e.preventDefault(); clearCart(); }
  };

  // ── Cart ──

  const updateQty = (id: number, delta: number) =>
    setCart((prev) =>
      prev.map((i) => i.producto.id === id ? { ...i, cantidad: i.cantidad + delta } : i)
          .filter((i) => i.cantidad > 0)
    );

  const clearCart = () => { if (cart.length > 0) setConfirmClear(true); };
  const doClear   = () => { setCart([]); setDescuento(0); setConfirmClear(false); setLastScan(null); inputRef.current?.focus(); };

  // ── Confirmar venta ──

  const confirmar = (metodo: MetodoPago) => {
    if (!cart.length || procesando) return;
    crearVenta({
      metodo_pago: metodo,
      descuento,
      items: cart.map((i) => ({
        producto_id:     i.producto.id,
        cantidad:        i.cantidad,
        precio_unitario: i.producto.precio,
      })),
    } as NuevaVentaPayload);
  };

  // ── Render ──

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>

      {/* Top bar */}
      <div className="flex items-center flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-dim)', height: '52px' }}>
        <div className="flex items-center justify-center w-12 h-full flex-shrink-0"
          style={{ borderRight: '1px solid var(--border-dim)' }}>
          <span style={{ color: 'var(--green)', fontSize: '0.9rem' }}>⚡</span>
        </div>
        <input
          ref={inputRef}
          className="scan-input animate-scan flex-1 h-full"
          style={{ borderRight: '1px solid var(--border-dim)' }}
          placeholder="READY TO SCAN... (TYPE CODE OR PRODUCT NAME)"
          value={scan}
          onChange={(e) => setScan(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={procesando || showCheckout}
          autoFocus
        />
        <BalanzaIndicator peso={null} conectada={false} />
        <div className="flex h-full items-center px-4 text-xs font-mono"
          style={{ borderLeft: '1px solid var(--border-dim)', color: 'var(--text-muted)' }}>
          <span><b>F4:</b> CLEAR &nbsp;·&nbsp; <b>↵:</b> COBRAR</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Cart */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="grid text-xs font-semibold uppercase tracking-widest px-3 py-2 flex-shrink-0"
            style={{ gridTemplateColumns: '120px 1fr 110px 110px 110px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-dim)' }}>
            <span>Código</span><span>Producto</span>
            <span className="text-right">Cant.</span>
            <span className="text-right">Precio</span>
            <span className="text-right">Subtotal</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div style={{ color: 'var(--text-muted)', fontSize: '2.5rem', opacity: 0.2 }}>⊞</div>
                <p className="text-sm font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)', opacity: 0.4 }}>
                  No items scanned
                </p>
                {lastScan && (
                  <p className="text-xs font-mono px-4 py-2 rounded"
                    style={{ color: 'var(--danger)', background: 'rgba(244,67,54,0.08)', border: '1px solid rgba(244,67,54,0.2)' }}>
                    {lastScan}
                  </p>
                )}
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.producto.id} className="table-row animate-fade-in"
                  style={{ gridTemplateColumns: '120px 1fr 110px 110px 110px', display: 'grid' }}>
                  <span className="font-mono text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {item.producto.codigo_qr.slice(0, 12)}
                  </span>
                  <span className="text-sm truncate pr-4">{item.producto.nombre}</span>
                  <div className="flex items-center justify-end gap-2">
                    <button className="w-5 h-5 flex items-center justify-center text-xs rounded"
                      style={{ background: 'var(--bg-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-base)' }}
                      onClick={() => updateQty(item.producto.id, -1)}>−</button>
                    <span className="font-mono text-sm w-8 text-center">{item.cantidad}</span>
                    <button className="w-5 h-5 flex items-center justify-center text-xs rounded"
                      style={{ background: 'var(--bg-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-base)' }}
                      onClick={() => updateQty(item.producto.id, 1)}>+</button>
                  </div>
                  <span className="text-right font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {fmt$(item.producto.precio, config.moneda)}
                  </span>
                  <span className="text-right font-mono text-sm font-semibold">
                    {fmt$(item.producto.precio * item.cantidad, config.moneda)}
                  </span>
                </div>
              ))
            )}
          </div>

          {lastScan && cart.length > 0 && (
            <div className="px-4 py-2 text-xs font-mono flex-shrink-0"
              style={{ background: 'rgba(244,67,54,0.08)', color: 'var(--danger)', borderTop: '1px solid rgba(244,67,54,0.2)' }}>
              {lastScan}
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="side-panel w-64 flex-shrink-0 flex flex-col">
          <div className="px-4 py-5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-dim)' }}>
            <p className="stat-label mb-2">Total a Pagar</p>
            <div className="total-amount">{fmt$(total, config.moneda)}</div>
            {config.flags.mostrar_bs && tasa && total > 0 && (
              <p className="font-mono text-xs mt-1" style={{ color: 'var(--warn)' }}>
                ≈ {toBS(total)}
              </p>
            )}
            {config.flags.mostrar_bs && tasa && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                1 USD = Bs {tasa.toFixed(2)} · BCV
              </p>
            )}
            {config.flags.mostrar_bs && !tasa && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                Sin tasa BCV — verifica conexión
              </p>
            )}
          </div>
          <div className="flex-1">
            <div className="stat-row">
              <span className="stat-label">Subtotal</span>
              <span className="stat-value text-sm">{fmt$(subtotal, config.moneda)}</span>
            </div>
            {config.flags.iva && (
              <div className="stat-row">
                <span className="stat-label">IVA ({config.iva_porcentaje}%)</span>
                <span className="stat-value text-sm">{fmt$(ivaBase, config.moneda)}</span>
              </div>
            )}
            <div className="stat-row">
              <span className="stat-label">Descuento</span>
              <span className="stat-value text-sm" style={{ color: descuento > 0 ? 'var(--warn)' : undefined }}>
                -{fmt$(descuento, config.moneda)}
              </span>
            </div>
            <div className="stat-row" style={{ borderTop: '1px solid var(--border-dim)' }}>
              <span className="stat-label">Items en carrito</span>
              <span className="stat-value text-sm">{itemCount}</span>
            </div>
          </div>
          <div className="flex-shrink-0 p-3 flex flex-col gap-2" style={{ borderTop: '1px solid var(--border-dim)' }}>
            <button className="btn-primary" disabled={!cart.length || procesando}
              onClick={() => setShowCheckout(true)}>
              {procesando ? 'Procesando...' : `Cobrar · ${fmt$(total, config.moneda)}`}
            </button>
            <button className="btn-ghost" onClick={clearCart} disabled={!cart.length}>
              Limpiar Carrito
            </button>
          </div>
          <div className="px-4 py-2 flex items-center justify-end"
            style={{ borderTop: '1px solid var(--border-dim)' }}>
            <button className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center"
              style={{ background: 'var(--bg-overlay)', color: 'var(--text-muted)' }}
              title="F4: Limpiar | ↵ vacío: Cobrar">?</button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCheckout && (
      <CheckoutModal
        total={total} subtotal={subtotal} ivaBase={ivaBase}
        descuento={descuento} itemCount={itemCount} moneda={config.moneda}
        ivaPorc={config.iva_porcentaje} showIva={config.flags.iva}
        showCashea={false} procesando={procesando}
        toBS={config.flags.mostrar_bs ? toBS : undefined} 
        onConfirm={confirmar}
        onClose={() => { setShowCheckout(false); inputRef.current?.focus(); }}
      />
      )}

      {confirmClear && (
        <ConfirmModal
          message={`¿Eliminar ${cart.length} producto${cart.length !== 1 ? 's' : ''} del carrito?`}
          detail="Esta acción no se puede deshacer."
          onConfirm={doClear}
          onCancel={() => { setConfirmClear(false); inputRef.current?.focus(); }}
        />
      )}
    </div>
  );
}

// =============================================================================
// CheckoutModal
// =============================================================================

{/* En CheckoutProps agregar: */}
interface CheckoutProps {
  total: number; subtotal: number; ivaBase: number; descuento: number;
  itemCount: number; moneda: string; ivaPorc: number; showIva: boolean;
  showCashea: boolean; procesando: boolean;
  toBS?: (c: number) => string;   // ← agregar
  onConfirm: (metodo: MetodoPago) => void;
  onClose: () => void;
}

const METODOS_CONFIG: Array<{ key: MetodoPago; label: string; icon: string; desc: string }> = [
  { key: 'efectivo',      label: 'Efectivo',      icon: '💵', desc: 'Pago en efectivo' },
  { key: 'tarjeta',       label: 'Tarjeta',        icon: '💳', desc: 'Débito / Crédito' },
  { key: 'transferencia', label: 'Transferencia',  icon: '🏦', desc: 'Pago móvil / Zelle' },
  { key: 'mixto',         label: 'Cashea',         icon: '📱', desc: 'Pago con Cashea' },
];

function CheckoutModal({ total, subtotal, ivaBase, descuento, itemCount,
  moneda, ivaPorc, showIva, showCashea, procesando, toBS, onConfirm, onClose }: CheckoutProps) {

  const [metodo,   setMetodo]   = useState<MetodoPago>('efectivo');
  const [recibido, setRecibido] = useState('');
  const recibidoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (metodo === 'efectivo') setTimeout(() => recibidoRef.current?.focus(), 50);
  }, [metodo]);

  const recibidoCentavos = Math.round(parseFloat(recibido || '0') * 100);
  const vuelto           = recibidoCentavos - total;
  const puedeConfirmar   = metodo !== 'efectivo' || recibidoCentavos >= total;

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    if (e.key === 'Enter' && puedeConfirmar && !procesando) { e.stopPropagation(); onConfirm(metodo); }
  };

  const visibles = METODOS_CONFIG.filter((m) => m.key !== 'mixto' || showCashea);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.82)' }}
      onKeyDown={handleKey}
    >
      <div
        className="flex flex-col"
        style={{
          width: '480px', maxHeight: '92vh', overflow: 'auto',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-loud)',
          borderRadius: '8px',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border-dim)' }}>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest"
              style={{ color: 'var(--text-primary)' }}>Confirmar Cobro</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {itemCount} producto{itemCount !== 1 ? 's' : ''} en el carrito
            </p>
          </div>
          <button onClick={onClose} disabled={procesando}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '22px', lineHeight: 1 }}>×</button>
        </div>

        {/* Total */}
        <div className="px-6 py-5" style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-dim)' }}>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
            Total a cobrar
          </p>
          <div style={{ fontSize: '2.8rem', fontWeight: 700, fontFamily: 'monospace',
            color: 'var(--green)', lineHeight: 1, letterSpacing: '-0.02em' }}>
            {fmt$(total, moneda)}
          </div>
          {toBS && (
            <p className="font-mono text-sm mt-1" style={{ color: 'var(--warn)' }}>
              ≈ {toBS(total)}
            </p>
          )}

          <div className="flex gap-4 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>Subtotal: {fmt$(subtotal, moneda)}</span>
            {showIva && <span>IVA {ivaPorc}%: {fmt$(ivaBase, moneda)}</span>}
            {descuento > 0 && <span style={{ color: 'var(--warn)' }}>Desc: -{fmt$(descuento, moneda)}</span>}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-5">

          {/* Método */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: 'var(--text-muted)' }}>Método de pago</p>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${visibles.length}, 1fr)` }}>
              {visibles.map((m) => {
                const active = metodo === m.key;
                return (
                  <button key={m.key} onClick={() => setMetodo(m.key)}
                    style={{
                      padding: '12px 8px', borderRadius: '6px',
                      border: `2px solid ${active ? 'var(--blue)' : 'var(--border-base)'}`,
                      background: active ? 'rgba(41,121,255,0.08)' : 'var(--bg-elevated)',
                      cursor: 'pointer', textAlign: 'center', transition: 'all 0.12s',
                    }}>
                    <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>{m.icon}</div>
                    <div style={{ fontSize: '12px', fontWeight: active ? 700 : 400,
                      color: active ? 'var(--blue)' : 'var(--text-primary)' }}>{m.label}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{m.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Efectivo */}
          {metodo === 'efectivo' && (
            <div className="animate-fade-in p-4 rounded-lg"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-base)' }}>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  Monto recibido
                </label>
                <div className="flex gap-1">
                  {quickAmounts(total).map((amt) => (
                    <button key={amt} onClick={() => setRecibido((amt / 100).toFixed(2))}
                      style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-base)',
                        color: 'var(--text-secondary)', cursor: 'pointer', padding: '3px 7px',
                        borderRadius: '4px', fontSize: '11px' }}>
                      {fmt$(amt, moneda)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-lg font-mono" style={{ color: 'var(--text-muted)' }}>{moneda}</span>
                <input
                  ref={recibidoRef}
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={recibido}
                  onChange={(e) => setRecibido(e.target.value)}
                  data-selectable
                  style={{
                    flex: 1, background: 'var(--bg-base)',
                    border: `2px solid ${recibidoCentavos >= total && recibido ? 'var(--green)' : 'var(--border-loud)'}`,
                    borderRadius: '5px', color: 'var(--text-primary)',
                    padding: '10px 14px', fontSize: '1.5rem',
                    fontFamily: 'monospace', fontWeight: 700, outline: 'none',
                    transition: 'border-color 0.15s',
                  }}
                />
              </div>

              {/* Vuelto */}
              <div className="mt-3 flex items-center justify-between p-3 rounded"
                style={{
                  background: vuelto > 0 ? 'rgba(0,230,118,0.08)' : vuelto === 0 ? 'rgba(41,121,255,0.08)' : 'rgba(244,67,54,0.08)',
                  border: `1px solid ${vuelto > 0 ? 'rgba(0,230,118,0.25)' : vuelto === 0 ? 'rgba(41,121,255,0.25)' : 'rgba(244,67,54,0.25)'}`,
                }}>
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  {vuelto < 0 ? 'Falta' : 'Vuelto'}
                </span>
                <span className="font-mono font-bold" style={{
                  fontSize: '1.4rem',
                  color: vuelto > 0 ? 'var(--green)' : vuelto === 0 ? 'var(--blue)' : 'var(--danger)',
                }}>
                  {vuelto < 0 ? `-${fmt$(Math.abs(vuelto), moneda)}` : fmt$(vuelto, moneda)}
                </span>
              </div>
            </div>
          )}

          {/* Tarjeta / Transferencia */}
          {(metodo === 'tarjeta' || metodo === 'transferencia') && (
            <div className="animate-fade-in p-5 rounded-lg text-center"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-base)' }}>
              <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                {metodo === 'tarjeta' ? '💳 Procesa el pago en el datafono' : '🏦 Verifica la transferencia recibida'}
              </p>
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                {metodo === 'tarjeta'
                  ? 'Cuando el datafono apruebe, presiona Confirmar.'
                  : 'Cuando recibas la confirmación del cliente, presiona Confirmar.'}
              </p>
              <div style={{ fontSize: '2rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--blue)' }}>
                {fmt$(total, moneda)}
              </div>
            </div>
          )}

          {/* Cashea */}
          {metodo === 'mixto' && (
            <div className="animate-fade-in p-5 rounded-lg text-center"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-base)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>📱 Cashea</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Integración QR en desarrollo. Por ahora confirma cuando el cliente muestre el comprobante.
              </p>
              <div style={{ fontSize: '2rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--blue)', marginTop: '12px' }}>
                {fmt$(total, moneda)}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--border-dim)' }}>
          <button className="btn-ghost flex-1" onClick={onClose} disabled={procesando}>
            Cancelar (Esc)
          </button>
          <button
            className="btn-primary flex-1"
            onClick={() => onConfirm(metodo)}
            disabled={procesando || !puedeConfirmar}
            style={{ opacity: (!puedeConfirmar && !procesando) ? 0.4 : 1, fontWeight: 700 }}
          >
            {procesando ? 'Registrando...' : '✓ Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

/** Genera montos rápidos de efectivo: exacto + los billetes redondos más cercanos */
function quickAmounts(totalCentavos: number): number[] {
  // Billetes en centavos
  const billetes = [500, 1000, 2000, 5000, 10000, 20000, 50000, 100000].map((b) => b * 100);
  const superiores = billetes.filter((b) => b >= totalCentavos).slice(0, 3);
  return [...new Set([totalCentavos, ...superiores])].slice(0, 4);
}

// =============================================================================
// ConfirmModal
// =============================================================================

interface ConfirmProps {
  message: string; detail: string;
  onConfirm: () => void; onCancel: () => void;
}

function ConfirmModal({ message, detail, onConfirm, onCancel }: ConfirmProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="flex flex-col gap-5 p-6 w-72"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-loud)', borderRadius: '6px' }}>
        <div>
          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{message}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{detail}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost flex-1 text-xs" onClick={onCancel}>Cancelar</button>
          <button className="flex-1 text-xs font-semibold py-2 px-3 rounded"
            style={{ background: 'var(--danger)', color: '#fff', border: 'none', cursor: 'pointer' }}
            onClick={onConfirm}>
            Sí, confirmar
          </button>
        </div>
      </div>
    </div>
  );
}