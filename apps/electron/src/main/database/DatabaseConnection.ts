import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

// =============================================================================
// DatabaseConnection — Singleton
//
// Responsabilidad única: abrir, configurar y cerrar la conexión SQLite.
// No sabe nada de tablas, schemas ni lógica de negocio.
// =============================================================================

export class DatabaseConnection {
  private static instance: DatabaseConnection | null = null;
  private db: Database.Database | null = null;

  private constructor() {}

  static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  // ---------------------------------------------------------------------------
  // Apertura de la conexión
  // ---------------------------------------------------------------------------

  open(): Database.Database {
    if (this.db) return this.db;

    const dbPath = this.resolvePath();
    console.log(`[DB] Abriendo: ${dbPath}`);

    this.db = new Database(dbPath, {
      verbose: process.env.NODE_ENV === 'development'
        ? (msg) => console.log(`[SQLite] ${msg}`)
        : undefined,
    });

    this.applyPragmas(this.db);
    console.log('[DB] Conexión lista.');
    return this.db;
  }

  // ---------------------------------------------------------------------------
  // Acceso a la instancia (debe llamarse después de open())
  // ---------------------------------------------------------------------------

  get(): Database.Database {
    if (!this.db) throw new Error('[DB] La conexión no ha sido abierta.');
    return this.db;
  }

  // ---------------------------------------------------------------------------
  // Cierre seguro — llamar en el evento will-quit de Electron
  // ---------------------------------------------------------------------------

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('[DB] Conexión cerrada.');
    }
  }

  // ---------------------------------------------------------------------------
  // Privados
  // ---------------------------------------------------------------------------

  private resolvePath(): string {
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    return path.join(userDataPath, 'pos.db');
  }

  private applyPragmas(db: Database.Database): void {
    db.exec(`
      PRAGMA journal_mode  = WAL;
      PRAGMA synchronous   = NORMAL;
      PRAGMA cache_size    = -64000;
      PRAGMA temp_store    = MEMORY;
      PRAGMA foreign_keys  = ON;
      PRAGMA busy_timeout  = 5000;
    `);
  }
}
