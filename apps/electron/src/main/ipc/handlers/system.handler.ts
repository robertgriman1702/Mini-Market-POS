import { handle }             from '../helpers';
import { HwidService }        from '../../services/HwidService';
import { LicenseService }     from '../../services/LicenseService';
import { ConfigService }      from '../../services/ConfigService';
import { PrinterService }     from '../../services/PrinterService';
import { AutoUpdaterService } from '../../services/AutoUpdaterService';
import { BcvService }          from '../../services/BcvService';
import type { IVentaRepository } from '../../repositories/interfaces/IVentaRepository';
import type Database          from 'better-sqlite3';
import type { CierreCaja }    from '@pos/shared';

// =============================================================================
// System Handler — HWID, Licencia, Config, Impresora, Reportes, Updater
//
// 'reportes:cierreCaja' se mantiene 100% compatible con el contrato
// CierreCaja existente, pero el objeto devuelto en runtime incluye además
// los bloques de análisis avanzado que apps/renderer/src/pages/CashClose.tsx
// consume (top_clientes, productos_mas_vendidos, control_efectivo, etc).
// Antes de este cambio, CashClose.tsx accedía a estas propiedades sobre un
// objeto que nunca las contenía (causa raíz del crash en Cierre de Caja),
// porque el cast `as CierreCajaAvanzado` en el Renderer no las creaba en
// runtime — solo silenciaba el chequeo de tipos en compilación.
// =============================================================================

export function registerSystemHandlers(
  db:        Database.Database,
  ventaRepo: IVentaRepository,
  config:    ConfigService,
  license:   LicenseService
): void {

  // --- HWID y Licencia ---
  handle('system:getHwid',         ()        => HwidService.get());
  handle('system:checkLicense',    ()        => license.check());
  handle('system:activateLicense', (_e, key) => license.activate(key));
  handle('system:refreshLicense',  ()        => license.check());

  // --- Configuración ---
  handle('config:get',  ()            => config.get());
  handle('config:save', (_e, partial) => config.save(partial));

  // --- Impresora ---
  handle('printer:test', async () => {
    const printer = new PrinterService(config.get());
    return printer.printTest();
  });

  handle('printer:ticket', async (_e, ventaId: number) => {
    const venta = ventaRepo.findByIdWithItems(ventaId);
    if (!venta) throw new Error(`Venta ${ventaId} no encontrada.`);
    const printer = new PrinterService(config.get());
    return printer.printTicket(venta);
  });

  // --- Auto-updater ---
  handle('system:downloadUpdate', () => {
    AutoUpdaterService.download();
    return true;
  });

  handle('system:installUpdate', () => {
    AutoUpdaterService.installAndRestart();
  });

  // --- BCV ---
  handle('bcv:getTasa', () => BcvService.getTasa());

  // --- Cierre de Caja ---
  handle('reportes:cierreCaja', (_e, fecha: string) => {
    const fechaConHora = fecha + 'T00:00:00Z';

    // -------------------------------------------------------------------
    // Resumen general + análisis de pagos (lógica original, sin cambios)
    // -------------------------------------------------------------------
    const ventasDelDia = db.prepare<[string], {
      id:          number;
      metodo_pago: string;
      total:       number;
      descuento:   number;
      cliente_id:  number | null;
      created_at:  string;
    }>(`
      SELECT id, metodo_pago, total, descuento, cliente_id, created_at
        FROM ventas
       WHERE estado = 'completada'
         AND date(created_at) = date(?)
    `).all(fechaConHora);

    const items = db.prepare<[string], { total_items: number }>(`
      SELECT COALESCE(SUM(iv.cantidad), 0) AS total_items
        FROM items_venta iv
        JOIN ventas v ON iv.venta_id = v.id
       WHERE v.estado = 'completada'
         AND date(v.created_at) = date(?)
    `).get(fechaConHora);

    const por_metodo = { efectivo: 0, tarjeta: 0, transferencia: 0, mixto: 0 };
    let total_ventas = 0;
    const porHora: Record<string, number> = {};

    for (const v of ventasDelDia) {
      total_ventas += v.total;
      const metodo = v.metodo_pago as keyof typeof por_metodo;
      if (metodo in por_metodo) por_metodo[metodo] += v.total;
      const hora = new Date(v.created_at).getHours().toString().padStart(2, '0') + ':00';
      porHora[hora] = (porHora[hora] ?? 0) + 1;
    }

    const hora_pico = Object.entries(porHora)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // -------------------------------------------------------------------
    // Clientes atendidos + Top Clientes
    // -------------------------------------------------------------------
    const clientesAtendidos = new Set(
      ventasDelDia.filter((v) => v.cliente_id !== null).map((v) => v.cliente_id)
    ).size;

    const topClientesRaw = db.prepare<[string], {
      cliente_id: number;
      nombre:     string;
      apellido:   string;
      total:      number;
      compras:    number;
    }>(`
      SELECT c.id AS cliente_id, c.nombre, c.apellido,
             SUM(v.total) AS total, COUNT(v.id) AS compras
        FROM ventas v
        JOIN clientes c ON c.id = v.cliente_id
       WHERE v.estado = 'completada'
         AND date(v.created_at) = date(?)
       GROUP BY c.id
       ORDER BY total DESC
       LIMIT 10
    `).all(fechaConHora);

    const top_clientes = topClientesRaw.map((c) => ({
      cliente_id: c.cliente_id,
      nombre:     `${c.nombre} ${c.apellido}`,
      total:      c.total,
      compras:    c.compras,
    }));

    // -------------------------------------------------------------------
    // Productos: más vendidos, mayor facturación, sin movimiento
    // -------------------------------------------------------------------
    const productos_mas_vendidos = db.prepare<[string], {
      producto_id: number;
      nombre:      string;
      cantidad:    number;
      facturado:   number;
    }>(`
      SELECT p.id AS producto_id, p.nombre,
             SUM(iv.cantidad) AS cantidad,
             SUM(iv.cantidad * iv.precio_unitario) AS facturado
        FROM items_venta iv
        JOIN ventas v    ON v.id = iv.venta_id
        JOIN productos p ON p.id = iv.producto_id
       WHERE v.estado = 'completada'
         AND date(v.created_at) = date(?)
       GROUP BY p.id
       ORDER BY cantidad DESC
       LIMIT 10
    `).all(fechaConHora);

    const productos_mayor_facturacion = [...productos_mas_vendidos]
      .sort((a, b) => b.facturado - a.facturado)
      .slice(0, 10);

    const productos_sin_movimiento = db.prepare<[string], {
      producto_id: number;
      nombre:      string;
    }>(`
      SELECT p.id AS producto_id, p.nombre
        FROM productos p
       WHERE p.activo = 1
         AND p.id NOT IN (
           SELECT iv.producto_id
             FROM items_venta iv
             JOIN ventas v ON v.id = iv.venta_id
            WHERE v.estado = 'completada'
              AND date(v.created_at) = date(?)
         )
       ORDER BY p.nombre
       LIMIT 50
    `).all(fechaConHora);

    // -------------------------------------------------------------------
    // Control de Efectivo (lee aperturas_caja; si no hay apertura para
    // la fecha, fondo_inicial se trata como 0 en vez de fallar)
    // -------------------------------------------------------------------
    const apertura = db.prepare<[string], { fondo_inicial: number } | undefined>(`
      SELECT fondo_inicial FROM aperturas_caja
       WHERE fecha = ? ORDER BY created_at DESC LIMIT 1
    `).get(fecha);

    const fondoInicial     = apertura?.fondo_inicial ?? 0;
    const efectivoEsperado = fondoInicial + por_metodo.efectivo;

    // -------------------------------------------------------------------
    // Incidencias: ventas anuladas y descuentos
    // -------------------------------------------------------------------
    const ventasAnuladas = db.prepare<[string], { cantidad: number }>(`
      SELECT COUNT(*) AS cantidad
        FROM ventas
       WHERE estado = 'cancelada'
         AND date(created_at) = date(?)
    `).get(fechaConHora);

    const totalDescontado    = ventasDelDia.reduce((s, v) => s + (v.descuento ?? 0), 0);
    const ventasConDescuento = ventasDelDia.filter((v) => (v.descuento ?? 0) > 0).length;

    // -------------------------------------------------------------------
    // Indicadores: primera y última venta
    // -------------------------------------------------------------------
    const ordenadas = [...ventasDelDia].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const primeraVenta = ordenadas[0]?.created_at ?? null;
    const ultimaVenta  = ordenadas.at(-1)?.created_at ?? null;

    // -------------------------------------------------------------------
    // Contrato base CierreCaja (sin cambios respecto al tipo declarado
    // en packages/shared) + bloques de análisis avanzado que
    // CashClose.tsx espera bajo el cast CierreCajaAvanzado.
    // -------------------------------------------------------------------
    const cierreBase: CierreCaja = {
      fecha,
      total_ventas,
      cantidad_ventas: ventasDelDia.length,
      total_items:     items?.total_items ?? 0,
      por_metodo,
      venta_promedio:  ventasDelDia.length ? Math.round(total_ventas / ventasDelDia.length) : 0,
      hora_pico,
    };

    return {
      ...cierreBase,
      clientes_atendidos:          clientesAtendidos,
      cliente_top:                 top_clientes[0] ? { nombre: top_clientes[0].nombre, total: top_clientes[0].total } : null,
      top_clientes,
      productos_mas_vendidos,
      productos_mayor_facturacion,
      productos_sin_movimiento,
      control_efectivo: {
        fondo_inicial:      fondoInicial,
        efectivo_esperado:  efectivoEsperado,
        efectivo_contado:   null,
        diferencia:         null,
        sobrante:           null,
        faltante:           null,
      },
      ventas_anuladas:      ventasAnuladas?.cantidad ?? 0,
      ventas_con_descuento: ventasConDescuento,
      total_descontado:     totalDescontado,
      primera_venta:        primeraVenta,
      ultima_venta:         ultimaVenta,
    };
  });
}