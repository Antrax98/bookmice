export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USER,
    pass: process.env.DB_PASS,
    name: process.env.DB_NAME,
    // `undefined` y no cadena vacia: TypeORM compara contra `undefined` para
    // decidir el schema por defecto, y `''` lo tomaria como un schema que se
    // llama vacio. Sin DB_SCHEMA se usa el `public`, como siempre.
    schema: process.env.DB_SCHEMA || undefined,
  },
  throttle: {
    // En milisegundos, no en segundos: cambió en la v5 de @nestjs/throttler y
    // es el fallo más común al copiar ejemplos viejos.
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '10', 10),
  },
  auth: {
    jwt_secret: process.env.JWT_SECRET,
    refresh_token_secret: process.env.REFRESH_TOKEN,
    jwt_expires_in: process.env.JWT_EXPIRES_IN || '1h',
  },
});
