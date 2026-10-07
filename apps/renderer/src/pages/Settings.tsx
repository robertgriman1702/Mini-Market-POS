import { useState, useEffect }   from 'react';
import { useQuery, useMutation } from '@/hooks';
import type { AppConfig }        from '@pos/shared';

// =============================================================================
// Settings — Configuración del local y módulos
// =============================================================================

interface Props { onConfigChange: (c: AppConfig) => void }

type Section = 'local' | 'modulos' | 'impresora' | 'licencia';

export function Settings({ onConfigChange }: Props) {
  const [section, setSection]   = useState<Section>('local');
  const [form,    setForm]      = useState<Partial<AppConfig> | null>(null);
  const [saved,   setSaved]     = useState(false);
  const [claveLicencia, setClaveLicencia] = useState('');
  const [licenciaError, setLicenciaError] = useState('');

  const { data: config, refetch }              = useQuery('config:get');
  const { data: hwid, refetch: refetchHwid }    = useQuery('system:getHwid');
  const { data: license, refetch: refetchLicense } = useQuery('system:checkLicense');

  const { mutate: saveConfig, isLoading } = useMutation('config:save', {
    onSuccess: (updated) => {
      onConfigChange(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      refetch();
    },
  });

  const { mutate: testPrinter, isLoading: testingPrinter } =
    useMutation('printer:test');

  const { mutate: activarLicencia, isLoading: activando } =
    useMutation('system:activateLicense', {
      onSuccess: () => {
        setClaveLicencia('');
        setLicenciaError('');
        refetchLicense();
        refetchHwid();
      },
      onError: (err) => setLicenciaError(err),
    });

  const { mutate: revalidarLicencia, isLoading: revalidando } =
    useMutation('system:refreshLicense', {
      onSuccess: () => {
        refetchLicense();
        refetchHwid();
      },
    });

  useEffect(() => {
    if (config) setForm(config);
  }, [config]);

  const set = (key: keyof AppConfig, value: unknown) =>
    setForm((f) => f ? { ...f, [key]: value } : f);

  const setFlag = (key: keyof AppConfig['flags'], value: boolean) =>
    setForm((f) => f && f.flags
      ? { ...f, flags: { ...f.flags, [key]: value } }
      : f
    );

  const handleSave = () => { if (form) saveConfig(form); };

  if (!form || !config) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>Cargando...</p>
      </div>
    );
  }

  const SECTIONS: Array<{ id: Section; label: string }> = [
    { id: 'local',     label: 'Datos del Local' },
    { id: 'modulos',   label: 'Módulos' },
    { id: 'impresora', label: 'Impresora' },
    { id: 'licencia',  label: 'Licencia' },
  ];

  return (
    <div className="flex h-full" style={{ background: 'var(--bg-base)' }}>

      {/* Sections nav */}
      <div
        className="w-44 flex-shrink-0 flex flex-col"
        style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border-dim)' }}
      >
        <div className="section-header">Configuración</div>
        {SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            className={`text-left px-4 py-3 text-xs uppercase tracking-widest transition-colors duration-100 ${section === id ? 'active' : ''}`}
            style={{
              color:        section === id ? 'var(--green)' : 'var(--text-secondary)',
              background:   section === id ? 'var(--bg-elevated)' : 'transparent',
              borderLeft:   section === id ? '2px solid var(--green)' : '2px solid transparent',
            }}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 max-w-xl">

        {/* ── Datos del local ── */}
        {section === 'local' && (
          <>
            <SectionTitle>Datos del Local</SectionTitle>
            <Field label="Nombre del negocio">
              <input className="input-base" value={form.local_nombre ?? ''} onChange={(e) => set('local_nombre', e.target.value)} data-selectable />
            </Field>
            <Field label="RIF / NIF">
              <input className="input-base" value={form.local_rif ?? ''} onChange={(e) => set('local_rif', e.target.value)} data-selectable />
            </Field>
            <Field label="Dirección">
              <input className="input-base" value={form.local_direccion ?? ''} onChange={(e) => set('local_direccion', e.target.value)} data-selectable />
            </Field>
            <Field label="Teléfono">
              <input className="input-base" value={form.local_telefono ?? ''} onChange={(e) => set('local_telefono', e.target.value)} data-selectable />
            </Field>
            <Field label="Símbolo de moneda">
              <input className="input-base w-20" value={form.moneda ?? '$'} onChange={(e) => set('moneda', e.target.value)} maxLength={3} data-selectable />
            </Field>
            <Field label={`IVA (%)`}>
              <input className="input-base w-20" type="number" min={0} max={50} value={form.iva_porcentaje ?? 16} onChange={(e) => set('iva_porcentaje', Number(e.target.value))} data-selectable />
            </Field>
          </>
        )}

        {/* ── Módulos / Feature Flags ── */}
        {section === 'modulos' && form.flags && (
          <>
            <SectionTitle>Activar Módulos</SectionTitle>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Los módulos ocultos no aparecen en la interfaz hasta ser activados.
            </p>
            {([
              { key: 'iva'              as const, label: 'Cálculo de IVA',         desc: 'Muestra y calcula IVA en el POS y tickets' },
              { key: 'impresora' as const, label: 'Impresora Fiscal',       desc: 'Activa el modo fiscal en lugar de ESC/POS genérico' },
              { key: 'mostrar_bs'          as const, label: 'Báscula Serial',         desc: 'Integración con pesa por puerto COM' },
            ]).map(({ key, label, desc }) => (
              <div
                key={key}
                className="flex items-start justify-between p-3 gap-4"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-dim)' }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                </div>
                <Toggle
                  value={form.flags![key]}
                  onChange={(v) => setFlag(key, v)}
                />
              </div>
            ))}
          </>
        )}

        {/* ── Impresora ── */}
        {section === 'impresora' && (
          <>
            <SectionTitle>Configuración de Impresora</SectionTitle>
            <Field label="Puerto / Nombre de impresora">
              <input className="input-base" value={form.impresora_puerto ?? 'USB'} onChange={(e) => set('impresora_puerto', e.target.value)} placeholder="USB, COM3, \\.\COM4..." data-selectable />
            </Field>
            <Field label="Modo de impresión">
              <div className="flex gap-2">
                {(['generic', 'fiscal'] as const).map((m) => (
                  <button
                    key={m}
                    className={`px-4 py-2 text-xs uppercase tracking-wider transition-colors ${form.impresora_modo === m ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => set('impresora_modo', m)}
                  >
                    {m === 'generic' ? 'Genérico ESC/POS' : 'Fiscal'}
                  </button>
                ))}
              </div>
            </Field>
            <button
              className="btn-ghost w-full"
              disabled={testingPrinter}
              onClick={() => testPrinter()}
            >
              {testingPrinter ? 'Imprimiendo...' : '⎙ Imprimir Página de Prueba'}
            </button>
          </>
        )}

        {/* ── Licencia ── */}
        {section === 'licencia' && (
          <>
            <SectionTitle>Información de Licencia</SectionTitle>

            <LicenseStatusBanner estado={license?.estado} />

            <div
              className="p-4 flex flex-col gap-3"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-dim)' }}
            >
              <InfoRow label="Device ID" value={hwid ?? '...'} mono />
              <InfoRow label="Estado" value={describirEstadoLicencia(license?.estado)} />
              <InfoRow label="Cliente" value={license?.cliente ?? '—'} />
              <InfoRow label="Expira" value={license?.expira_at
                ? new Date(license.expira_at).toLocaleDateString('es')
                : 'Permanente'
              } />
            </div>

            <Field label="Activar / Reemplazar Licencia">
              <textarea
                className="input-base text-xs font-mono"
                placeholder="Pega aquí el contenido de tu licencia..."
                value={claveLicencia}
                onChange={(e) => { setClaveLicencia(e.target.value); setLicenciaError(''); }}
                rows={4}
                style={{ resize: 'none' }}
                data-selectable
              />
            </Field>

            {licenciaError && (
              <p className="text-xs animate-fade-in" style={{ color: 'var(--danger)' }}>
                ✕ {licenciaError}
              </p>
            )}

            <div className="flex gap-2">
              <button
                className="btn-primary flex-1"
                disabled={activando || !claveLicencia.trim()}
                onClick={() => activarLicencia(claveLicencia.trim())}
              >
                {activando ? 'Activando...' : 'Activar Licencia'}
              </button>
              <button
                className="btn-ghost flex-1"
                disabled={revalidando}
                onClick={() => revalidarLicencia()}
              >
                {revalidando ? 'Revalidando...' : 'Revalidar Ahora'}
              </button>
            </div>
          </>
        )}

        {/* Save button */}
        {section !== 'licencia' && (
          <div className="pt-2">
            <button
              className="btn-primary w-full"
              disabled={isLoading}
              onClick={handleSave}
            >
              {saved ? '✓ Guardado' : isLoading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest pb-2"
      style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-dim)' }}>
      {children}
    </h2>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className={`text-xs ${mono ? 'font-mono' : ''}`} style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className="w-10 h-5 rounded-full flex-shrink-0 transition-all duration-200 relative"
      style={{
        background: value ? 'var(--green)' : 'var(--bg-overlay)',
        border:     '1px solid ' + (value ? 'var(--green)' : 'var(--border-loud)'),
      }}
      onClick={() => onChange(!value)}
    >
      <span
        className="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200"
        style={{
          background: value ? '#000' : 'var(--text-muted)',
          left:       value ? '20px' : '2px',
        }}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Licencia — manejo visual explícito de los 7 estados posibles
// ---------------------------------------------------------------------------

type LicenseEstadoVisual = 'valid' | 'invalid' | 'expired' | 'revoked' | 'suspended' | 'grace_period' | 'not_found';

function describirEstadoLicencia(estado: string | undefined): string {
  switch (estado as LicenseEstadoVisual | undefined) {
    case 'valid':        return '✓ Válida';
    case 'grace_period': return '⏳ Período de gracia (sin conexión reciente)';
    case 'invalid':      return '✕ Inválida';
    case 'expired':      return '✕ Expirada';
    case 'revoked':      return '✕ Revocada';
    case 'suspended':    return '✕ Suspendida';
    case 'not_found':    return '— No activada';
    default:             return '...';
  }
}

function LicenseStatusBanner({ estado }: { estado: string | undefined }) {
  if (!estado) return null;

  const config: Record<LicenseEstadoVisual, { texto: string; bg: string; border: string; color: string }> = {
    valid: {
      texto:  'Licencia activa y vigente.',
      bg:     'var(--green-light)', border: 'var(--green-border)', color: 'var(--green)',
    },
    grace_period: {
      texto:  'Operando en período de gracia sin contacto con el servidor. Conéctate a internet pronto para revalidar.',
      bg:     'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.25)', color: 'var(--warn)',
    },
    not_found: {
      texto:  'No hay ninguna licencia activada en este equipo. Pega tu licencia abajo para activarla.',
      bg:     'var(--bg-elevated)', border: 'var(--border-loud)', color: 'var(--text-muted)',
    },
    invalid: {
      texto:  'La licencia no es válida para este equipo (HWID o firma no coinciden).',
      bg:     'rgba(244,67,54,0.08)', border: 'rgba(244,67,54,0.2)', color: 'var(--danger)',
    },
    expired: {
      texto:  'La licencia expiró. Renueva tu licencia para continuar usando el sistema sin interrupciones.',
      bg:     'rgba(244,67,54,0.08)', border: 'rgba(244,67,54,0.2)', color: 'var(--danger)',
    },
    revoked: {
      texto:  'Esta licencia fue revocada. Contacta a tu proveedor para más información.',
      bg:     'rgba(244,67,54,0.08)', border: 'rgba(244,67,54,0.2)', color: 'var(--danger)',
    },
    suspended: {
      texto:  'Esta licencia está temporalmente suspendida. Contacta a tu proveedor.',
      bg:     'rgba(244,67,54,0.08)', border: 'rgba(244,67,54,0.2)', color: 'var(--danger)',
    },
  };

  const c = config[estado as LicenseEstadoVisual];
  if (!c) return null;

  return (
    <div
      className="p-3 text-xs animate-fade-in"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}
    >
      {c.texto}
    </div>
  );
}