"use strict";
// =============================================================================
// ApiResponse<T> — Wrapper universal de respuestas IPC
//
// TODOS los handlers retornan este tipo. El Renderer NUNCA recibe un throw
// sin capturar. Si ocurre un error en el Main Process, llega como
// { success: false, error: string } — nunca como una Promise rechazada.
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.fail = exports.ok = void 0;
// Helper para construir respuestas exitosas
const ok = (data) => ({ success: true, data });
exports.ok = ok;
// Helper para construir respuestas de error
const fail = (error, code) => ({ success: false, error, code });
exports.fail = fail;
//# sourceMappingURL=response.js.map