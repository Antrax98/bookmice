const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:'];

/**
 * Una URL que el sitio puede pintar en un `<a href>` sin riesgo.
 *
 * `URL.canParse` a secas acepta cualquier esquema, incluido `javascript:`, que
 * se ejecuta al hacer clic. La lista blanca es la regla; vive aquí para que el
 * dominio y el DTO apliquen **la misma**, en vez de definir cada uno la suya.
 */
export function isSafeUrl(value: unknown): boolean {
  if (typeof value !== 'string' || !URL.canParse(value)) return false;

  return SAFE_PROTOCOLS.includes(new URL(value).protocol);
}

export const SAFE_URL_MESSAGE = 'must be an http, https or mailto URL';
