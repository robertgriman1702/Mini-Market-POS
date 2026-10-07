import { useState, useDeferredValue, useEffect } from 'react';
import { useQuery, useMutation, useBcv }         from '@/hooks';
import { ipcInvoke }                             from '@/lib/ipc';
import type { Producto, AppConfig,
              ProductoInput, CatalogoProducto }  from '@pos/shared';

interface Props { config: AppConfig }

interface EditState {
  id:      number;
  field:   'stock' | 'precio';
  value:   string;
}

export function Inventory({ config }: Props) {
  const [search,   setSearch]   = useState('');
  const { toBS } = useBcv();
  const [edit,     setEdit]     = useState<EditState | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showAdd,  setShowAdd]  = useState(false);
  const [version,  setVersion]  = useState(0);

  const deferred = useDeferredValue(search);
  const doSearch = deferred.trim().length >= 2;

  const { data: todos,      refetch }       = useQuery('productos:getAll');
  const { data: resultados, refetch: refetchSearch } =
    useQuery('productos:buscar', deferred);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refetch(); }, [version]);

  const productos = doSearch ? (resultados ?? []) : (todos ?? []);

  const showFeedback = (msg: string, ok = true) => {
    setFeedback({ msg, ok });
    setTimeout(() => setFeedback(null), 2500);
  };

  const { mutate: crearProducto, isLoading: creating } =
    useMutation('productos:create', {
      onSuccess: () => {
        setVersion((v) => v + 1);
        if (doSearch) refetchSearch();
        setShowAdd(false);
        showFeedback('Producto agregado al inventario ✓');
      },
      onError: (e) => showFeedback(e, false),
    });

  const startEdit = (id: number, field: 'stock' | 'precio', current: number) => {
    const display = field === 'precio'
      ? (current / 100).toFixed(2)
      : String(current);
    setEdit({ id, field, value: display });
  };

  const commitEdit = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      const numVal = parseFloat(edit.value);
      if (isNaN(numVal) || numVal < 0) { setEdit(null); return; }

      const update = edit.field === 'precio'
        ? { id: edit.id, precio: Math.round(numVal * 100) }
        : { id: edit.id, stock: Math.floor(numVal) };

      await ipcInvoke('productos:update', update);
      refetch();
      if (doSearch) refetchSearch();
      showFeedback('Guardado');
    } catch (err) {
      showFeedback((err as Error).message, false);
    } finally {
      setSaving(false);
      setEdit(null);
    }
  };

  const handleEditKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter')  commitEdit();
    if (e.key === 'Escape') setEdit(null);
  };

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <span className="page-title">Inventario</span>
          {feedback && (
            <span className={`badge animate-fade-in ${feedback.ok ? 'badge-green' : 'badge-red'}`}>
              {feedback.msg}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            className="input-base text-xs"
            style={{ width: '220px' }}
            placeholder="Buscar nombre o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-selectable
          />
          <button className="btn-ghost text-xs" onClick={() => { refetch(); setSearch(''); }}>
            Actualizar
          </button>
          <button className="btn-primary btn-auto text-xs" onClick={() => setShowAdd(true)}>
            + Agregar producto
          </button>
        </div>
      </div>

      {/* Table header */}
      <div className="table-header"
        style={{ gridTemplateColumns: '140px 1fr 110px 110px 80px 90px 80px' }}>
        <span>Código</span>
        <span>Producto</span>
        <span className="text-right">Precio USD</span>
        <span className="text-right">Precio Bs</span>
        <span className="text-right">Stock</span>
        <span className="text-right">Mín.</span>
        <span>Estado</span>
      </div>

      {/* Table body */}
      <div className="flex-1 overflow-y-auto">
        {productos.length === 0 ? (
          <div className="empty-state">
            <p>{doSearch ? 'Sin resultados para esa búsqueda' : 'Sin productos en el inventario'}</p>
            {!doSearch && (
              <button className="btn-primary btn-auto text-xs" onClick={() => setShowAdd(true)}>
                Agregar primer producto
              </button>
            )}
          </div>
        ) : (
          productos.map((p) => (
            <ProductRow
              key={p.id}
              producto={p}
              edit={edit}
              saving={saving}
              config={config}
              toBS={toBS}
              onStartEdit={startEdit}
              onEditChange={(v) => setEdit((e) => e ? { ...e, value: v } : null)}
              onEditKey={handleEditKey}
              onCommit={commitEdit}
            />
          ))
        )}
      </div>

      {/* Contador */}
      <div className="px-5 py-2 flex-shrink-0 text-xs"
        style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-dim)' }}>
        {productos.length} producto{productos.length !== 1 ? 's' : ''}
        {doSearch ? ` encontrado${productos.length !== 1 ? 's' : ''}` : ' en inventario'}
      </div>

      {showAdd && (
        <AddProductModal
          moneda={config.moneda}
          onClose={() => setShowAdd(false)}
          onSave={(data) => crearProducto(data)}
          saving={creating}
        />
      )}
    </div>
  );
}

// =============================================================================
// ProductRow
// =============================================================================

interface RowProps {
  producto:     Producto;
  edit:         EditState | null;
  saving:       boolean;
  config:       AppConfig;
  toBS:         (c: number) => string;
  onStartEdit:  (id: number, field: 'stock' | 'precio', current: number) => void;
  onEditChange: (v: string) => void;
  onEditKey:    (e: React.KeyboardEvent) => void;
  onCommit:     () => void;
}

function ProductRow({ producto: p, edit, saving, config,
  toBS, onStartEdit, onEditChange, onEditKey, onCommit }: RowProps) {

  const stockBajo       = p.stock <= p.stock_minimo;
  const isEditingStock  = edit?.id === p.id && edit.field === 'stock';
  const isEditingPrecio = edit?.id === p.id && edit.field === 'precio';

  return (
    <div
      className="table-row"
      style={{ gridTemplateColumns: '140px 1fr 110px 110px 80px 90px 80px', display: 'grid' }}
    >
      <span className="font-mono text-xs truncate" style={{ color: 'var(--text-muted)' }}>
        {p.codigo_qr}
      </span>

      <div className="flex flex-col pr-3 min-w-0">
        <span className="text-sm truncate font-medium">{p.nombre}</span>
        {p.categoria_id && (
          <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
            cat. {p.categoria_id}
          </span>
        )}
      </div>

      <div className="flex justify-end items-center">
        {isEditingPrecio ? (
          <input
            className="input-base text-right font-mono text-xs"
            style={{ width: '80px', padding: '4px 8px' }}
            value={edit!.value}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={onEditKey}
            onBlur={onCommit}
            disabled={saving}
            autoFocus
            data-selectable
          />
        ) : (
          <button
            className="cell-edit-btn"
            style={{ color: 'var(--text-secondary)' }}
            onClick={() => onStartEdit(p.id, 'precio', p.precio)}
            title="Click para editar precio"
          >
            {config.moneda}{(p.precio / 100).toFixed(2)}
          </button>
        )}
      </div>

      <span className="font-mono text-xs text-right px-1" style={{ color: 'var(--warn)' }}>
        {toBS(p.precio) || '—'}
      </span>

      <div className="flex justify-end items-center">
        {isEditingStock ? (
          <input
            className="input-base text-right font-mono text-xs"
            style={{ width: '60px', padding: '4px 8px' }}
            value={edit!.value}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={onEditKey}
            onBlur={onCommit}
            disabled={saving}
            autoFocus
            data-selectable
          />
        ) : (
          <button
            className="cell-edit-btn"
            style={{
              color:      stockBajo ? 'var(--danger)' : 'var(--text-secondary)',
              fontWeight: stockBajo ? 700 : 400,
            }}
            onClick={() => onStartEdit(p.id, 'stock', p.stock)}
            title="Click para editar stock"
          >
            {p.stock}
          </button>
        )}
      </div>

      <span className="text-right text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
        {p.stock_minimo}
      </span>

      <div className="flex justify-center items-center">
        {stockBajo
          ? <span className="badge badge-red">Bajo</span>
          : <span className="badge badge-green">OK</span>
        }
      </div>
    </div>
  );
}

// =============================================================================
// AddProductModal
// =============================================================================

interface ModalProps {
  moneda:  string;
  onClose: () => void;
  onSave:  (data: ProductoInput) => void;
  saving:  boolean;
}

function AddProductModal({ moneda, onClose, onSave, saving }: ModalProps) {
  const [form, setForm] = useState<ProductoInput>({
    nombre:        '',
    codigo_qr:     '',
    precio:        0,
    precio_costo:  0,
    stock:         0,
    stock_minimo:  5,
    categoria_id:  null,
    proveedor_id:  null,
    unidad_medida: 'unidad',
    activo:        true,
  });

  const [searching,     setSearching]     = useState(false);
  const [catalogResult, setCatalogResult] = useState<CatalogoProducto | null>(null);
  const [catalogStatus, setCatalogStatus] = useState<'idle'|'found'|'not_found'>('idle');
  const [categoriaSug,  setCategoriaSug]  = useState<string | null>(null);
  const [errors,        setErrors]        = useState<Partial<Record<keyof ProductoInput, string>>>({});

  const set = <K extends keyof ProductoInput>(field: K, value: ProductoInput[K]) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleCodigoSearch = async (codigo: string) => {
    if (!codigo.trim() || codigo.trim().length < 4) return;
    setSearching(true);
    setCatalogStatus('idle');
    setCatalogResult(null);
    try {
      const result = await ipcInvoke('catalogo:buscarPorCodigo', codigo.trim());
      if (result) {
        setCatalogResult(result);
        setCatalogStatus('found');
        setForm((f) => ({
          ...f,
          nombre:        result.nombre,
          unidad_medida: result.unidad_medida as ProductoInput['unidad_medida'],
        }));
      } else {
        setCatalogStatus('not_found');
      }
    } catch {
      setCatalogStatus('not_found');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (!form.nombre.trim() || catalogResult) return;
    const timer = setTimeout(async () => {
      try {
        const sug = await ipcInvoke('catalogo:sugerirCategoria', form.nombre);
        setCategoriaSug(sug ?? null);
      } catch { /* silent */ }
    }, 400);
    return () => clearTimeout(timer);
  }, [form.nombre, catalogResult]);

  const validate = (): boolean => {
    const e: typeof errors = {};
    if (!form.nombre.trim())    e.nombre    = 'El nombre es obligatorio';
    if (!form.codigo_qr.trim()) e.codigo_qr = 'El código es obligatorio';
    if (form.precio <= 0)       e.precio    = 'El precio debe ser mayor a 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate() || saving) return;
    onSave(form);
  };

  return (
    <div
      className="modal-overlay animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-card flex flex-col" style={{ width: '480px', maxHeight: '90vh', overflow: 'auto' }}>

        <div className="modal-header">
          <h2 className="page-title">Agregar Producto</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: '20px', lineHeight: 1 }}
          >×</button>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5">

          <div>
            <label className="field-label">Código de barras / QR *</label>
            <div style={{ position: 'relative' }}>
              <input
                className={`input-base font-mono text-xs ${errors.codigo_qr ? 'input-error' : ''}`}
                placeholder="Escanea o escribe el código"
                value={form.codigo_qr}
                onChange={(e) => { set('codigo_qr', e.target.value); setErrors((err) => ({ ...err, codigo_qr: undefined })); }}
                onBlur={(e) => handleCodigoSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCodigoSearch(form.codigo_qr)}
                autoFocus
                data-selectable
              />
              {searching && (
                <span style={{ position: 'absolute', right: '10px', top: '50%',
                  transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Buscando...
                </span>
              )}
            </div>
            {errors.codigo_qr && <p className="field-error">{errors.codigo_qr}</p>}
            {catalogStatus === 'found' && catalogResult && (
              <div className="animate-fade-in mt-2 px-3 py-2 rounded-xl"
                style={{ background: 'var(--green-light)', border: '1px solid var(--green-border)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--green)' }}>
                  ✓ Encontrado en el catálogo
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {catalogResult.nombre}
                  {catalogResult.marca ? ` · ${catalogResult.marca}` : ''}
                  {catalogResult.categoria ? ` · ${catalogResult.categoria}` : ''}
                </p>
              </div>
            )}
            {catalogStatus === 'not_found' && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Código no registrado. Completa los datos manualmente.
              </p>
            )}
          </div>

          <div>
            <label className="field-label">Nombre del producto *</label>
            <input
              className={`input-base ${errors.nombre ? 'input-error' : ''}`}
              placeholder="Ej: Nivea Men Desodorante Black & White 150ml"
              value={form.nombre}
              onChange={(e) => { set('nombre', e.target.value); setErrors((err) => ({ ...err, nombre: undefined })); }}
              data-selectable
            />
            {errors.nombre && <p className="field-error">{errors.nombre}</p>}
            {categoriaSug && !catalogResult && (
              <p className="text-xs mt-1 animate-fade-in" style={{ color: 'var(--blue)' }}>
                💡 Sugerencia de categoría: <strong>{categoriaSug}</strong>
              </p>
            )}
          </div>

          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <label className="field-label">Precio venta ({moneda}) *</label>
              <input
                className={`input-base font-mono text-xs ${errors.precio ? 'input-error' : ''}`}
                type="number" min="0" step="0.01" placeholder="0.00"
                value={form.precio > 0 ? (form.precio / 100).toFixed(2) : ''}
                onChange={(e) => {
                  set('precio', Math.round(parseFloat(e.target.value || '0') * 100));
                  setErrors((err) => ({ ...err, precio: undefined }));
                }}
                data-selectable
              />
              {errors.precio && <p className="field-error">{errors.precio}</p>}
            </div>
            <div>
              <label className="field-label">Precio costo ({moneda})</label>
              <input
                className="input-base font-mono text-xs"
                type="number" min="0" step="0.01" placeholder="0.00"
                value={form.precio_costo > 0 ? (form.precio_costo / 100).toFixed(2) : ''}
                onChange={(e) =>
                  set('precio_costo', Math.round(parseFloat(e.target.value || '0') * 100))
                }
                data-selectable
              />
            </div>
          </div>

          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <label className="field-label">Stock inicial</label>
              <input
                className="input-base font-mono text-xs"
                type="number" min="0" placeholder="0"
                value={form.stock || ''}
                onChange={(e) => set('stock', parseInt(e.target.value || '0', 10))}
                data-selectable
              />
            </div>
            <div>
              <label className="field-label">Stock mínimo (alerta)</label>
              <input
                className="input-base font-mono text-xs"
                type="number" min="0" placeholder="5"
                value={form.stock_minimo || ''}
                onChange={(e) => set('stock_minimo', parseInt(e.target.value || '5', 10))}
                data-selectable
              />
            </div>
          </div>

          <div>
            <label className="field-label">Unidad de medida</label>
            <select
              className="input-base"
              style={{ cursor: 'pointer' }}
              value={form.unidad_medida}
              onChange={(e) => set('unidad_medida', e.target.value as ProductoInput['unidad_medida'])}
            >
              <option value="unidad">Unidad</option>
              <option value="kg">Kilogramo (kg)</option>
              <option value="gramo">Gramo</option>
              <option value="litro">Litro</option>
              <option value="ml">Mililitro (ml)</option>
              <option value="caja">Caja</option>
              <option value="paquete">Paquete</option>
            </select>
          </div>

          {form.precio > 0 && form.precio_costo > 0 && (
            <div className="animate-fade-in px-3 py-2 rounded-xl text-xs font-mono"
              style={{ background: 'var(--blue-light)', border: '1px solid var(--blue-border)', color: 'var(--blue)' }}>
              Margen: {moneda}{((form.precio - form.precio_costo) / 100).toFixed(2)}
              {' '}({Math.round((form.precio - form.precio_costo) / form.precio * 100)}%)
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-ghost flex-1 text-xs" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            className="btn-primary flex-1 text-xs"
            style={{ width: 'auto' }}
            onClick={handleSubmit}
            disabled={saving || !form.nombre || !form.codigo_qr}
          >
            {saving ? 'Guardando...' : 'Guardar en inventario'}
          </button>
        </div>
      </div>
    </div>
  );
}