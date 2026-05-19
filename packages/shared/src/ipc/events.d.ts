import type { Producto } from '../entities/Producto';
export interface IPCEvents {
    'stock:alerta-minimo': Producto;
    'db:error': {
        message: string;
        code?: string;
    };
    'app:version': string;
}
//# sourceMappingURL=events.d.ts.map