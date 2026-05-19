# 🛒 POS MiniMarket

> Sistema de gestión de inventario y punto de venta, Local-First, para mini-markets.
> Monorepo · Electron · TypeScript · React · SQLite · Tailwind CSS

---

## Estructura del proyecto

```
pos-minimarket/                         ← Raíz del monorepo (npm workspaces)
│
├── packages/
│   └── shared/                         ← Contrato central: tipos + IPC
│       └── src/
│           ├── entities/
│           │   ├── Producto.ts         ← Entidad Producto + tipos derivados
│           │   ├── Venta.ts            ← Entidad Venta, ItemVenta, NuevaVentaPayload
│           │   └── Catalogo.ts         ← Categoria, Proveedor, MovimientoInventario
│           ├── ipc/
│           │   ├── channels.ts         ← Mapa tipado de TODOS los canales IPC
│           │   └── events.ts           ← Eventos unidireccionales Main→Renderer
│           ├── api/
│           │   └── response.ts         ← ApiResponse<T>, ok(), fail()
│           ├── electron-api.ts         ← Interfaz de window.electronAPI
│           └── index.ts                ← Barrel: único punto de importación
│
└── apps/
    ├── electron/                       ← Backend: Main Process + Preload
    │   └── src/
    │       ├── main/
    │       │   ├── index.ts            ← Entrada: arranque en 3 pasos
    │       │   ├── window/
    │       │   │   └── WindowFactory.ts        ← Crea y configura BrowserWindow
    │       │   ├── database/
    │       │   │   ├── DatabaseConnection.ts   ← Singleton SQLite + PRAGMAs
    │       │   │   └── MigrationRunner.ts      ← Versionado del schema
    │       │   ├── repositories/
    │       │   │   ├── interfaces/             ← CONTRATOS (Dependency Inversion)
    │       │   │   │   ├── IBaseRepository.ts
    │       │   │   │   ├── IProductoRepository.ts
    │       │   │   │   ├── IVentaRepository.ts
    │       │   │   │   ├── ICatalogoRepository.ts
    │       │   │   │   └── IMovimientoRepository.ts
    │       │   │   ├── ProductoRepository.ts   ← Implementación SQLite
    │       │   │   ├── VentaRepository.ts
    │       │   │   ├── CatalogoRepository.ts
    │       │   │   └── MovimientoRepository.ts
    │       │   ├── services/
    │       │   │   ├── ProductoService.ts      ← Lógica de inventario
    │       │   │   ├── VentaService.ts         ← Lógica del POS + transacciones
    │       │   │   └── CatalogoService.ts      ← Lógica de categorías/proveedores
    │       │   └── ipc/
    │       │       ├── helpers.ts              ← safeHandler + handle() tipado
    │       │       ├── registry.ts             ← Composition Root (inyección de deps)
    │       │       └── handlers/               ← UN archivo por dominio
    │       │           ├── productos.handler.ts
    │       │           ├── ventas.handler.ts
    │       │           ├── catalogo.handler.ts
    │       │           └── movimientos.handler.ts
    │       └── preload/
    │           └── index.ts            ← contextBridge + whitelist de canales
    │
    └── renderer/                       ← Frontend: React + Vite + Tailwind
        └── src/
            ├── main.tsx                ← ReactDOM.createRoot
            ├── App.tsx                 ← Componente raíz
            ├── globals.css             ← Tailwind + tokens CSS
            ├── lib/
            │   └── ipc.ts             ← ipcInvoke() + IPCError
            └── hooks/
                ├── useQuery.ts        ← Lecturas reactivas (auto-fetch)
                ├── useMutation.ts     ← Escrituras imperativas
                ├── useIPCEvent.ts     ← Eventos Main→Renderer
                └── index.ts           ← Barrel
```

---

## Los 5 principios SOLID aplicados

### S — Single Responsibility
Cada archivo tiene exactamente una razón para cambiar:

| Archivo | Su única responsabilidad |
|---|---|
| `DatabaseConnection.ts` | Abrir y cerrar SQLite |
| `MigrationRunner.ts` | Versionar el schema |
| `ProductoRepository.ts` | Traducir SQL ↔ objetos Producto |
| `ProductoService.ts` | Aplicar reglas de negocio del inventario |
| `productos.handler.ts` | Recibir mensajes IPC y delegar al servicio |

### O — Open/Closed
Los servicios están abiertos a extensión, cerrados a modificación.
Para agregar búsqueda avanzada por categoría, extiendes `IProductoRepository`
y agregas el método en `ProductoRepository` — sin tocar `ProductoService`.

### L — Liskov Substitution
Cualquier implementación de `IProductoRepository` puede reemplazar a `ProductoRepository`.
Si mañana migras a PostgreSQL, creas `PostgresProductoRepository implements IProductoRepository`
y cambias una sola línea en `registry.ts`.

### I — Interface Segregation
Las interfaces son pequeñas y específicas:
- `IBaseRepository` — CRUD genérico
- `IProductoRepository` — agrega `findByQR()`, `search()`, `findBelowMinStock()`
- `IMovimientoRepository` — solo `register()` y `findByProducto()` (los movimientos no se editan)
- `IVentaRepository` — anula `update()` y `delete()` con `never` porque las ventas son inmutables

### D — Dependency Inversion
Los servicios nunca importan repositorios concretos. Reciben interfaces:

```typescript
// ProductoService recibe IProductoRepository — no ProductoRepository
constructor(
  private readonly productos:   IProductoRepository,   // interfaz
  private readonly movimientos: IMovimientoRepository  // interfaz
) {}
```

El único lugar que instancia clases concretas es `registry.ts` (Composition Root).

---

## Flujo de datos completo

```
Usuario hace click "Guardar producto"
        │
        ▼
[Renderer] useMutation('productos:create')
        │  llama a ipcInvoke()
        ▼
[lib/ipc.ts] window.electronAPI.invoke('productos:create', data)
        │
        ▼
[Preload] valida canal contra whitelist → ipcRenderer.invoke()
        │
        ▼
[IPC Helper] safeHandler() envuelve en try/catch
        │
        ▼
[productos.handler.ts] recibe args → llama service.crear(data)
        │
        ▼
[ProductoService] valida QR único, valida precio_costo ≤ precio
        │  llama productoRepo.create()
        ▼
[ProductoRepository] ejecuta INSERT INTO productos...
        │  retorna Producto insertado
        ▼
[ProductoService] si stock > 0, registra movimiento de entrada
        │  retorna Producto
        ▼
[IPC Helper] ok(producto) → { success: true, data: producto }
        │
        ▼
[Renderer] useMutation recibe data → llama onSuccess() → refetch()
```

---

## Para agregar un nuevo dominio (ej: Compras a proveedores)

1. **Entidad** en `packages/shared/src/entities/Compra.ts`
2. **Canales IPC** en `packages/shared/src/ipc/channels.ts`
3. **Interfaz** en `apps/electron/src/main/repositories/interfaces/ICompraRepository.ts`
4. **Repositorio** en `apps/electron/src/main/repositories/CompraRepository.ts`
5. **Servicio** en `apps/electron/src/main/services/CompraService.ts`
6. **Handler** en `apps/electron/src/main/ipc/handlers/compras.handler.ts`
7. **Registrar** en `apps/electron/src/main/ipc/registry.ts` (una función + tres líneas)
8. **Whitelist** en `apps/electron/src/preload/index.ts`

---

## Inicio rápido

```bash
# Prerequisitos: Node.js ≥ 20 LTS, compilador C++ (para better-sqlite3)
# macOS:   xcode-select --install
# Windows: npm install -g windows-build-tools
# Linux:   sudo apt install build-essential

# Instalar todas las dependencias del monorepo
npm install

# Modo desarrollo (Vite HMR + Electron en paralelo)
npm run dev

# Verificar tipos en los 3 tsconfig sin compilar
npm run typecheck

# Build de producción + instalador .exe / .dmg / .AppImage
npm run dist
```

---

## Decisiones de diseño importantes

**Precios en centavos.** `precio: 1250` = $12.50. Nunca `12.50`. Evita
todos los problemas de punto flotante en sumas del carrito.

**Soft delete en productos.** `activo = 0` en vez de `DELETE`. Así el
historial de ventas siempre puede mostrar el nombre del producto aunque
ya no esté en el catálogo.

**Ventas inmutables.** No hay `UPDATE ventas`. Si el cajero se equivoca,
cancela y rehace. `VentaRepository.update()` lanza `never`. Esto garantiza
que los reportes históricos siempre sean precisos.

**Movimientos de inventario append-only.** Son el libro contable del negocio.
`IMovimientoRepository` no tiene `update()` ni `delete()`.

**Transacciones en el servicio, no en el repositorio.** `VentaService.crear()`
envuelve en `db.transaction()` porque necesita coordinar múltiples repositorios
a la vez. Los repositorios individuales no saben que están en una transacción.
#   M i n i m a r k e t  
 #   P O S - M I N I M A R K E T - R E L A S E S  
 #   P O S - M I N I M A R K E T - R E L A S E S  
 