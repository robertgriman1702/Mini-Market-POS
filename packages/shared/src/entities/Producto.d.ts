export type UnidadMedida = 'unidad' | 'kg' | 'gramo' | 'litro' | 'ml' | 'caja' | 'paquete';
export interface Producto {
    id: number;
    nombre: string;
    codigo_qr: string;
    precio: number;
    precio_costo: number;
    stock: number;
    stock_minimo: number;
    categoria_id: number | null;
    proveedor_id: number | null;
    unidad_medida: UnidadMedida;
    activo: boolean;
    created_at: string;
    updated_at: string;
}
export type ProductoInput = Omit<Producto, 'id' | 'created_at' | 'updated_at'>;
export type ProductoUpdate = Partial<ProductoInput> & {
    id: number;
};
//# sourceMappingURL=Producto.d.ts.map