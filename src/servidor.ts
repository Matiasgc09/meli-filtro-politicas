import { crearApp } from './app';
import { RepositorioEnMemoria } from './repositorio/en-memoria';
import { RepositorioMariaDb } from './repositorio/mariadb';

const puerto = Number(process.env.PUERTO ?? 3000);
const urlBase = process.env.DATABASE_URL;

const repositorio = urlBase ? new RepositorioMariaDb(urlBase) : new RepositorioEnMemoria();
const app = crearApp({ repositorio, logger: true });

if (!urlBase) app.log.warn('DATABASE_URL no definida: usando almacenamiento en memoria');

app.listen({ port: puerto, host: '0.0.0.0' }).catch((e) => {
  app.log.error(e);
  process.exit(1);
});

for (const senal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(senal, async () => {
    await app.close();
    process.exit(0);
  });
}
