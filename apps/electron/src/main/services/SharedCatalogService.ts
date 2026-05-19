import Database from 'better-sqlite3';
import type { CatalogoProducto, CatalogoProductoInput } from '@pos/shared';

// =============================================================================
// SharedCatalogService
//
// Gestiona la tabla catalogo_global dentro de pos.db.
// Esta tabla actúa como base de datos compartida de productos:
//   - El admin agrega productos una vez
//   - Todos los negocios que importen el catálogo los tienen disponibles
//   - Al escanear un código desconocido, se pre-llena el formulario
//   - Exportar/importar via JSON (WhatsApp, USB, email)
// =============================================================================

// Keywords para inferir categoría desde el nombre del producto
const KEYWORDS: Array<{ words: string[]; categoria: string }> = [
  { words: ['desodorante', 'deodorant', 'antitranspirante', 'deo', 'antiperspirant'],
    categoria: 'Higiene y Belleza' },
  { words: ['shampoo', 'champú', 'champu', 'acondicionador', 'conditioner'],
    categoria: 'Higiene y Belleza' },
  { words: ['jabón', 'jabon', 'soap', 'gel de baño', 'shower', 'gel corporal'],
    categoria: 'Higiene y Belleza' },
  { words: ['crema', 'loción', 'locion', 'lotion', 'hidratante', 'moisturizer'],
    categoria: 'Higiene y Belleza' },
  { words: ['pasta dental', 'toothpaste', 'cepillo dental', 'enjuague', 'colgate', 'oral-b'],
    categoria: 'Higiene y Belleza' },
  { words: ['afeitado', 'shaving', 'gillette', 'espuma afeit'],
    categoria: 'Higiene y Belleza' },
  { words: ['perfume', 'colonia', 'cologne', 'eau de'],
    categoria: 'Perfumería' },
  { words: ['pañal', 'diaper', 'toallita bebe', 'johnson baby', 'pampers'],
    categoria: 'Bebé' },
  { words: ['detergente', 'lavaplatos', 'suavizante', 'cloro', 'lejia', 'ajax', 'fabuloso'],
    categoria: 'Limpieza' },
  { words: ['refresco', 'soda', 'coca cola', 'pepsi', 'sprite', 'fanta', 'gatorade', 'cola'],
    categoria: 'Bebidas' },
  { words: ['agua', 'water'],
    categoria: 'Agua' },
  { words: ['jugo', 'juice', 'nectar', 'néctar'],
    categoria: 'Jugos' },
  { words: ['leche', 'milk', 'yogur', 'yogurt', 'queso', 'cheese', 'mantequilla'],
    categoria: 'Lácteos' },
  { words: ['chocolate', 'cocoa', 'cacao'],
    categoria: 'Dulces y Golosinas' },
  { words: ['galleta', 'cookie', 'biscuit', 'oblea', 'wafer', 'chips', 'snack'],
    categoria: 'Snacks' },
  { words: ['arroz', 'pasta', 'fideos', 'spaghetti', 'noodle', 'macarron'],
    categoria: 'Pasta y Arroz' },
  { words: ['aceite', 'oil', 'vinagre', 'vinegar', 'salsa', 'ketchup', 'mayonesa'],
    categoria: 'Condimentos' },
  { words: ['vitamina', 'vitamin', 'suplemento', 'supplement', 'proteina', 'protein'],
    categoria: 'Suplementos' },
  { words: ['cerveza', 'beer', 'vino', 'wine', 'whisky', 'ron', 'rum', 'licor'],
    categoria: 'Licores' },
  { words: ['cereal', 'granola', 'avena', 'oatmeal'],
    categoria: 'Cereales' },
  { words: ['cafe', 'café', 'coffee', 'te ', 'tea', 'infusion'],
    categoria: 'Café y Té' },
  { words: ['atun', 'atún', 'sardina', 'salmon', 'enlatado', 'conserva'],
    categoria: 'Enlatados' },
  { words: ['pollo', 'carne', 'res', 'cerdo', 'jamon', 'embutido', 'salchicha'],
    categoria: 'Carnes' },
];

export class SharedCatalogService {
  constructor(private readonly db: Database.Database) {}

  // ---------------------------------------------------------------------------
  // Inicializar tabla en pos.db
  // ---------------------------------------------------------------------------

  ensureTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS catalogo_global (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo        TEXT    NOT NULL UNIQUE,
        nombre        TEXT    NOT NULL,
        marca         TEXT,
        categoria     TEXT,
        cantidad      TEXT,
        unidad_medida TEXT    NOT NULL DEFAULT 'unidad',
        created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX IF NOT EXISTS idx_catalogo_codigo ON catalogo_global(codigo);
      CREATE INDEX IF NOT EXISTS idx_catalogo_nombre ON catalogo_global(nombre);
    `);
  }

  // ---------------------------------------------------------------------------
  // Búsqueda por código de barras (llamada al escanear)
  // ---------------------------------------------------------------------------

  buscarPorCodigo(codigoRaw: string): CatalogoProducto | null {
    const codigo = codigoRaw.trim();

    // Buscar EAN-13 exacto
    const exacto = this.db
      .prepare<[string], CatalogoProducto>(
        'SELECT * FROM catalogo_global WHERE codigo = ?'
      )
      .get(codigo);

    if (exacto) return exacto;

    // Buscar variante UPC-A (sin cero inicial)
    if (codigo.startsWith('0') && codigo.length === 13) {
      return this.db
        .prepare<[string], CatalogoProducto>(
          'SELECT * FROM catalogo_global WHERE codigo = ?'
        )
        .get(codigo.slice(1)) ?? null;
    }

    // Buscar variante EAN-13 (agregar cero inicial a UPC-A)
    if (codigo.length === 12) {
      return this.db
        .prepare<[string], CatalogoProducto>(
          'SELECT * FROM catalogo_global WHERE codigo = ?'
        )
        .get('0' + codigo) ?? null;
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // Inferir categoría desde el nombre (sin necesidad de estar en el catálogo)
  // ---------------------------------------------------------------------------

  sugerirCategoria(nombre: string): string | null {
    const n = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    for (const { words, categoria } of KEYWORDS) {
      if (words.some((w) => n.includes(w))) return categoria;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Agregar al catálogo
  // ---------------------------------------------------------------------------

  agregar(data: CatalogoProductoInput): boolean {
    try {
      // Si no tiene categoría, intentar inferirla del nombre
      const categoria = data.categoria || this.sugerirCategoria(data.nombre);

      this.db.prepare(`
        INSERT INTO catalogo_global (codigo, nombre, marca, categoria, cantidad, unidad_medida)
        VALUES (@codigo, @nombre, @marca, @categoria, @cantidad, @unidad_medida)
        ON CONFLICT(codigo) DO UPDATE SET
          nombre        = excluded.nombre,
          marca         = excluded.marca,
          categoria     = excluded.categoria,
          cantidad      = excluded.cantidad,
          unidad_medida = excluded.unidad_medida
      `).run({ ...data, categoria });

      return true;
    } catch (err) {
      console.error('[Catalogo] Error al agregar:', err);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Listar todos
  // ---------------------------------------------------------------------------

  listar(): CatalogoProducto[] {
    return this.db
      .prepare<[], CatalogoProducto>(
        'SELECT * FROM catalogo_global ORDER BY nombre ASC'
      )
      .all();
  }

  // ---------------------------------------------------------------------------
  // Exportar como JSON (para compartir por WhatsApp/USB)
  // ---------------------------------------------------------------------------

  exportar(): string {
    const productos = this.listar();
    return JSON.stringify({ version: 1, productos }, null, 2);
  }

  // ---------------------------------------------------------------------------
  // Importar desde JSON
  // ---------------------------------------------------------------------------

  importar(json: string): number {
    let parsed: { version: number; productos: CatalogoProductoInput[] };

    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error('El archivo JSON no es válido.');
    }

    if (!Array.isArray(parsed.productos)) {
      throw new Error('Formato de catálogo inválido.');
    }

    const importar = this.db.transaction(() => {
      let count = 0;
      for (const p of parsed.productos) {
        if (!p.codigo || !p.nombre) continue;
        const ok = this.agregar(p);
        if (ok) count++;
      }
      return count;
    });

    return importar();
  }
}