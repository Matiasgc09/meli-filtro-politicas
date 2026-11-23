import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { crearApp } from '../src/app';
import { RepositorioEnMemoria } from '../src/repositorio/en-memoria';

let app: FastifyInstance;

beforeEach(async () => {
  app = crearApp({ repositorio: new RepositorioEnMemoria() });
  await app.ready();
});
afterEach(() => app.close());

const enviar = (autor: 'IA' | 'OPERADOR', texto: string) =>
  app.inject({ method: 'POST', url: '/api/mensajes', payload: { autor, texto } });

describe('POST /api/mensajes', () => {
  it('acepta un mensaje válido con 201', async () => {
    const r = await enviar('IA', 'Tu pedido sale mañana. ¡Gracias por tu compra!');
    expect(r.statusCode).toBe(201);
    expect(r.json().permitido).toBe(true);
  });

  it('bloquea con 422 y devuelve las infracciones', async () => {
    const r = await enviar('OPERADOR', 'escribime al 11 5023 4455');
    expect(r.statusCode).toBe(422);
    expect(r.json().infracciones.map((i: { tipo: string }) => i.tipo)).toContain('TELEFONO');
  });

  it('aplica el filtro también a los operadores humanos', async () => {
    const r = await enviar('OPERADOR', 'te paso mi instagram');
    expect(r.statusCode).toBe(422);
  });

  it('rechaza con 400 un cuerpo inválido', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/mensajes', payload: { autor: 'IA', texto: '   ' } });
    expect(r.statusCode).toBe(400);
  });
});

describe('GET /api/bloqueos y /api/metricas', () => {
  it('registra los bloqueos y calcula métricas por autor y tipo', async () => {
    await enviar('IA', 'Hola, ¿en qué te podemos ayudar?');
    await enviar('IA', 'mirá www.otrositio.com');
    await enviar('OPERADOR', 'mandame un wsp');

    const bloqueos = (await app.inject({ method: 'GET', url: '/api/bloqueos' })).json();
    expect(bloqueos).toHaveLength(2);
    expect(bloqueos[0].texto).toBe('mandame un wsp'); // más reciente primero

    const m = (await app.inject({ method: 'GET', url: '/api/metricas' })).json();
    expect(m.totalMensajes).toBe(3);
    expect(m.bloqueados).toBe(2);
    expect(m.porAutor.IA).toEqual({ total: 2, bloqueados: 1 });
    expect(m.porTipo.LINK_EXTERNO).toBe(1);
    expect(m.porTipo.RED_SOCIAL).toBe(1);
  });
});
