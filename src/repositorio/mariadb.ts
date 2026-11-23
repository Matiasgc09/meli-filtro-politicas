import * as mariadb from 'mariadb';
import { Infraccion } from '../filtro';
import { Autor, MensajeGuardado, Metricas, NuevoMensaje, RepositorioMensajes } from './tipos';

interface FilaMensaje {
  id: number;
  autor: Autor;
  texto: string;
  estado: 'ENVIABLE' | 'BLOQUEADO';
  creado_en: Date;
}

export class RepositorioMariaDb implements RepositorioMensajes {
  private pool: mariadb.Pool;

  constructor(urlConexion: string) {
    const url = new URL(urlConexion);
    this.pool = mariadb.createPool({
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
      connectionLimit: 5,
    });
  }

  async guardar(m: NuevoMensaje): Promise<MensajeGuardado> {
    const estado = m.permitido ? 'ENVIABLE' : 'BLOQUEADO';
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const res = await conn.query(
        'INSERT INTO mensajes (conversacion_id, autor, texto, estado) VALUES (?, ?, ?, ?)',
        [m.conversacionId ?? null, m.autor, m.texto, estado],
      );
      const id = Number(res.insertId);
      if (m.infracciones.length > 0) {
        await conn.batch(
          'INSERT INTO bloqueos (mensaje_id, tipo, fragmento, motivo) VALUES (?, ?, ?, ?)',
          m.infracciones.map((i) => [id, i.tipo, i.fragmento.slice(0, 255), i.motivo]),
        );
      }
      await conn.commit();
      return { id, autor: m.autor, texto: m.texto, estado, creadoEn: new Date(), infracciones: m.infracciones };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  async ultimosBloqueados(limite: number): Promise<MensajeGuardado[]> {
    const filas: FilaMensaje[] = await this.pool.query(
      "SELECT id, autor, texto, estado, creado_en FROM mensajes WHERE estado = 'BLOQUEADO' ORDER BY id DESC LIMIT ?",
      [limite],
    );
    if (filas.length === 0) return [];

    const infracciones: Array<Infraccion & { mensaje_id: number }> = await this.pool.query(
      'SELECT mensaje_id, tipo, fragmento, motivo FROM bloqueos WHERE mensaje_id IN (?)',
      [filas.map((f) => f.id)],
    );
    return filas.map((f) => ({
      id: f.id,
      autor: f.autor,
      texto: f.texto,
      estado: f.estado,
      creadoEn: f.creado_en,
      infracciones: infracciones
        .filter((i) => i.mensaje_id === f.id)
        .map(({ tipo, fragmento, motivo }) => ({ tipo, fragmento, motivo })),
    }));
  }

  async metricas(): Promise<Metricas> {
    const porAutor: Array<{ autor: Autor; total: bigint; bloqueados: bigint }> = await this.pool.query(
      "SELECT autor, COUNT(*) AS total, SUM(estado = 'BLOQUEADO') AS bloqueados FROM mensajes GROUP BY autor",
    );
    const porTipo: Array<{ tipo: Infraccion['tipo']; total: bigint }> = await this.pool.query(
      'SELECT tipo, COUNT(*) AS total FROM bloqueos GROUP BY tipo',
    );

    const r: Metricas = { totalMensajes: 0, bloqueados: 0, porTipo: {}, porAutor: {} };
    for (const f of porAutor) {
      const total = Number(f.total);
      const bloqueados = Number(f.bloqueados ?? 0);
      r.totalMensajes += total;
      r.bloqueados += bloqueados;
      r.porAutor[f.autor] = { total, bloqueados };
    }
    for (const f of porTipo) r.porTipo[f.tipo] = Number(f.total);
    return r;
  }

  async cerrar(): Promise<void> {
    await this.pool.end();
  }
}
