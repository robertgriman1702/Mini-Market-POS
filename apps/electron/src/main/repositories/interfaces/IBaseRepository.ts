// =============================================================================
// IBaseRepository<T, TInput, TUpdate>
//
// Contrato genérico que todo repositorio debe cumplir.
// Principio: el Service depende de esta abstracción, nunca de SQLite.
// Si mañana cambiamos la DB, solo cambia la implementación concreta.
// =============================================================================

export interface IBaseRepository<T, TInput, TUpdate> {
  findAll(): T[];
  findById(id: number): T | null;
  create(data: TInput): T;
  update(data: TUpdate): T;
  delete(id: number): boolean;
}
