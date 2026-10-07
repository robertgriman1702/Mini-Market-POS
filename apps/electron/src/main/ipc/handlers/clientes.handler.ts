import { handle }              from '../helpers';
import type { ClienteService } from '../../services/ClienteService';

export function registerClientesHandlers(service: ClienteService): void {
  handle('clientes:buscarPorCedula', (_e, cedula)  => service.buscarPorCedula(cedula));
  handle('clientes:getByCedula',     (_e, cedula)  => service.getByCedula(cedula));
  handle('clientes:buscar',          (_e, termino) => service.buscar(termino));
  handle('clientes:registrar',       (_e, data)    => service.registrar(data));
  handle('clientes:create',          (_e, data)    => service.create(data));
  handle('clientes:actualizar',      (_e, data)    => service.actualizar(data));
  handle('clientes:update',          (_e, data)    => service.update(data));
  handle('clientes:getAll',          ()            => service.getAll());
  handle('clientes:getRecientes',    (_e, limite)  => service.getRecientes(limite));
}
