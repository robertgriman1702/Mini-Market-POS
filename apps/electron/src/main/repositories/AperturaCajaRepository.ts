import type Database from 'better-sqlite3';
import type { AperturaCaja, AperturaCajaInput } from '@pos/shared';
import type { IAperturaCajaRepository } from './interfaces/IAperturaCajaRepository';

// =============================================================================
// AperturaCajaRepository — implementación SQLite de IAperturaCajaRepository
//
// Responsabilidad única: traducir operaciones de dominio a SQL.
// No tiene lógica de negocio — no decide si la caja "puede" abrirse,
// solo persiste y consulta aperturas ya validadas por el Service.
// =============================================================================

export class AperturaCajaRepository implements IAperturaCajaRepository {
  constructor(private readonly db: Database.Database) {}

  findByFecha(fecha: string): AperturaCaja | null {
    return (
      this.db
        .prepare<[string], AperturaCaja>(
          'SELECT * FROM aperturas_caja WHERE fecha = ? ORDER BY created_at DESC LIMIT 1'
        )
        .get(fecha) ?? null
    );
  }

  create(data: AperturaCajaInput): AperturaCaja {
    const result = this.db
      .prepare(`
        INSERT INTO aperturas_caja (fondo_inicial, observaciones, usuario, fecha)
        VALUES (@fondo_inicial, @observaciones, @usuario, @fecha)
      `)
      .run({
        fondo_inicial: data.fondo_inicial,
        observaciones: data.observaciones ?? null,
        usuario:       data.usuario,
        fecha:         data.fecha,
      });

    return this.db
      .prepare<[number], AperturaCaja>('SELECT * FROM aperturas_caja WHERE id = ?')
      .get(result.lastInsertRowid as number)!;
  }
}