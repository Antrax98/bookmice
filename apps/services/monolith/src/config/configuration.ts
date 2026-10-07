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
    // Clave HS256. El paquete exige **32 bytes como mínimo** y falla al arrancar
    // si no, así que aquí solo se lee: la validación vive en
    // `common/auth/authentication-options.ts`, que es donde se construyen las
    // opciones de verdad.
    jwt_secret: process.env.JWT_SECRET,
    // Duración del access token. OJO: `@nestjs/authentication` cuenta en
    // **milisegundos o strings** (`'15m'`, `'14d'`), al revés que `@nestjs/jwt`,
    // que contaba segundos. Un número desnudo significa otra cosa: `3600` son
    // 3.6 segundos, no una hora. Por eso el default es string y no número.
    access_token_ttl: process.env.JWT_EXPIRES_IN || '1h',
    refresh_token_ttl: process.env.REFRESH_TOKEN_TTL || '30d',
    // `password.logN` de scrypt. El default del paquete es 17, que son **128 MiB
    // por hash** en el threadpool de libuv (4 hilos): cada test que hashee se
    // comería un segundo y casi toda la memoria del proceso.
    //
    // 10 son ~1 MiB. Solo se baja en desarrollo y test; producción usa 17, que
    // es el valor recomendado por OWASP y el que hace la fuerza bruta cara.
    password_log_n: parseInt(
      process.env.PASSWORD_LOG_N ??
        (process.env.NODE_ENV === 'production' ? '17' : '10'),
      10,
    ),
  },
});
