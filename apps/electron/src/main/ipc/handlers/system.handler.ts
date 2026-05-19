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
    const ventas = db.prepare<[string], {
      metodo_pago: string;
      total:       number;
      created_at:  string;
    }>(`
      SELECT metodo_pago, total, created_at
        FROM ventas
       WHERE estado = 'completada'
         AND date(created_at) = date(?)
    `).all(fecha + 'T00:00:00Z');

    const items = db.prepare<[string], { total_items: number }>(`
      SELECT COALESCE(SUM(iv.cantidad), 0) AS total_items
        FROM items_venta iv
        JOIN ventas v ON iv.venta_id = v.id
       WHERE v.estado = 'completada'
         AND date(v.created_at) = date(?)
    `).get(fecha + 'T00:00:00Z');

    const por_metodo = { efectivo: 0, tarjeta: 0, transferencia: 0, mixto: 0 };
    let total_ventas = 0;
    const porHora: Record<string, number> = {};

    for (const v of ventas) {
      total_ventas += v.total;
      const metodo = v.metodo_pago as keyof typeof por_metodo;
      if (metodo in por_metodo) por_metodo[metodo] += v.total;
      const hora = new Date(v.created_at).getHours().toString().padStart(2, '0') + ':00';
      porHora[hora] = (porHora[hora] ?? 0) + 1;
    }

    const hora_pico = Object.entries(porHora)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const cierre: CierreCaja = {
      fecha,
      total_ventas,
      cantidad_ventas: ventas.length,
      total_items:     items?.total_items ?? 0,
      por_metodo,
      venta_promedio:  ventas.length ? Math.round(total_ventas / ventas.length) : 0,
      hora_pico,
    };

    return cierre;
  });
}