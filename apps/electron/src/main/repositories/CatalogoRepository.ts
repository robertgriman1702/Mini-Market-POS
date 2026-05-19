import type Database from 'better-sqlite3';
import type { Categoria, CategoriaInput, Proveedor, ProveedorInput } from '@pos/shared';
import type { ICategoriaRepository } from './interfaces/ICatalogoRepository';
import type { IProveedorRepository }  from './interfaces/ICatalogoRepository';

// =============================================================================
// CategoriaRepository
// =============================================================================

export class CategoriaRepository implements ICategoriaRepository {
  constructor(private readonly db: Database.Database) {}

  findAll(): Categoria[] {
    return this.db
      .prepare<[], Categoria>('SELECT * FROM categorias ORDER BY nombre ASC')
      .all();
  }

  findById(id: number): Categoria | null {
    return (
      this.db
        .prepare<[number], Categoria>('SELECT * FROM categorias WHERE id = ?')
        .get(id) ?? null
    );
  }

  findByNombre(nombre: string): Categoria | null {
    return (
      this.db
        .prepare<[string], Categoria>(
          'SELECT * FROM categorias WHERE nombre = ? COLLATE NOCASE'
        )
        .get(nombre) ?? null
    );
  }

  create(data: CategoriaInput): Categoria {
    const result = this.db
      .prepare('INSERT INTO categorias (nombre, descripcion) VALUES (@nombre, @descripcion)')
      .run(data);
    return this.findById(result.lastInsertRowid as number)!;
  }

  update(data: Partial<CategoriaInput> & { id: number }): Categoria {
    const { id, ...fields } = data;
    const sets = Object.keys(fields).map((k) => `${k} = @${k}`).join(', ');
    this.db.prepare(`UPDATE categorias SET ${sets} WHERE id = @id`).run(data);
    return this.findById(id)!;
  }

  delete(id: number): boolean {
    const result = this.db
      .prepare('DELETE FROM categorias WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }
}

// =============================================================================
// ProveedorRepository
// =============================================================================

export class ProveedorRepository implements IProveedorRepository {
  constructor(private readonly db: Database.Database) {}

  findAll(): Proveedor[] {
    return this.db
      .prepare<[], Proveedor>('SELECT * FROM proveedores ORDER BY nombre ASC')
      .all();
  }

  findById(id: number): Proveedor | null {
    return (
      this.db
        .prepare<[number], Proveedor>('SELECT * FROM proveedores WHERE id = ?')
        .get(id) ?? null
    );
  }

  findByEmail(email: string): Proveedor | null {
    return (
      this.db
        .prepare<[string], Proveedor>('SELECT * FROM proveedores WHERE email = ?')
        .get(email) ?? null
    );
  }

  create(data: ProveedorInput): Proveedor {
    const result = this.db
      .prepare(`
        INSERT INTO proveedores (nombre, contacto, telefono, email)
        VALUES (@nombre, @contacto, @telefono, @email)
      `)
      .run(data);
    return this.findById(result.lastInsertRowid as number)!;
  }

  update(data: Partial<ProveedorInput> & { id: number }): Proveedor {
    const { id, ...fields } = data;
    const sets = Object.keys(fields).map((k) => `${k} = @${k}`).join(', ');
    this.db.prepare(`UPDATE proveedores SET ${sets} WHERE id = @id`).run(data);
    return this.findById(id)!;
  }

  delete(id: number): boolean {
    const result = this.db
      .prepare('DELETE FROM proveedores WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }
}
