import { ConfigService } from '@nestjs/config';

/**
 * Las opciones de `AuthenticationModule`, en un solo sitio.
 *
 * ## Por qué está en `common` y no en el módulo `auth`
 *
 * Porque lo consumen dos módulos de Nest que no son el de auth:
 * `AppModule` y `OpenApiSpecModule`. Y no es opcional: `AuthModule` provee
 * `JwtAuth`, que inyecta `AuthenticationRegistry`, que viene de
 * `AuthenticationModule`. Como `NestFactory.create` instancia los providers
 * aunque no se llame a `listen()`, generar el `openapi.json` **falla** si el
 * módulo de auth no lo importa. Igual que pasó con `DatabaseModule`.
 *
 * El precedente exacto es `common/swagger/openapi-config.ts`: el `DocumentBuilder`
 * vive ahí para que `main.ts` y `scripts/generate-openapi.ts` no se
 * desincronicen. Mismo problema, mismo truco.
 */

/**
 * Mínimo de bytes para una clave HS256. Lo exige `@nestjs/authentication`.
 *
 * 32 bytes, no 32 caracteres: una clave de 32 caracteres ASCII son 32 bytes, pero
 * una clave corta en otro alfabeto puede pesar menos de lo que parece.
 */
const MIN_SECRET_BYTES = 32;

/**
 * El paquete cuenta las duraciones en **milisegundos o strings** (`'15m'`,
 * `'14d'`), al revés que `@nestjs/jwt`, que contaba segundos.
 *
 * Por eso un número desnudo es un peligro: `3600` son 3.6 segundos, no una hora,
 * y solo sale un aviso al arrancar. Aquí un número se rechaza en vez de aceptarse
 * en silencio, porque un token que expira en 3.6 segundos falla de la forma más
 * difícil de diagnosticar que existe: funciona en el login y se cae al navegar.
 */
function duracion(valor: string, nombre: string): string {
  if (/^\d+$/.test(valor)) {
    throw new Error(
      `${nombre}=${valor} es un número, y las duraciones de @nestjs/authentication ` +
        `se cuentan en MILISEGUNDOS: eso son ${Number(valor) / 1000} segundos. ` +
        `Escríbelo como string ('1h', '30d', '900000') o el token caducará antes ` +
        `de que nadie lo use.`,
    );
  }

  return valor;
}

/**
 * La factory de `forRootAsync`.
 *
 * `forRootAsync` y no `forRoot` por una razón concreta: `forRoot()` evalúa su
 * argumento cuando se **importa** el fichero, y en ese momento todavía no hay
 * `ConfigService`. La factory sí se ejecuta en bootstrap.
 *
 * ## Lo que se pasa, y lo que no
 *
 * Solo datos. Ni clases ni callbacks: los credential providers, los handlers y
 * los stores son providers de nuestros módulos y se registran solos desde su
 * constructor, así que viven junto a lo que inyectan.
 */
export function authenticationOptionsFactory(
  config: ConfigService,
): Record<string, unknown> {
  const secret = config.get<string>('auth.jwt_secret');

  if (!secret || Buffer.byteLength(secret, 'utf8') < MIN_SECRET_BYTES) {
    throw new Error(
      `JWT_SECRET necesita al menos ${MIN_SECRET_BYTES} bytes para firmar con ` +
        `HS256, y ${secret ? `tiene ${Buffer.byteLength(secret, 'utf8')}` : 'no está definido'}. ` +
        `Genéralo con: openssl rand -base64 32`,
    );
  }

  return {
    /**
     * Acepta arrancar con los stores en memoria.
     *
     * El default del paquete es `false`, y con `false` la aplicación **no
     * arranca en producción**: el módulo comprueba al arrancar que cada contrato
     * que usan las features configuradas tenga su store, y falla nombrando los
     * que faltan.
     *
     * Esto está en `true` porque la fase 2 sigue pendiente. El coste está
     * documentado donde se decide, en `config/configuration.ts`, que es el sitio
     * donde se cambia.
     *
     * Lo que **no** se puede hacer es dejar esto en `false` y esperando a que
     * alguien escriba la fase 2: el resultado es un contenedor que entra en
     * CrashLoopBackOff con un error que habla de stores de `mfa`, en un despliegue
     * donde nadie ha pedido MFA.
     */
    allowInMemoryStorage: config.get<boolean>('auth.allow_in_memory_storage'),
    accessToken: {
      key: secret,
      ttl: duracion(
        config.get<string>('auth.access_token_ttl')!,
        'JWT_EXPIRES_IN',
      ),
    },
    refreshToken: {
      ttl: duracion(
        config.get<string>('auth.refresh_token_ttl')!,
        'REFRESH_TOKEN_TTL',
      ),
    },
    password: {
      logN: config.get<number>('auth.password_log_n')!,
    },
  };
}
