import type Database from 'better-sqlite3';
import type {
  VentaSuspendida,
  VentaSuspendidaInput,
  EstadoVentaSuspendida,
  ItemVentaSuspendida,
} from '@pos/shared';
import type { IVentaSuspendidaRepository } from './interfaces/IVentaSuspendidaRepository';

// =============================================================================
// VentaSuspendidaRepository — implementación SQLite de IVentaSuspendidaRepository
//
// La columna `items` se persiste como TEXT (JSON serializado) porque SQLite
// no tiene un tipo de array nativo. Este repositorio es responsable de la
// serialización/deserialización — el resto del sistema solo ve
// ItemVentaSuspendida[].
//
// No descuenta stock ni registra movimientos de inventario: eso es
// exclusivo de VentaRepository.create() cuando la venta se confirma de verdad.
// =============================================================================

// Fila cruda tal como sale de SQLite (items aún como TEXT)
interface VentaSuspendidaRow {
  id:            number;
  cliente_id:    number | null;
  items:         string;
  descuento:     number;
  observaciones: string | null;
  estado:        EstadoVentaSuspendida;
  usuario:       string;
  created_at:    string;
  updated_at:    string;
}

export class VentaSuspendidaRepository implements IVentaSuspendidaRepository {
  constructor(private readonly db: Database.Database) {}

  findById(id: number): VentaSuspendida | null {
    const row = this.db
      .prepare<[number], VentaSuspendidaRow>(
        'SELECT * FROM ventas_suspendidas WHERE id = ?'
      )
      .get(id);
    return row ? this.toEntity(row) : null;
  }

  findPendientes(): VentaSuspendida[] {
    return this.db
      .prepare<[], VentaSuspendidaRow>(`
        SELECT * FROM ventas_suspendidas
        WHERE estado = 'suspendida'
        ORDER BY created_at DESC
      `)
      .all()
      .map((row) => this.toEntity(row));
  }

  create(data: VentaSuspendidaInput): VentaSuspendida {
    const result = this.db
      .prepare(`
        INSERT INTO ventas_suspendidas (cliente_id, items, descuento, observaciones, usuario)
        VALUES (@cliente_id, @items, @descuento, @observaciones, @usuario)
      `)
      .run({
        cliente_id:    data.cliente_id ?? null,
        items:         JSON.stringify(data.items),
        descuento:     data.descuento ?? 0,
        observaciones: data.observaciones ?? null,
        usuario:       data.usuario,
      });

    return this.findById(result.lastInsertRowid as number)!;
  }

  updateEstado(id: number, estado: EstadoVentaSuspendida): boolean {
    const result = this.db
      .prepare('UPDATE ventas_suspendidas SET estado = ? WHERE id = ?')
      .run(estado, id);
    return result.changes > 0;
  }

  private toEntity(row: VentaSuspendidaRow): VentaSuspendida {
    return {
      ...row,
      items: JSON.parse(row.items) as ItemVentaSuspendida[],
    };
  }
}