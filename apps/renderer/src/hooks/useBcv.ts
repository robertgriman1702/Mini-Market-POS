import { useState, useEffect } from 'react';
import { ipcInvoke }           from '@/lib/ipc';
import { useIPCEvent }         from './useIPCEvent';

// =============================================================================
// useBcv — tasa BCV en tiempo real
//
// Uso:
//   const { tasa, toBS, loading } = useBcv();
//   // Mostrar: $10.00 ≈ Bs 360.00
//   <span>{toBS(1000)}</span>   // 1000 centavos = $10.00 → "Bs 360,00"
// =============================================================================

interface BcvState {
  tasa:          number | null;
  actualizadoEl: string | null;
  loading:       boolean;
}

export function useBcv() {
  const [state, setState] = useState<BcvState>({
    tasa:          null,
    actualizadoEl: null,
    loading:       true,
  });

  useEffect(() => {
    ipcInvoke('bcv:getTasa').then((res) => {
      if (res) {
        setState({ tasa: res.tasa, actualizadoEl: res.actualizadoEl, loading: false });
      } else {
        setState((s) => ({ ...s, loading: false }));
      }
    }).catch(() => setState((s) => ({ ...s, loading: false })));
  }, []);

  // Actualización automática cuando el Main refresca la tasa
  useIPCEvent('bcv:tasa', ({ tasa, actualizadoEl }) => {
    setState({ tasa, actualizadoEl, loading: false });
  });

  /**
   * Convierte centavos USD a string en bolívares.
   * @param centavosUsd  ej: 1500 = $15.00
   * @returns "Bs 540,00" o "" si no hay tasa
   */
  const toBS = (centavosUsd: number): string => {
    if (!state.tasa) return '';
    const bs = (centavosUsd / 100) * state.tasa;
    return `Bs ${bs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return { ...state, toBS };
}