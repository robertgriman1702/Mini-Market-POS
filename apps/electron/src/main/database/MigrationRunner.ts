import type Database from 'better-sqlite3';

interface Migration { version: number; description: string; sql: string; }

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Catálogo base: categorías, proveedores, productos',
    sql: `
      CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL UNIQUE,
        descripcion TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE TABLE IF NOT EXISTS proveedores (
        id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL,
        contacto TEXT, telefono TEXT, email TEXT UNIQUE,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE TABLE IF NOT EXISTS productos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL, codigo_qr TEXT NOT NULL UNIQUE,
        precio INTEGER NOT NULL CHECK (precio >= 0),
        precio_costo INTEGER NOT NULL DEFAULT 0 CHECK (precio_costo >= 0),
        stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
        stock_minimo INTEGER NOT NULL DEFAULT 5,
        categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
        proveedor_id INTEGER REFERENCES proveedores(id) ON DELETE SET NULL,
        unidad_medida TEXT NOT NULL DEFAULT 'unidad'
          CHECK (unidad_medida IN ('unidad','kg','gramo','litro','ml','caja','paquete')),
        activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX IF NOT EXISTS idx_productos_codigo_qr ON productos(codigo_qr);
      CREATE INDEX IF NOT EXISTS idx_productos_nombre    ON productos(nombre);
      CREATE INDEX IF NOT EXISTS idx_productos_activo    ON productos(activo);
      CREATE TRIGGER IF NOT EXISTS trg_productos_updated_at
        AFTER UPDATE ON productos FOR EACH ROW BEGIN
          UPDATE productos SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = OLD.id;
        END;
    `,
  },
  {
    version: 2,
    description: 'Punto de venta: ventas e items',
    sql: `
      CREATE TABLE IF NOT EXISTS ventas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total INTEGER NOT NULL CHECK (total >= 0),
        descuento INTEGER NOT NULL DEFAULT 0,
        metodo_pago TEXT NOT NULL DEFAULT 'efectivo'
          CHECK (metodo_pago IN ('efectivo','tarjeta','transferencia','mixto')),
        estado TEXT NOT NULL DEFAULT 'completada'
          CHECK (estado IN ('completada','cancelada','pendiente')),
        cajero_id INTEGER,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE TABLE IF NOT EXISTS items_venta (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
        producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
        cantidad INTEGER NOT NULL CHECK (cantidad > 0),
        precio_unitario INTEGER NOT NULL CHECK (precio_unitario >= 0)
      );
      CREATE INDEX IF NOT EXISTS idx_items_venta_id ON items_venta(venta_id);
      CREATE INDEX IF NOT EXISTS idx_items_producto  ON items_venta(producto_id);
      CREATE INDEX IF NOT EXISTS idx_ventas_fecha    ON ventas(created_at);
      CREATE INDEX IF NOT EXISTS idx_ventas_estado   ON ventas(estado);
    `,
  },
  {
    version: 3,
    description: 'Auditoría: movimientos de inventario',
    sql: `
      CREATE TABLE IF NOT EXISTS movimientos_inventario (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
        tipo TEXT NOT NULL CHECK (tipo IN ('entrada','salida','ajuste','venta')),
        cantidad INTEGER NOT NULL,
        stock_anterior INTEGER NOT NULL, stock_nuevo INTEGER NOT NULL,
        motivo TEXT, referencia_id INTEGER,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX IF NOT EXISTS idx_mov_producto ON movimientos_inventario(producto_id);
      CREATE INDEX IF NOT EXISTS idx_mov_fecha    ON movimientos_inventario(created_at);
    `,
  },
  {
    version: 4,
    description: 'Optimización: índices compuestos + catálogo compartido',
    sql: `
      CREATE TABLE IF NOT EXISTS catalogo_global (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT NOT NULL UNIQUE, nombre TEXT NOT NULL,
        marca TEXT, categoria TEXT, cantidad TEXT,
        unidad_medida TEXT NOT NULL DEFAULT 'unidad',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX IF NOT EXISTS idx_catalogo_codigo ON catalogo_global(codigo);
      CREATE INDEX IF NOT EXISTS idx_catalogo_nombre ON catalogo_global(nombre COLLATE NOCASE);

      -- Índice compuesto para cierre de caja (elimina full scan)
      CREATE INDEX IF NOT EXISTS idx_ventas_estado_fecha ON ventas(estado, created_at);

      -- Índice para reportes de ventas por producto
      CREATE INDEX IF NOT EXISTS idx_items_producto_venta ON items_venta(producto_id, venta_id);

      -- Auditoría por fecha y tipo
      CREATE INDEX IF NOT EXISTS idx_mov_fecha_tipo ON movimientos_inventario(created_at, tipo);

      ANALYZE;
    `,
  },
  {
    version: 5,
    description: 'Vistas de resumen: movimientos recientes y productos con ventas 30d',
    sql: `
      CREATE VIEW IF NOT EXISTS movimientos_recientes AS
        SELECT * FROM movimientos_inventario
         WHERE created_at >= datetime('now', '-90 days')
         ORDER BY created_at DESC;

      CREATE VIEW IF NOT EXISTS productos_resumen AS
        SELECT p.*,
          CASE WHEN p.stock <= p.stock_minimo THEN 1 ELSE 0 END AS stock_bajo,
          (SELECT COALESCE(SUM(iv.cantidad), 0)
             FROM items_venta iv
             JOIN ventas v ON iv.venta_id = v.id
            WHERE iv.producto_id = p.id
              AND v.estado = 'completada'
              AND v.created_at >= datetime('now', '-30 days')
          ) AS vendido_30d
        FROM productos p
        WHERE p.activo = 1;

      ANALYZE;
    `,
  },
  {
    version: 6,
    description: 'Tabla de clientes + cliente_id en ventas',
    sql: `
      CREATE TABLE IF NOT EXISTS clientes (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        cedula     TEXT    NOT NULL UNIQUE COLLATE NOCASE,
        nombre     TEXT    NOT NULL,
        apellido   TEXT    NOT NULL,
        telefono   TEXT,
        created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );

      CREATE INDEX IF NOT EXISTS idx_clientes_cedula   ON clientes(cedula COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_clientes_nombre   ON clientes(nombre COLLATE NOCASE);

      -- Trigger para updated_at
      CREATE TRIGGER IF NOT EXISTS trg_clientes_updated
        AFTER UPDATE ON clientes FOR EACH ROW
        BEGIN
          UPDATE clientes SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE id = OLD.id;
        END;

      -- Agregar cliente_id a ventas (NULL = venta sin cliente registrado)
      ALTER TABLE ventas ADD COLUMN cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL;

      CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON ventas(cliente_id);
    `,
  },
  {
    version: 7,
    description: 'Caja: apertura de caja, ventas suspendidas y bitácora',
    sql: `
      -- Apertura de Caja: una por jornada. Bloquea el acceso al POS hasta
      -- que exista una apertura vigente para la fecha actual.
      CREATE TABLE IF NOT EXISTS aperturas_caja (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        fondo_inicial INTEGER NOT NULL DEFAULT 0 CHECK (fondo_inicial >= 0),
        observaciones TEXT,
        usuario       TEXT    NOT NULL,
        fecha         TEXT    NOT NULL,
        created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );

      CREATE INDEX IF NOT EXISTS idx_aperturas_fecha ON aperturas_caja(fecha);

      -- Ventas Suspendidas: snapshot del carrito en curso. NO descuenta stock
      -- ni genera movimientos de inventario — eso ocurre solo cuando la venta
      -- se finaliza de verdad a través de ventas:crear. items se guarda como
      -- TEXT (JSON serializado) porque SQLite no tiene tipo de array nativo.
      CREATE TABLE IF NOT EXISTS ventas_suspendidas (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id    INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
        items         TEXT    NOT NULL,
        descuento     INTEGER NOT NULL DEFAULT 0 CHECK (descuento >= 0),
        observaciones TEXT,
        estado        TEXT    NOT NULL DEFAULT 'suspendida'
          CHECK (estado IN ('suspendida','recuperada','finalizada','eliminada')),
        usuario       TEXT    NOT NULL,
        created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );

      CREATE INDEX IF NOT EXISTS idx_ventas_susp_estado  ON ventas_suspendidas(estado);
      CREATE INDEX IF NOT EXISTS idx_ventas_susp_cliente ON ventas_suspendidas(cliente_id);
      CREATE INDEX IF NOT EXISTS idx_ventas_susp_fecha   ON ventas_suspendidas(created_at);

      -- Trigger para updated_at
      CREATE TRIGGER IF NOT EXISTS trg_ventas_susp_updated
        AFTER UPDATE ON ventas_suspendidas FOR EACH ROW
        BEGIN
          UPDATE ventas_suspendidas SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE id = OLD.id;
        END;

      -- Bitácora de Caja: registro inmutable de auditoría. Nunca se edita
      -- ni se borra — mismo patrón que movimientos_inventario.
      CREATE TABLE IF NOT EXISTS bitacora_caja (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        accion        TEXT NOT NULL
          CHECK (accion IN ('apertura','cierre','venta_realizada','venta_suspendida',
                             'venta_recuperada','venta_eliminada','venta_anulada','diferencia_caja')),
        detalles      TEXT,
        usuario       TEXT NOT NULL,
        referencia_id INTEGER,
        created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );

      CREATE INDEX IF NOT EXISTS idx_bitacora_fecha  ON bitacora_caja(created_at);
      CREATE INDEX IF NOT EXISTS idx_bitacora_accion ON bitacora_caja(accion);

      ANALYZE;
    `,
  },
];

export class MigrationRunner {
  constructor(private readonly db: Database.Database) {}

  run(): void {
    this.ensureControlTable();
    const current = this.currentVersion();
    const pending = MIGRATIONS.filter((m) => m.version > current);

    if (pending.length === 0) {
      console.log(`[DB] Schema v${current} — sin migraciones pendientes.`);
      this.db.exec('ANALYZE;'); // re-ejecutar en cada arranque
      return;
    }

    console.log(`[DB] Aplicando ${pending.length} migración(es) desde v${current}...`);
    this.db.transaction(() => {
      for (const m of pending) {
        console.log(`  → v${m.version}: ${m.description}`);
        this.db.exec(m.sql);
        this.db.prepare('INSERT INTO _migrations (version, description) VALUES (?, ?)').run(m.version, m.description);
      }
    })();
    console.log(`[DB] Schema actualizado a v${pending.at(-1)!.version}.`);
  }

  private ensureControlTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY, description TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
    `);
  }

  private currentVersion(): number {
    return this.db
      .prepare<[], { version: number }>('SELECT COALESCE(MAX(version), 0) AS version FROM _migrations')
      .get()?.version ?? 0;
  }
}