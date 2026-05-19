import { execSync }    from 'child_process';
import fs              from 'fs';
import path            from 'path';
import os              from 'os';
import type { VentaConItems } from '@pos/shared';
import type { AppConfig }     from '@pos/shared';

// =============================================================================
// PrinterService — Impresión de tickets ESC/POS
//
// Modo genérico:  genera comandos ESC/POS estándar y los envía a la impresora
//                 vía puerto serial/USB usando el método nativo del OS.
//
// Modo fiscal:    genera el texto del ticket para enviarse a una impresora
//                 fiscal compatible (stub extensible por modelo).
//
// Sin dependencias externas: usa buffers crudos de ESC/POS.
// =============================================================================

// --- Constantes ESC/POS ---
const ESC  = 0x1b;
const GS   = 0x1d;
const LF   = 0x0a;
const INIT = Buffer.from([ESC, 0x40]);
const BOLD_ON    = Buffer.from([ESC, 0x45, 0x01]);
const BOLD_OFF   = Buffer.from([ESC, 0x45, 0x00]);
const ALIGN_LEFT  = Buffer.from([ESC, 0x61, 0x00]);
const ALIGN_CENTER = Buffer.from([ESC, 0x61, 0x01]);
const ALIGN_RIGHT  = Buffer.from([ESC, 0x61, 0x02]);
const CUT         = Buffer.from([GS, 0x56, 0x41, 0x10]);  // Corte parcial
const LINE        = (n = 1) => Buffer.from(Array(n).fill(LF));
const TEXT        = (s: string) => Buffer.from(s, 'latin1');
const SEP         = () => TEXT('-'.repeat(42) + '\n');

// Helpers
const fmt$ = (centavos: number, moneda: string) =>
  `${moneda}${(centavos / 100).toFixed(2)}`;

const padBoth = (left: string, right: string, width = 42) => {
  const pad = width - left.length - right.length;
  return left + ' '.repeat(Math.max(pad, 1)) + right + '\n';
};

export class PrinterService {
  constructor(private readonly config: AppConfig) {}

  // ---------------------------------------------------------------------------
  // Punto de entrada principal
  // ---------------------------------------------------------------------------

  async printTicket(venta: VentaConItems): Promise<boolean> {
    try {
      const buffer =
        this.config.impresora_modo === 'fiscal'
          ? this.buildFiscal(venta)
          : this.buildGeneric(venta);

      return await this.send(buffer);
    } catch (err) {
      console.error('[Printer] Error al imprimir:', err);
      return false;
    }
  }

  async printTest(): Promise<boolean> {
    const buffer = Buffer.concat([
      INIT,
      ALIGN_CENTER,
      BOLD_ON,
      TEXT('*** TEST DE IMPRESORA ***\n'),
      BOLD_OFF,
      TEXT(`POS MiniMarket\n`),
      TEXT(new Date().toLocaleString('es') + '\n'),
      LINE(2),
      CUT,
    ]);
    return this.send(buffer);
  }

  // ---------------------------------------------------------------------------
  // Builder: Modo Genérico ESC/POS
  // ---------------------------------------------------------------------------

  private buildGeneric(venta: VentaConItems): Buffer {
    const { moneda, local_nombre, local_rif, local_direccion, local_telefono } = this.config;
    const partes: Buffer[] = [
      INIT,
      ALIGN_CENTER,
      BOLD_ON,
      TEXT(local_nombre.toUpperCase() + '\n'),
      BOLD_OFF,
      TEXT(`RIF: ${local_rif}\n`),
      TEXT(local_direccion + '\n'),
      TEXT(local_telefono + '\n'),
      LINE(),
      SEP(),
      ALIGN_LEFT,
      TEXT(`Ticket #${String(venta.id).padStart(6, '0')}\n`),
      TEXT(`Fecha : ${new Date(venta.created_at).toLocaleString('es')}\n`),
      TEXT(`Método: ${venta.metodo_pago.toUpperCase()}\n`),
      SEP(),
    ];

    // Items
    for (const item of venta.items) {
      const nombre = item.producto_id.toString(); // En producción: join con nombre
      partes.push(TEXT(`${item.cantidad}x ${nombre}\n`));
      partes.push(
        ALIGN_RIGHT,
        TEXT(fmt$(item.subtotal, moneda) + '\n'),
        ALIGN_LEFT
      );
    }

    partes.push(
      SEP(),
      ALIGN_RIGHT,
      TEXT(padBoth('SUBTOTAL:', fmt$(venta.total + venta.descuento, moneda))),
    );

    if (this.config.flags.iva) {
      const iva = Math.round(venta.total * this.config.iva_porcentaje / (100 + this.config.iva_porcentaje));
      partes.push(TEXT(padBoth(`IVA (${this.config.iva_porcentaje}%):`, fmt$(iva, moneda))));
    }

    if (venta.descuento > 0) {
      partes.push(TEXT(padBoth('DESCUENTO:', `-${fmt$(venta.descuento, moneda)}`)));
    }

    partes.push(
      BOLD_ON,
      TEXT(padBoth('TOTAL:', fmt$(venta.total, moneda))),
      BOLD_OFF,
      SEP(),
      ALIGN_CENTER,
      TEXT('Gracias por su compra\n'),
      LINE(3),
      CUT,
    );

    return Buffer.concat(partes);
  }

  // ---------------------------------------------------------------------------
  // Builder: Modo Fiscal (stub — adaptar por modelo de impresora)
  // ---------------------------------------------------------------------------

  private buildFiscal(venta: VentaConItems): Buffer {
    // Las impresoras fiscales aceptan comandos propietarios.
    // Este stub genera el ticket genérico mientras se implementa
    // el protocolo específico del modelo contratado.
    console.warn('[Printer] Modo fiscal: usando genérico como fallback.');
    return this.buildGeneric(venta);
  }

  // ---------------------------------------------------------------------------
  // Envío al hardware
  // ---------------------------------------------------------------------------

  private async send(buffer: Buffer): Promise<boolean> {
    const tmpFile = path.join(os.tmpdir(), `pos_ticket_${Date.now()}.bin`);
    fs.writeFileSync(tmpFile, buffer);

    try {
      if (process.platform === 'win32') {
        // En Windows: copiar el buffer directamente al puerto o a la impresora
        execSync(`copy /b "${tmpFile}" "${this.config.impresora_puerto}"`, { stdio: 'pipe' });
      } else {
        // Linux/macOS: lp o cat directo al device
        execSync(`lp -d "${this.config.impresora_puerto}" "${tmpFile}"`, { stdio: 'pipe' });
      }
      return true;
    } finally {
      fs.unlinkSync(tmpFile);
    }
  }
}
