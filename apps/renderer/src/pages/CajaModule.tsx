import { useState, useEffect, useCallback } from 'react';
import { useQuery }                          from '@/hooks';
import { CajaInicio }                        from './CajaInicio';
import { AperturaCaja }                      from './AperturaCaja';
import { IdentificacionCliente }             from './IdentificacionCliente';
import { VentasSuspendidas }                 from './VentasSuspendidas';
import { POS }                               from './POS';
import type { AppConfig, Cliente, VentaSuspendida } from '@pos/shared';

// =============================================================================
// CajaModule — Contenedor del flujo de Caja
//
// Sustituye el render directo de <POS /> en App.tsx. Orquesta la
// sub-navegación interna del módulo:
//
//   apertura → inicio → identificar (Nueva Venta) → pos
//                     → suspendidas (Continuar Venta) → pos
//
// Reglas obligatorias:
//   - No se puede entrar al POS sin una apertura de caja vigente para hoy.
//   - No se puede entrar al POS sin un cliente confirmado (Nueva Venta) o
//     una venta suspendida recuperada (Continuar Venta).
//   - "Continuar Venta" nunca abre un POS vacío: si no hay ventas
//     suspendidas, VentasSuspendidas.tsx bloquea el avance y muestra el aviso.
//
// NOTA: la integración real con <POS /> (paso de cliente obligatorio,
// snapshot inicial de venta suspendida, botón "Suspender Venta") se hace
// en un cambio posterior que sí modifica POS.tsx. Por ahora, al llegar al
// sub-estado 'pos' se muestra un estado de transición simple para no tocar
// ese archivo todavía.
// =============================================================================

type SubVista = 'inicio' | 'identificar' | 'suspendidas' | 'pos';

interface Props { config: AppConfig }

const hoy = () => new Date().toISOString().split('T')[0];

export function CajaModule({ config }: Props) {
  const fecha = hoy();

  const { data: apertura, isLoading: cargandoApertura, refetch: refetchApertura } =
    useQuery('cajaSesion:getAperturaDelDia', fecha);

  const [vista, setVista] = useState<SubVista>('inicio');
  const [clienteActivo, setClienteActivo] = useState<Cliente | null>(null);
  const [ventaRecuperada, setVentaRecuperada] = useState<VentaSuspendida | null>(null);

  // Si cambia la jornada (poco probable en una misma sesión, pero por
  // seguridad) se reinicia la sub-navegación.
  useEffect(() => {
    setVista('inicio');
    setClienteActivo(null);
    setVentaRecuperada(null);
  }, [fecha]);

  const irAInicio = useCallback(() => {
    setClienteActivo(null);
    setVentaRecuperada(null);
    setVista('inicio');
    refetchApertura();
  }, [refetchApertura]);

  const handleNuevaVenta = useCallback(() => setVista('identificar'), []);
  const handleContinuarVenta = useCallback(() => setVista('suspendidas'), []);

  const handleClienteConfirmado = useCallback((cliente: Cliente) => {
    setClienteActivo(cliente);
    setVentaRecuperada(null);
    setVista('pos');
  }, []);

  const handleVentaRecuperada = useCallback((venta: VentaSuspendida) => {
    setVentaRecuperada(venta);
    setClienteActivo(null);
    setVista('pos');
  }, []);

  // ── 1. Cargando estado de apertura ──
  if (cargandoApertura) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: 'var(--bg-base)' }}>
        <p className="text-xs font-mono uppercase tracking-widest animate-pulse" style={{ color: 'var(--text-muted)' }}>
          Verificando apertura de caja...
        </p>
      </div>
    );
  }

  // ── 2. Sin apertura vigente para hoy: bloquea todo lo demás ──
  if (!apertura) {
    return (
      <AperturaCaja
        config={config}
        fecha={fecha}
        onAbierta={() => refetchApertura()}
      />
    );
  }

  // ── 3. Sub-navegación del módulo de Caja ──
  if (vista === 'identificar') {
    return (
      <IdentificacionCliente
        onConfirmar={handleClienteConfirmado}
        onCancelar={irAInicio}
      />
    );
  }

  if (vista === 'suspendidas') {
    return (
      <VentasSuspendidas
        config={config}
        onContinuar={handleVentaRecuperada}
        onVolver={irAInicio}
      />
    );
  }

  if (vista === 'pos') {
    return (
      <POS
        config={config}
        clienteInicial={clienteActivo}
        ventaSuspendidaInicial={ventaRecuperada}
        onVolverCaja={irAInicio}
      />
    );
  }

  // ── 4. Inicio del módulo ──
  return (
    <CajaInicio
      config={config}
      onNuevaVenta={handleNuevaVenta}
      onContinuarVenta={handleContinuarVenta}
    />
  );
}