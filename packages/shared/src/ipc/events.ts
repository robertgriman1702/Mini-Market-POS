import type { Producto } from '../entities/Producto';

// =============================================================================
// IPCEvents — Eventos unidireccionales Main → Renderer
// =============================================================================

export interface IPCEvents {
  'stock:alerta-minimo': Producto;
  'db:error':            { message: string; code?: string };
  'app:version':         string;
  'updater:available':   { version: string; notes: string };
  'updater:progress':    number;
  'updater:ready':       string;
  'bcv:tasa':            { tasa: number; actualizadoEl: string };
}