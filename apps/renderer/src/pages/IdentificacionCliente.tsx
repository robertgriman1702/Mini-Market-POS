import { useState, useRef, useCallback, useEffect } from 'react';
import { ipcInvoke }                                 from '@/lib/ipc';
import { useMutation }                               from '@/hooks';
import type { Cliente, ClienteInput }                from '@pos/shared';

// =============================================================================
// IdentificacionCliente — Paso obligatorio antes de abrir el POS
//
// No existe cliente genérico ni por defecto: esta pantalla bloquea el
// acceso al POS hasta que se confirme un cliente existente o se registre
// uno nuevo. Reutiliza los mismos canales IPC que ClienteSelector
// (clientes:buscarPorCedula / clientes:registrar) pero en un layout de
// pantalla completa, ya que aquí la selección es obligatoria y no se
// puede deseleccionar ni omitir.
// =============================================================================

interface Props {
  onConfirmar: (cliente: Cliente) => void;
  onCancelar:  () => void;
}

type Step = 'buscar' | 'encontrado' | 'no_encontrado';

export function IdentificacionCliente({ onConfirmar, onCancelar }: Props) {
  const [step,      setStep]      = useState<Step>('buscar');
  const [cedula,    setCedula]    = useState('');
  const [encontrado, setEncontrado] = useState<Cliente | null>(null);
  const [form,      setForm]      = useState<Partial<ClienteInput>>({});
  const [error,     setError]     = useState('');
  const [buscando,  setBuscando]  = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const { mutate: registrar, isLoading: registrando } = useMutation('clientes:registrar', {
    onSuccess: (c) => { if (c) onConfirmar(c); },
    onError:   (e) => setError(e),
  });

  const buscar = useCallback(async (val: string) => {
    const ci = val.replace(/[^0-9]/g, '');
    if (ci.length < 6) { setError('La cédula debe tener al menos 6 dígitos.'); return; }
    setError('');
    setBuscando(true);
    try {
      const found = await ipcInvoke('clientes:buscarPorCedula', ci);
      if (found) {
        setEncontrado(found);
        setStep('encontrado');
      } else {
        setForm({ cedula: ci });
        setStep('no_encontrado');
      }
    } catch {
      setError('Error al buscar el cliente.');
    } finally {
      setBuscando(false);
    }
  }, []);

  const volver = () => {
    setStep('buscar');
    setCedula('');
    setEncontrado(null);
    setForm({});
    setError('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleRegistrar = () => {
    if (!form.cedula || !form.nombre || !form.apellido) {
      setError('Nombre y apellido son obligatorios.');
      return;
    }
    registrar({
      cedula:   form.cedula,
      nombre:   form.nombre,
      apellido: form.apellido,
      telefono: form.telefono ?? null,
    });
  };

  return (
    <div
      className="flex flex-col items-center justify-center h-full animate-fade-in"
      style={{ background: 'var(--bg-base)' }}
    >
      <div
        className="w-full flex flex-col"
        style={{
          maxWidth:     '420px',
          background:   'var(--bg-surface)',
          border:       '1px solid var(--border-base)',
          borderRadius: '8px',
          boxShadow:    'var(--shadow-modal)',
          overflow:     'hidden',
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-5 flex items-center justify-between"
          style={{ background: 'var(--blue-light)', borderBottom: '1px solid var(--blue-border)' }}
        >
          <div className="flex items-center gap-3">
            <span style={{ fontSize: '1.4rem' }}>👤</span>
            <div>
              <h1 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                Identificar Cliente
              </h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Obligatorio para iniciar una venta
              </p>
            </div>
          </div>
          <button
            onClick={onCancelar}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '20px', lineHeight: 1 }}
            title="Cancelar y volver"
          >
            ×
          </button>
        </div>

        {/* Step: buscar */}
        {step === 'buscar' && (
          <div className="p-6 flex flex-col gap-4 animate-fade-in">
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Ingresa la cédula o documento de identidad del cliente.
            </p>
            <div>
              <label className="stat-label" style={{ display: 'block', marginBottom: '5px' }}>
                Cédula / Documento *
              </label>
              <input
                ref={inputRef}
                className="input-base font-mono"
                style={{ fontSize: '15px' }}
                placeholder="Ej: 12345678"
                value={cedula}
                onChange={(e) => setCedula(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && buscar(cedula)}
                maxLength={10}
                data-selectable
              />
            </div>
            {error && (
              <p className="text-xs animate-fade-in" style={{ color: 'var(--danger)' }}>
                ✕ {error}
              </p>
            )}
            <button
              className="btn-primary"
              disabled={buscando || cedula.trim().length < 6}
              onClick={() => buscar(cedula)}
            >
              {buscando ? 'Buscando...' : 'Buscar Cliente'}
            </button>
          </div>
        )}

        {/* Step: encontrado */}
        {step === 'encontrado' && encontrado && (
          <div className="p-6 flex flex-col gap-4 animate-fade-in">
            <div
              className="p-4 rounded-lg"
              style={{ background: 'var(--green-light)', border: '1px solid var(--green-border)' }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--green)' }}>
                Cliente encontrado
              </p>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {encontrado.nombre} {encontrado.apellido}
              </p>
              <p className="font-mono text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                CI: {encontrado.cedula}
                {encontrado.telefono && ` · ${encontrado.telefono}`}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={volver}>
                Buscar otro
              </button>
              <button className="btn-primary flex-1" onClick={() => onConfirmar(encontrado)}>
                Confirmar y continuar
              </button>
            </div>
          </div>
        )}

        {/* Step: no_encontrado */}
        {step === 'no_encontrado' && (
          <div className="p-6 flex flex-col gap-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                Cliente nuevo — Registrar
              </p>
              <span
                style={{
                  background: 'var(--blue-light)', color: 'var(--blue)', border: '1px solid var(--blue-border)',
                  fontSize: '10px', padding: '2px 8px', borderRadius: '999px',
                }}
              >
                CI: {form.cedula}
              </span>
            </div>

            <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div>
                <label className="stat-label" style={{ display: 'block', marginBottom: '3px' }}>Nombre *</label>
                <input
                  className="input-base text-sm"
                  placeholder="Juan"
                  value={form.nombre ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleRegistrar()}
                  autoFocus
                  data-selectable
                />
              </div>
              <div>
                <label className="stat-label" style={{ display: 'block', marginBottom: '3px' }}>Apellido *</label>
                <input
                  className="input-base text-sm"
                  placeholder="Pérez"
                  value={form.apellido ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, apellido: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleRegistrar()}
                  data-selectable
                />
              </div>
            </div>

            <div>
              <label className="stat-label" style={{ display: 'block', marginBottom: '3px' }}>
                Teléfono <span style={{ color: 'var(--text-muted)' }}>(opcional)</span>
              </label>
              <input
                className="input-base text-sm font-mono"
                placeholder="0414-1234567"
                value={form.telefono ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleRegistrar()}
                data-selectable
              />
            </div>

            {error && (
              <p className="text-xs mt-1 animate-fade-in" style={{ color: 'var(--danger)' }}>
                ✕ {error}
              </p>
            )}

            <div className="flex gap-2 mt-1">
              <button className="btn-ghost flex-1" onClick={volver} disabled={registrando}>
                Volver
              </button>
              <button
                className="btn-primary flex-1"
                onClick={handleRegistrar}
                disabled={registrando || !form.nombre || !form.apellido}
              >
                {registrando ? 'Guardando...' : 'Registrar y continuar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}