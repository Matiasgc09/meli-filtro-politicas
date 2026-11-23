import { Infraccion, TipoInfraccion } from '../filtro';

export type Autor = 'IA' | 'OPERADOR' | 'COMPRADOR';

export interface NuevoMensaje {
  conversacionId?: number | null;
  autor: Autor;
  texto: string;
  permitido: boolean;
  infracciones: Infraccion[];
}

export interface MensajeGuardado {
  id: number;
  autor: Autor;
  texto: string;
  estado: 'ENVIABLE' | 'BLOQUEADO';
  creadoEn: Date;
  infracciones: Infraccion[];
}

export interface Metricas {
  totalMensajes: number;
  bloqueados: number;
  porTipo: Partial<Record<TipoInfraccion, number>>;
  porAutor: Partial<Record<Autor, { total: number; bloqueados: number }>>;
}

/**
 * Contrato de persistencia. La API depende de esta interfaz, no de MariaDB:
 * en producción se usa `RepositorioMariaDb` y en los tests `RepositorioEnMemoria`.
 */
export interface RepositorioMensajes {
  guardar(mensaje: NuevoMensaje): Promise<MensajeGuardado>;
  ultimosBloqueados(limite: number): Promise<MensajeGuardado[]>;
  metricas(): Promise<Metricas>;
  cerrar(): Promise<void>;
}
