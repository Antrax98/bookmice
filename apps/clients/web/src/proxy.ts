import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/config';

/**
 * Quien ya tiene sesion no ve el login ni el registro.
 *
 * Solo mira que la cookie **exista**, no que el token siga vivo. Validarlo
 * obligaria a llamar al backend en cada carga de pagina, y lo unico que decide
 * es que boton pintar. Si el token esta muerto, la peticion que haga el
 * visitante devuelve 401 y `proxyClient` lo manda aqui.
 *
 * La portada `/` **no** esta en el matcher a proposito: es publica y muestra el
 * boton de entrar cuando no hay sesion.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.get(SESSION_COOKIE)?.value) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/login', '/register'],
};