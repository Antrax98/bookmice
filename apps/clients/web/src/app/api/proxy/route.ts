import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/config';
import { clientIpHeader } from '@/lib/api/server/clientIp';
import type { ApiResponse } from '@/lib/api/transport';
import type { LoginResult } from '@/lib/api/schemas';

export const dynamic = 'force-dynamic';

/**
 * El BFF: el unico sitio por donde el navegador habla con el backend.
 *
 * El navegador nunca ve `BACKEND_URL` ni el token. Habla con `/api/proxy`, y
 * esta ruta traduce esa peticion, pega al backend con la cookie, y devuelve el
 * sobre tal cual. Lo unico que hace aparte es poner la cookie tras un login
 * correcto.
 */

const handler = (req: NextRequest) => proxyHandler(req);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;

/**
 * Que el endpoint sea una ruta real del backend y no una URL arbitraria.
 *
 * Esto **no** es un filtro de entrada: quien llama ya es nuestro propio
 * `proxyClient`, que solo pide endpoints que conoce. Es una guarda para que
 * este fichero no se convierta, por descuido, en un proxy abierto a cualquier
 * sitio desde el dominio del front.
 */
function validEndpoint(endpoint: string | null): endpoint is string {
  if (!endpoint || !endpoint.startsWith('/')) return false;
  if (endpoint.includes('..') || endpoint.includes('//')) return false;
  return true;
}

function setSession(res: NextResponse, valor: string, maxAge: number): void {
  res.cookies.set(SESSION_COOKIE, valor, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
}

async function proxyHandler(req: NextRequest): Promise<NextResponse> {
  const endpoint = new URL(req.url).searchParams.get('endpoint');
  if (!validEndpoint(endpoint)) {
    return NextResponse.json({ message: 'endpoint invalido' }, { status: 400 });
  }

  const noBody = req.method === 'GET' || req.method === 'HEAD';
  const rawBody = noBody ? undefined : await req.text();

  const token = req.cookies.get(SESSION_COOKIE)?.value;

  const r = await fetch(`${BACKEND_URL}${endpoint}`, {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      ...(await clientIpHeader()),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: rawBody || undefined,
  });

  if (r.status === 204) return new NextResponse(null, { status: 204 });

  const sobre = (await r
    .json()
    .catch(() => null)) as ApiResponse<LoginResult> | null;
  const res = NextResponse.json(sobre, { status: r.status });

  if (endpoint === '/auth/login' && r.ok && sobre?.data?.accessToken) {
    setSession(res, sobre.data.accessToken, SESSION_MAX_AGE);
  }

  return res;
}