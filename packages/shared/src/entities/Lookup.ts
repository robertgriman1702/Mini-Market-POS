// =============================================================================
// ProductoLookupResult
// Resultado de consultar un código de barras en APIs externas.
// Si encontrado = false, el formulario queda vacío para ingreso manual.
// =============================================================================

export interface ProductoLookupResult {
  encontrado:   boolean;
  codigo:       string;             // El código que se consultó
  nombre?:      string;             // Nombre del producto
  marca?:       string;             // Ej: "Coca-Cola", "Nestlé"
  categoria?:   string;             // Categoría principal en español
  cantidad?:    string;             // Ej: "600 ml", "1 kg", "12 unidades"
  imagen_url?:  string;             // URL de imagen del producto
  fuente:       LookupFuente;
  pais_origen?: string;             // País del fabricante según prefijo EAN
}

export type LookupFuente =
  | 'local'               // Producto ya existe en pos.db
  | 'open_food_facts'     // Open Food Facts (alimentos/bebidas)
  | 'open_beauty_facts'   // Open Beauty Facts (cosméticos/higiene) ← Nivea
  | 'open_products_facts' // Open Products Facts (limpieza/electrónica)
  | 'upcitemdb'           // UPC Item DB (USA/global)
  | 'ean_search'          // EAN-Search.org (Europa/global — Alemania, España)
  | 'digitaleyes'         // Digit Eyes (fallback final)
  | 'no_encontrado';      // No se encontró en ninguna fuente