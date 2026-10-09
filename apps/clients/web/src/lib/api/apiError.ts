import type { ApiErrorDetail } from './transport';

/**
 * Un error que viene del backend, con su código y sus errores por campo.
 *
 * Vive fuera de `client/` y `server/` porque la usan los dos: el sobre de
 * respuesta es el mismo venga por donde venga.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly errors: ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type FieldErrors = Record<string, string>;

/**
 * Los errores por campo de una excepción, indexados por el `field` que manda el
 * backend: `fullName`, `links[0].url`, `assets[2].kind`.
 *
 * Devuelve `{}` para cualquier otro error, así que quien llama no tiene que
 * comprobar el tipo antes.
 */
export function fieldErrorsOf(error: unknown): FieldErrors {
  if (!(error instanceof ApiError)) return {};

  const fields: FieldErrors = {};

  for (const detail of error.errors) {
    // El primero gana: si un campo acumula varios mensajes, el más específico
    // suele ser el primero que produce class-validator.
    if (detail.field && !(detail.field in fields)) {
      fields[detail.field] = detail.message;
    }
  }

  return fields;
}
