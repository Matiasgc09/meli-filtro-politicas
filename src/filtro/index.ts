import { ejecutarDetectores } from './detectores';
import { normalizar } from './normalizar';
import { Infraccion, OpcionesFiltro, ResultadoFiltro } from './tipos';

export * from './tipos';
export { normalizar } from './normalizar';

export const OPCIONES_POR_DEFECTO: Required<OpcionesFiltro> = {
  // Valor de referencia: confirmar el límite vigente en la documentación de Mercado Libre.
  maxCaracteres: 350,
  dominiosPermitidos: ['mercadolibre.com.ar', 'mercadolibre.com', 'mercadolibre.com.mx', 'mercadolibre.cl'],
};

/**
 * Revisa un mensaje (de la IA o de un operador) antes de enviarlo a Mercado Libre.
 * Si devuelve `permitido: false`, el mensaje NO debe enviarse.
 */
export function revisarMensaje(texto: string, opciones: OpcionesFiltro = {}): ResultadoFiltro {
  const op = { ...OPCIONES_POR_DEFECTO, ...opciones };
  const textoNormalizado = normalizar(texto);

  const infracciones: Infraccion[] = ejecutarDetectores(textoNormalizado, {
    dominiosPermitidos: op.dominiosPermitidos,
  });

  if (texto.length > op.maxCaracteres) {
    infracciones.push({
      tipo: 'LONGITUD',
      fragmento: `${texto.length} caracteres`,
      motivo: `Supera el máximo de ${op.maxCaracteres} caracteres`,
    });
  }

  return { permitido: infracciones.length === 0, infracciones, textoNormalizado };
}
