import { Client } from 'pg';

/**
 * Crea el schema de `DB_SCHEMA` si no existe.
 *
 * Existe por un motivo concreto: pasar `schema` a TypeORM **no crea el schema**
 * en Postgres, solo le dice dónde buscar. Y el CLI de migraciones tampoco puede
 * crearlo, porque su propia tabla `migrations` vive en el schema que todavía no
 * existe. Es un gallo y huevo que solo se rompe conectando **antes** de que
 * TypeORM abra su conexión, que es lo que hace `data-source.ts`.
 *
 * Sin este paso el fallo es `relation "migrations" does not exist`, que no
 * menciona el schema por ninguna parte.
 *
 * Se conecta con `pg` y no con TypeORM a propósito: un `DataSource` con el
 * schema configurado es justamente lo que todavía no se puede abrir.
 */

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

/**
 * Sin `DB_SCHEMA` se usa el `public`, que Postgres ya garantiza. No es un
 * error ni debe imprimir ruido.
 */
export async function ensureSchema(): Promise<void> {
  const schema = process.env.DB_SCHEMA;

  if (!schema) {
    return;
  }

  // El nombre va interpolado en el SQL porque Postgres no permite
  // parametrizar un identificador. Se valida en vez de escapar: un schema
  // válido son minúsculas, dígitos y guiones bajos, y cualquier otra cosa es
  // un fallo de configuración que debe verse aquí, y no como un nombre raro
  // recién creado en la base de datos.
  if (!IDENTIFIER.test(schema)) {
    throw new Error(
      `DB_SCHEMA="${schema}" no es un identificador válido. Usa minúsculas, ` +
        `dígitos y guiones bajos, empezando por letra o guion bajo.`,
    );
  }

  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });

  await client.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  } finally {
    await client.end();
  }
}
