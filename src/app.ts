import Fastify, { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { z } from 'zod';
import { revisarMensaje } from './filtro';
import { RepositorioMensajes } from './repositorio/tipos';

const esquemaMensaje = z.object({
  conversacionId: z.number().int().positive().nullish(),
  autor: z.enum(['IA', 'OPERADOR']),
  texto: z.string().trim().min(1, 'El texto no puede estar vacío').max(5000),
});

export interface OpcionesApp {
  repositorio: RepositorioMensajes;
  logger?: boolean;
}

export function crearApp({ repositorio, logger = false }: OpcionesApp): FastifyInstance {
  const app = Fastify({ logger });

  app.register(fastifyStatic, { root: path.join(__dirname, '..', 'public') });

  app.get('/api/salud', async () => ({ ok: true }));

  /** Solo revisa, no guarda. Útil para validar mientras el operador escribe. */
  app.post('/api/mensajes/revisar', async (req, reply) => {
    const datos = esquemaMensaje.safeParse(req.body);
    if (!datos.success) return reply.code(400).send({ error: datos.error.issues[0].message });
    return revisarMensaje(datos.data.texto);
  });

  /**
   * Revisa y registra el mensaje. Si está bloqueado responde 422 y el mensaje
   * NO se envía a Mercado Libre (en el sistema real, acá se encolaría el envío).
   */
  app.post('/api/mensajes', async (req, reply) => {
    const datos = esquemaMensaje.safeParse(req.body);
    if (!datos.success) return reply.code(400).send({ error: datos.error.issues[0].message });

    const resultado = revisarMensaje(datos.data.texto);
    const guardado = await repositorio.guardar({ ...datos.data, ...resultado });

    return reply.code(resultado.permitido ? 201 : 422).send({ ...resultado, mensajeId: guardado.id });
  });

  app.get('/api/bloqueos', async (req) => {
    const { limite } = z.object({ limite: z.coerce.number().int().min(1).max(100).default(20) }).parse(req.query);
    return repositorio.ultimosBloqueados(limite);
  });

  app.get('/api/metricas', async () => repositorio.metricas());

  app.addHook('onClose', async () => repositorio.cerrar());

  return app;
}
