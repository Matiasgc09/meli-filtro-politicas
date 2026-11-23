import { MensajeGuardado, Metricas, NuevoMensaje, RepositorioMensajes } from './tipos';

export class RepositorioEnMemoria implements RepositorioMensajes {
  private mensajes: MensajeGuardado[] = [];

  async guardar(m: NuevoMensaje): Promise<MensajeGuardado> {
    const guardado: MensajeGuardado = {
      id: this.mensajes.length + 1,
      autor: m.autor,
      texto: m.texto,
      estado: m.permitido ? 'ENVIABLE' : 'BLOQUEADO',
      creadoEn: new Date(),
      infracciones: m.infracciones,
    };
    this.mensajes.push(guardado);
    return guardado;
  }

  async ultimosBloqueados(limite: number): Promise<MensajeGuardado[]> {
    return this.mensajes
      .filter((m) => m.estado === 'BLOQUEADO')
      .slice(-limite)
      .reverse();
  }

  async metricas(): Promise<Metricas> {
    const r: Metricas = { totalMensajes: this.mensajes.length, bloqueados: 0, porTipo: {}, porAutor: {} };
    for (const m of this.mensajes) {
      const bloqueado = m.estado === 'BLOQUEADO';
      if (bloqueado) r.bloqueados++;
      const a = (r.porAutor[m.autor] ??= { total: 0, bloqueados: 0 });
      a.total++;
      if (bloqueado) a.bloqueados++;
      for (const i of m.infracciones) r.porTipo[i.tipo] = (r.porTipo[i.tipo] ?? 0) + 1;
    }
    return r;
  }

  async cerrar(): Promise<void> {}
}
