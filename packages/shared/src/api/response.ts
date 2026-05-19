// =============================================================================
// ApiResponse<T> — Wrapper universal de respuestas IPC
//
// TODOS los handlers retornan este tipo. El Renderer NUNCA recibe un throw
// sin capturar. Si ocurre un error en el Main Process, llega como
// { success: false, error: string } — nunca como una Promise rechazada.
// =============================================================================

export type ApiResponse<T> =
  | { success: true;  data: T }
  | { success: false; error: string; code?: string };

// Helper para construir respuestas exitosas
export const ok   = <T>(data: T): ApiResponse<T> => ({ success: true, data });

// Helper para construir respuestas de error
export const fail = (error: string, code?: string): ApiResponse<never> =>
  ({ success: false, error, code });
