"use strict";
// =============================================================================
// @pos/shared — Punto de entrada único
// Importar desde aquí en toda la app:
//   import type { Producto, IPCChannels } from '@pos/shared';
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.fail = exports.ok = exports.DEFAULT_CONFIG = void 0;
var Config_1 = require("./entities/Config");
Object.defineProperty(exports, "DEFAULT_CONFIG", { enumerable: true, get: function () { return Config_1.DEFAULT_CONFIG; } });
var response_1 = require("./api/response");
Object.defineProperty(exports, "ok", { enumerable: true, get: function () { return response_1.ok; } });
Object.defineProperty(exports, "fail", { enumerable: true, get: function () { return response_1.fail; } });
//# sourceMappingURL=index.js.map