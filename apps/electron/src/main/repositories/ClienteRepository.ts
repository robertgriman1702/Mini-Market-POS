import type Database from 'better-sqlite3';
import type { Cliente, ClienteInput, ClienteUpdate } from '@pos/shared';

// =============================================================================
// ClienteRepository - implementacion SQLite para clientes
// =============================================================================

export class ClienteRepository {
  constructor(private readonly db: Database.Database) {}

  ensureTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS clientes (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        cedula     TEXT    NOT NULL UNIQUE COLLATE NOCASE,
        nombre     TEXT    NOT NULL,
        apellido   TEXT    NOT NULL,
        telefono   TEXT,
        created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );

      CREATE INDEX IF NOT EXISTS idx_clientes_cedula ON clientes(cedula COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes(nombre COLLATE NOCASE);

      CREATE TRIGGER IF NOT EXISTS trg_clientes_updated
        AFTER UPDATE ON clientes FOR EACH ROW
        BEGIN
          UPDATE clientes SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE id = OLD.id;
        END;
    `);
  }

  findAll(): Cliente[] {
    return this.db
      .prepare<[], Cliente>('SELECT * FROM clientes ORDER BY nombre ASC, apellido ASC')
      .all();
  }

  findById(id: number): Cliente | null {
    return (
      this.db
        .prepare<[number], Cliente>('SELECT * FROM clientes WHERE id = ?')
        .get(id) ?? null
    );
  }

  findByCedula(cedula: string): Cliente | null {
    return (
      this.db
        .prepare<[string], Cliente>('SELECT * FROM clientes WHERE cedula = ? COLLATE NOCASE')
        .get(cedula) ?? null
    );
  }

  search(termino: string): Cliente[] {
    const like = `%${termino}%`;
    return this.db
      .prepare<[string, string, string, string], Cliente>(`
        SELECT * FROM clientes
        WHERE cedula LIKE ?
           OR nombre LIKE ?
           OR apellido LIKE ?
           OR telefono LIKE ?
        ORDER BY nombre ASC, apellido ASC
        LIMIT 50
      `)
      .all(like, like, like, like);
  }

  findRecent(limit: number): Cliente[] {
    return this.db
      .prepare<[number], Cliente>('SELECT * FROM clientes ORDER BY updated_at DESC LIMIT ?')
      .all(limit);
  }

  create(data: ClienteInput): Cliente {
    const result = this.db
      .prepare(`
        INSERT INTO clientes (cedula, nombre, apellido, telefono)
        VALUES (@cedula, @nombre, @apellido, @telefono)
      `)
      .run({
        cedula: data.cedula.trim(),
        nombre: data.nombre.trim(),
        apellido: data.apellido.trim(),
        telefono: data.telefono?.trim() || null,
      });

    return this.findById(result.lastInsertRowid as number)!;
  }

  update(data: ClienteUpdate): Cliente {
    const { id, ...fields } = data;
    const normalized = Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [
        key,
        typeof value === 'string' ? value.trim() : value,
      ])
    );
    const sets = Object.keys(normalized)
      .map((key) => `${key} = @${key}`)
      .join(', ');

    if (!sets) return this.findById(id)!;

    this.db.prepare(`UPDATE clientes SET ${sets} WHERE id = @id`).run({
      id,
      ...normalized,
    });
    return this.findById(id)!;
  }
}
