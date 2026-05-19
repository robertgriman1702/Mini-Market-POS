import type { Producto, ProductoInput, ProductoUpdate } from '@pos/shared';
import type { IProductoRepository }   from '../repositories/interfaces/IProductoRepository';
import type { IMovimientoRepository } from '../repositories/interfaces/IMovimientoRepository';
import { BrowserWindow }              from 'electron';

// =============================================================================
// ProductoService — lógica de negocio del inventario
//
// Responsabilidad: orquestar operaciones sobre productos.
// No sabe nada de SQL ni de IPC. Recibe interfaces, no implementaciones.
// Depende de abstracciones (Dependency Inversion).
// =============================================================================

export class ProductoService {
  constructor(
    private readonly productos:    IProductoRepository,
    private readonly movimientos:  IMovimientoRepository
  ) {}

  // ---------------------------------------------------------------------------
  // Consultas (sin efecto secundario)
  // ---------------------------------------------------------------------------

  getAll(): Producto[] {
    return this.productos.findAll();
  }

  getById(id: number): Producto {
    const producto = this.productos.findById(id);
    if (!producto) throw new Error(`Producto con id ${id} no encontrado.`);
    return producto;
  }

  getByQR(codigo: string): Producto | null {
    return this.productos.findByQR(codigo);
  }

  buscar(termino: string): Producto[] {
    if (termino.trim().length < 2) return [];
    return this.productos.search(termino);
  }

  // ---------------------------------------------------------------------------
  // Comandos (con efecto secundario)
  // ---------------------------------------------------------------------------

  crear(data: ProductoInput): Producto {
    // Regla de negocio: el código QR debe ser único
    const existente = this.productos.findByQR(data.codigo_qr);
    if (existente) {
      throw new Error(`Ya existe un producto con el código QR "${data.codigo_qr}".`);
    }

    // Regla de negocio: precio de costo no puede superar precio de venta
    if (data.precio_costo > data.precio) {
      throw new Error('El precio de costo no puede ser mayor al precio de venta.');
    }

    const producto = this.productos.create(data);

    // Registrar el stock inicial como movimiento de entrada
    if (producto.stock > 0) {
      this.movimientos.register({
        producto_id:    producto.id,
        tipo:           'entrada',
        cantidad:       producto.stock,
        stock_anterior: 0,
        stock_nuevo:    producto.stock,
        motivo:         'Stock inicial',
      });
    }

    return producto;
  }

  actualizar(data: ProductoUpdate): Producto {
    this.getById(data.id); // Valida que exista

    if (data.codigo_qr) {
      const existente = this.productos.findByQR(data.codigo_qr);
      if (existente && existente.id !== data.id) {
        throw new Error(`El código QR "${data.codigo_qr}" ya está en uso.`);
      }
    }

    return this.productos.update(data);
  }

  eliminar(id: number): boolean {
    this.getById(id); // Valida que exista
    return this.productos.delete(id);
  }

  ajustarStock(id: number, delta: number, motivo: string): Producto {
    const producto = this.getById(id);

    const stockNuevo = producto.stock + delta;
    if (stockNuevo < 0) {
      throw new Error(
        `Stock insuficiente. Disponible: ${producto.stock}, solicitado: ${Math.abs(delta)}.`
      );
    }

    this.productos.updateStock(id, stockNuevo);

    this.movimientos.register({
      producto_id:    id,
      tipo:           delta > 0 ? 'entrada' : 'salida',
      cantidad:       delta,
      stock_anterior: producto.stock,
      stock_nuevo:    stockNuevo,
      motivo,
    });

    const actualizado = this.productos.findById(id)!;

    // Emitir alerta si el stock quedó en o por debajo del mínimo
    if (stockNuevo <= actualizado.stock_minimo) {
      this.emitirAlertaStockBajo(actualizado);
    }

    return actualizado;
  }

  // ---------------------------------------------------------------------------
  // Privados
  // ---------------------------------------------------------------------------

  private emitirAlertaStockBajo(producto: Producto): void {
    const ventanas = BrowserWindow.getAllWindows();
    for (const ventana of ventanas) {
      ventana.webContents.send('stock:alerta-minimo', producto);
    }
  }
}
