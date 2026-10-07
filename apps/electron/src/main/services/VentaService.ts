import type Database from 'better-sqlite3';
import type { Venta, VentaConItems, NuevaVentaPayload } from '@pos/shared';
import type { IVentaRepository }      from '../repositories/interfaces/IVentaRepository';
import type { IProductoRepository }   from '../repositories/interfaces/IProductoRepository';
import type { IMovimientoRepository } from '../repositories/interfaces/IMovimientoRepository';
import { BrowserWindow }              from 'electron';

// =============================================================================
// VentaService — lógica de negocio del punto de venta
//
// Orquesta la creación de una venta de forma transaccional:
//   1. Valida stock para cada item
//   2. Crea la cabecera de la venta
//   3. Inserta cada item
//   4. Descuenta el stock de cada producto
//   5. Registra el movimiento de auditoría
//   6. Emite alertas de stock bajo si corresponde
//
// Si cualquier paso falla, la transacción hace rollback completo.
// =============================================================================

export class VentaService {
  constructor(
    private readonly db:           Database.Database,
    private readonly ventas:       IVentaRepository,
    private readonly productos:    IProductoRepository,
    private readonly movimientos:  IMovimientoRepository
  ) {}

  // ---------------------------------------------------------------------------
  // Consultas
  // ---------------------------------------------------------------------------

  getById(id: number): VentaConItems {
    const venta = this.ventas.findByIdWithItems(id);
    if (!venta) throw new Error(`Venta con id ${id} no encontrada.`);
    return venta;
  }

  getRecientes(limite: number): Venta[] {
    return this.ventas.findRecent(limite);
  }

  // ---------------------------------------------------------------------------
  // Crear venta — operación principal del POS
  // ---------------------------------------------------------------------------

  crear(payload: NuevaVentaPayload): VentaConItems {
    // Ejecutar TODO dentro de una transacción atómica de SQLite
    const ejecutar = this.db.transaction((): VentaConItems => {

      // --- 1. Validar que todos los items tengan stock suficiente ---
      for (const item of payload.items) {
        const producto = this.productos.findById(item.producto_id);
        if (!producto) {
          throw new Error(`Producto con id ${item.producto_id} no encontrado.`);
        }
        if (producto.stock < item.cantidad) {
          throw new Error(
            `Stock insuficiente para "${producto.nombre}". ` +
            `Disponible: ${producto.stock}, solicitado: ${item.cantidad}.`
          );
        }
      }

      // --- 2. Calcular total ---
      const subtotal = payload.items.reduce(
        (sum, item) => sum + item.cantidad * item.precio_unitario, 0
      );
      const total = subtotal - (payload.descuento ?? 0);
      if (total < 0) throw new Error('El descuento no puede superar el total.');

      // --- 3. Insertar cabecera de venta ---
      const venta = this.ventas.create({
        total,
        descuento:   payload.descuento ?? 0,
        metodo_pago: payload.metodo_pago,
        cajero_id:   null,
        cliente_id:  payload.cliente_id ?? null,
        items:       payload.items,
      });

      // --- 4. Por cada item: insertar, descontar stock, registrar movimiento ---
      const productosConStockBajo: number[] = [];

      for (const item of payload.items) {
        const producto = this.productos.findById(item.producto_id)!;

        // Insertar item de venta
        this.ventas.insertItem(venta.id, item);

        // Descontar stock
        const stockNuevo = producto.stock - item.cantidad;
        this.productos.updateStock(producto.id, stockNuevo);

        // Registrar movimiento de auditoría
        this.movimientos.register({
          producto_id:    producto.id,
          tipo:           'venta',
          cantidad:       -item.cantidad,
          stock_anterior: producto.stock,
          stock_nuevo:    stockNuevo,
          referencia_id:  venta.id,
        });

        // Marcar para alerta si quedó en mínimo
        if (stockNuevo <= producto.stock_minimo) {
          productosConStockBajo.push(producto.id);
        }
      }

      // Emitir alertas FUERA del loop de items para no interrumpir la transacción
      for (const prodId of productosConStockBajo) {
        const p = this.productos.findById(prodId);
        if (p) this.emitirAlertaStockBajo(p);
      }

      return this.ventas.findByIdWithItems(venta.id)!;
    });

    return ejecutar();
  }

  // ---------------------------------------------------------------------------
  // Cancelar venta — restaura el stock
  // ---------------------------------------------------------------------------

  cancelar(id: number): boolean {
    const venta = this.ventas.findByIdWithItems(id);
    if (!venta) throw new Error(`Venta con id ${id} no encontrada.`);
    if (venta.estado === 'cancelada') throw new Error('La venta ya está cancelada.');

    const ejecutar = this.db.transaction(() => {
      // Restaurar stock de cada item
      for (const item of venta.items) {
        const producto = this.productos.findById(item.producto_id);
        if (!producto) continue;

        const stockRestaurado = producto.stock + item.cantidad;
        this.productos.updateStock(producto.id, stockRestaurado);

        this.movimientos.register({
          producto_id:    producto.id,
          tipo:           'ajuste',
          cantidad:       item.cantidad,
          stock_anterior: producto.stock,
          stock_nuevo:    stockRestaurado,
          motivo:         `Cancelación de venta #${id}`,
          referencia_id:  id,
        });
      }

      return this.ventas.cancel(id);
    });

    return ejecutar();
  }

  // ---------------------------------------------------------------------------
  // Privados
  // ---------------------------------------------------------------------------

  private emitirAlertaStockBajo(
    producto: import('@pos/shared').Producto
  ): void {
    BrowserWindow.getAllWindows().forEach((w) =>
      w.webContents.send('stock:alerta-minimo', producto)
    );
  }
}