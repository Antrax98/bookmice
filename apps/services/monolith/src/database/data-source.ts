import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { ensureSchema } from './ensure-schema';

config();

/**
 * El DataSource se exporta como una promesa a propósito, y no por gusto.
 *
 * Por qué: pasar `schema` a las opciones de TypeORM **no crea el schema** en
 * Postgres, solo le dice dónde leer y escribir. Y el CLI tampoco puede
 * crearlo, porque su propia tabla `migrations` vive en el schema que aún no
 * existe. Sin este paso, `migration:run` falla con `relation "migrations" does
 * not exist`, un error que no menciona el schema y cuesta media hora de
 * depurar.
 *
 * TypeORM 1.x espera exactamente esto: `loadDataSource` hace `await` sobre lo
 * que se exporta, así que un factory asíncrono se ejecuta antes de que abra la
 * conexión. Lo que importa es el **orden**, no la forma.
 *
 * La alternativa sería un `pnpm db:schema && typeorm ...` en el script. Se
 * descartó: pnpm no reenvía los argumentos a través del `&&`, así que
 * `migration:generate <path>` deja de recibirlos y falla. Y si algún día se
 * añade un comando de TypeORM sin el prefijo, se olvida el paso en silencio.
 * Aquí el schema se crea siempre, se llame como se llame.
 */

export default ensureSchema().then(
  (): DataSource =>
    new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      // Debe coincidir con el `schema` de `database.module.ts`, o el CLI crearía
      // las tablas en un sitio distinto del que lee la aplicación. Los dos leen
      // de la misma variable de entorno a propósito, justamente para que no
      // puedan separarse.
      schema: process.env.DB_SCHEMA || undefined,
      // Anclados en __dirname y no en el cwd: desde src/database/ resuelven a
      // src/, y desde dist/database/ resuelven a dist/. El mismo archivo sirve
      // para el CLI en desarrollo (ts-node) y para el contenedor, que solo tiene
      // el JS compilado. Con rutas relativas al cwd, en producción no matchean
      // nada y TypeORM reporta "No migrations are pending" sin aplicar ninguna.
      entities: [__dirname + '/../modules/**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../migrations/*{.ts,.js}'],
      synchronize: false,
    }),
);
