import type Database from 'better-sqlite3';
import type { BitacoraCajaEntry, BitacoraCajaInput } from '@pos/shared';
import type { IBitacoraCajaRepository } from './interfaces/IBitacoraCajaRepository';

// =============================================================================
// BitacoraCajaRepository — registro inmutable de auditoría de caja
//
// Las entradas de bitácora NUNCA se editan ni se borran.
// Es el libro contable de las acciones de Caja (apertura, cierre,
// ventas realizadas/suspendidas/recuperadas/eliminadas/anuladas, diferencias).
// =============================================================================

export class BitacoraCajaRepository implements IBitacoraCajaRepository {
  constructor(private readonly db: Database.Database) {}

  registrar(payload: BitacoraCajaInput): BitacoraCajaEntry {
    const result = this.db
      .prepare(`
        INSERT INTO bitacora_caja (accion, detalles, usuario, referencia_id)
        VALUES (@accion, @detalles, @usuario, @referencia_id)
      `)
      .run({
        accion:        payload.accion,
        detalles:      payload.detalles ?? null,
        usuario:       payload.usuario,
        referencia_id: payload.referencia_id ?? null,
      });

    return this.db
      .prepare<[number], BitacoraCajaEntry>(
        'SELECT * FROM bitacora_caja WHERE id = ?'
      )
      .get(result.lastInsertRowid as number)!;
  }

  findByFecha(fecha: string): BitacoraCajaEntry[] {
    return this.db
      .prepare<[string], BitacoraCajaEntry>(`
        SELECT * FROM bitacora_caja
        WHERE date(created_at) = date(?)
        ORDER BY created_at DESC
      `)
      .all(fecha);
  }
}