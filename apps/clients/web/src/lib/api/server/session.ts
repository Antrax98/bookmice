import 'server-only';

import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '../../config';

/**
 * Si el visitante trae cookie de sesión.
 *
 * Solo mira que exista, no que el token siga vivo: validarlo obligaría a una
 * petición al backend en cada carga de una página pública, y lo único que se
 * decide con esto es qué botones pintar. Si el token murió, el enlace al panel
 * acaba en el login — igual que `proxy.ts`.
 */
export async function hasSession(): Promise<boolean> {
  return Boolean((await cookies()).get(SESSION_COOKIE)?.value);
}
