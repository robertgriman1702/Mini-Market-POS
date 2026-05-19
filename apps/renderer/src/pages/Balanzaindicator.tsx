// Agrega este componente al final de POS.tsx
// y úsalo en el top bar así:
//
//   <BalanzaIndicator peso={pesoActual} conectada={balanzaConectada} />
//
// Por ahora sin hardware real muestra "Sin balanza"
// Cuando se integre serialport, pesoActual vendrá de useIPCEvent('balanza:peso')

interface BalanzaProps {
  peso?:      number | null;   // kg
  conectada?: boolean;
}

export function BalanzaIndicator({ peso = null, conectada = false }: BalanzaProps) {
  if (!conectada) {
    return (
      <div
        className="flex items-center gap-1.5 px-3 h-full text-xs font-mono"
        style={{
          borderLeft:  '1px solid var(--border-dim)',
          color:       'var(--text-muted)',
          opacity:     0.5,
          whiteSpace:  'nowrap',
        }}
        title="Balanza no conectada"
      >
        <span style={{ fontSize: '0.85rem' }}>⚖</span>
        <span>Sin balanza</span>
      </div>
    );
  }

  const pesoStr = peso !== null
    ? `${peso.toFixed(3)} kg`
    : 'Estabilizando...';

  return (
    <div
      className="flex items-center gap-1.5 px-3 h-full text-xs font-mono animate-fade-in"
      style={{
        borderLeft: '1px solid var(--border-dim)',
        color:      peso !== null ? 'var(--green)' : 'var(--warn)',
        whiteSpace: 'nowrap',
      }}
      title="Balanza conectada"
    >
      <span
        style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background:   peso !== null ? 'var(--green)' : 'var(--warn)',
          display:      'inline-block',
          flexShrink:   0,
          boxShadow:    peso !== null ? '0 0 4px var(--green)' : 'none',
        }}
      />
      <span style={{ fontSize: '0.85rem' }}>⚖</span>
      <span>{pesoStr}</span>
    </div>
  );
}