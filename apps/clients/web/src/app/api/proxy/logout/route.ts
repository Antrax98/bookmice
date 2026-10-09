import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * Borra la cookie de sesion.
 *
 * No habla con el backend: el token es stateless y no hay store que revocar,
 * asi que "salir" es olvidar la cookie. Cuando el backend tenga sesiones
 * reales habra que llamar a su store tambien desde aqui.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });

  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return res;
}