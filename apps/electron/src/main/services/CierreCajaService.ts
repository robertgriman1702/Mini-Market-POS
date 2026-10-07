import type Database from 'better-sqlite3';
import type { CierreCaja, ResumenMetodoPago } from '@pos/shared';

// =============================================================================
// CierreCajaService — lógica de negocio del Cierre de Caja
//
// Responsabilidad: calcular el resumen del día a partir de las ventas
// completadas. Extraído tal cual de system.handler.ts (mismo SQL, mismo
// contrato CierreCaja) para sacar la lógica de negocio del handler IPC
// sin alterar su comportamiento.
// =============================================================================

interface VentaDelDiaRow {
  metodo_pago: string;
  total:       number;
  created_at:  string;
}

interface TotalItemsRow {
  total_items: number;
}

export class CierreCajaService {
  constructor(private readonly db: Database.Database) {}

  // ---------------------------------------------------------------------------
  // Consultas (sin efecto secundario)
  // ---------------------------------------------------------------------------

  generar(fecha: string): CierreCaja {
    const fechaConHora = `${fecha}T00:00:00Z`;

    const ventas = this.db
      .prepare<[string], VentaDelDiaRow>(`
        SELECT metodo_pago, total, created_at
          FROM ventas
         WHERE estado = 'completada'
           AND date(created_at) = date(?)
      `)
      .all(fechaConHora);

    const items = this.db
      .prepare<[string], TotalItemsRow>(`
        SELECT COALESCE(SUM(iv.cantidad), 0) AS total_items
          FROM items_venta iv
          JOIN ventas v ON iv.venta_id = v.id
         WHERE v.estado = 'completada'
           AND date(v.created_at) = date(?)
      `)
      .get(fechaConHora);

    const por_metodo: ResumenMetodoPago = {
      efectivo:      0,
      tarjeta:       0,
      transferencia: 0,
      mixto:         0,
    };
    let total_ventas = 0;
    const porHora: Record<string, number> = {};

    for (const v of ventas) {
      total_ventas += v.total;
      const metodo = v.metodo_pago as keyof ResumenMetodoPago;
      if (metodo in por_metodo) por_metodo[metodo] += v.total;
      const hora = new Date(v.created_at).getHours().toString().padStart(2, '0') + ':00';
      porHora[hora] = (porHora[hora] ?? 0) + 1;
    }

    const hora_pico = Object.entries(porHora)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return {
      fecha,
      total_ventas,
      cantidad_ventas: ventas.length,
      total_items:     items?.total_items ?? 0,
      por_metodo,
      venta_promedio:  ventas.length ? Math.round(total_ventas / ventas.length) : 0,
      hora_pico,
    };
  }
}