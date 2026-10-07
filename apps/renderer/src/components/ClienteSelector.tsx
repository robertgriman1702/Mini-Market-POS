import { useState, useRef, useCallback } from 'react';
import { ipcInvoke }                     from '@/lib/ipc';
import { useMutation }                   from '@/hooks';
import type { Cliente, ClienteInput }    from '@pos/shared';

interface Props {
  cliente:  Cliente | null;
  onSelect: (c: Cliente | null) => void;
}

type Step = 'idle' | 'searching' | 'not_found';

export function ClienteSelector({ cliente, onSelect }: Props) {
  const [step,   setStep]   = useState<Step>('idle');
  const [cedula, setCedula] = useState('');
  const [error,  setError]  = useState('');
  const [form,   setForm]   = useState<Partial<ClienteInput>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const { mutate: registrar, isLoading: registrando } = useMutation('clientes:registrar', {
    onSuccess: (c) => { if (c) { onSelect(c); reset(); } },
    onError:   (e) => setError(e),
  });

  const buscar = useCallback(async (val: string) => {
    const ci = val.replace(/[^0-9]/g, '');
    if (ci.length < 6) { setError('Mín. 6 dígitos'); return; }
    setError('');
    try {
      const found = await ipcInvoke('clientes:buscarPorCedula', ci);
      if (found) { onSelect(found); reset(); }
      else       { setStep('not_found'); setForm({ cedula: ci }); }
    } catch { setError('Error al buscar'); }
  }, [onSelect]);

  const reset = () => { setStep('idle'); setCedula(''); setForm({}); setError(''); };

  const handleRegistrar = () => {
    if (!form.cedula || !form.nombre || !form.apellido) {
      setError('Nombre y apellido son obligatorios.');
      return;
    }
    registrar({ cedula: form.cedula, nombre: form.nombre, apellido: form.apellido, telefono: form.telefono ?? null });
  };

  // ── Cliente ya seleccionado ──
  if (cliente) return (
    <div className="flex items-center justify-between px-3 py-2 animate-fade-in"
      style={{ background: 'var(--green-light)', border: '1px solid var(--green-border)', borderRadius: '6px', marginBottom: '6px' }}>
      <div className="flex items-center gap-2">
        <span style={{ fontSize: '1rem' }}>👤</span>
        <div>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            {cliente.nombre} {cliente.apellido}
          </p>
          <p className="font-mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            CI: {cliente.cedula}{cliente.telefono && ` · ${cliente.telefono}`}
          </p>
        </div>
      </div>
      <button onClick={() => onSelect(null)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px', lineHeight: 1, padding: '2px 6px' }}>
        ×
      </button>
    </div>
  );

  // ── Idle: botón para activar ──
  if (step === 'idle') return (
    <button className="w-full text-xs transition-all duration-150"
      style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border-loud)', borderRadius: '6px',
        color: 'var(--text-muted)', padding: '7px 12px', cursor: 'pointer', textAlign: 'left',
        marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}
      onClick={() => { setStep('searching'); setTimeout(() => inputRef.current?.focus(), 50); }}>
      <span>👤</span>
      <span>Agregar cliente (opcional)</span>
    </button>
  );

  // ── Buscando: input de cédula ──
  if (step === 'searching') return (
    <div className="animate-fade-in"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-base)', borderRadius: '6px', padding: '10px 12px', marginBottom: '6px' }}>
      <label className="stat-label" style={{ display: 'block', marginBottom: '6px' }}>Cédula del cliente</label>
      <div className="flex gap-2">
        <input ref={inputRef} className="input-base flex-1 font-mono" style={{ fontSize: '14px' }}
          placeholder="Ej: 12345678" value={cedula}
          onChange={(e) => setCedula(e.target.value.replace(/[^0-9]/g, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter') buscar(cedula); if (e.key === 'Escape') reset(); }}
          maxLength={10} autoFocus data-selectable />
        <button className="btn-primary" style={{ width: 'auto', padding: '0 14px', fontSize: '12px' }}
          onClick={() => buscar(cedula)}>Buscar</button>
        <button className="btn-ghost" style={{ padding: '0 10px' }} onClick={reset}>×</button>
      </div>
      {error && <p className="text-xs mt-1 animate-fade-in" style={{ color: 'var(--danger)' }}>{error}</p>}
    </div>
  );

  // ── No encontrado: formulario de registro ──
  return (
    <div className="animate-fade-in"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-base)', borderRadius: '6px', padding: '12px', marginBottom: '6px' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Cliente nuevo — Registrar</p>
        <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', border: '1px solid var(--blue-border)',
          fontSize: '10px', padding: '2px 8px', borderRadius: '999px' }}>
          CI: {form.cedula}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <label className="stat-label" style={{ display: 'block', marginBottom: '3px' }}>Nombre *</label>
            <input className="input-base text-xs" placeholder="Juan"
              value={form.nombre ?? ''} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleRegistrar()} autoFocus data-selectable />
          </div>
          <div>
            <label className="stat-label" style={{ display: 'block', marginBottom: '3px' }}>Apellido *</label>
            <input className="input-base text-xs" placeholder="Pérez"
              value={form.apellido ?? ''} onChange={(e) => setForm((f) => ({ ...f, apellido: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleRegistrar()} data-selectable />
          </div>
        </div>
        <div>
          <label className="stat-label" style={{ display: 'block', marginBottom: '3px' }}>
            Teléfono <span style={{ color: 'var(--text-muted)' }}>(opcional)</span>
          </label>
          <input className="input-base text-xs font-mono" placeholder="0414-1234567"
            value={form.telefono ?? ''} onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && handleRegistrar()} data-selectable />
        </div>
      </div>
      {error && <p className="text-xs mt-2 animate-fade-in" style={{ color: 'var(--danger)' }}>{error}</p>}
      <div className="flex gap-2 mt-3">
        <button className="btn-ghost text-xs flex-1" onClick={reset} disabled={registrando}>Cancelar</button>
        <button className="btn-primary text-xs flex-1" onClick={handleRegistrar}
          disabled={registrando || !form.nombre || !form.apellido} style={{ fontSize: '12px' }}>
          {registrando ? 'Guardando...' : 'Registrar y continuar'}
        </button>
      </div>
    </div>
  );
}