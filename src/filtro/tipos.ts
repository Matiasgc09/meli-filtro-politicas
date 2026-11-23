export type TipoInfraccion =
  | 'TELEFONO'
  | 'EMAIL'
  | 'LINK_EXTERNO'
  | 'RED_SOCIAL'
  | 'DATOS_BANCARIOS'
  | 'FUERA_DE_PLATAFORMA'
  | 'LONGITUD';

export interface Infraccion {
  tipo: TipoInfraccion;
  /** Fragmento (normalizado) que disparó la regla */
  fragmento: string;
  motivo: string;
}

export interface ResultadoFiltro {
  permitido: boolean;
  infracciones: Infraccion[];
  textoNormalizado: string;
}

export interface OpcionesFiltro {
  /** Límite de caracteres del mensaje. Verificar el valor vigente en la documentación de Mercado Libre. */
  maxCaracteres?: number;
  /** Dominios permitidos en links (se aceptan también sus subdominios). */
  dominiosPermitidos?: string[];
}
