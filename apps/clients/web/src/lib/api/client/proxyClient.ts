import { REQUEST_TIMEOUT_MS } from '../../config';
import { ApiError } from '../apiError';
import type { ApiResponse, HttpMethod } from '../transport';

export interface ProxyClientParams {
  endpoint: string;
  method?: HttpMethod;
  body?: unknown;
}

export async function proxyClient<T>({
  endpoint,
  method = 'GET',
  body,
}: ProxyClientParams): Promise<T> {
  const res = await withTimeout((signal) =>
    fetch(`/api/proxy?endpoint=${encodeURIComponent(endpoint)}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    }),
  );

  // Un 401 desde /auth/* son credenciales malas y lo muestra el formulario.
  // Desde cualquier otro sitio significa que la sesión murió.
  if (res.status === 401 && !endpoint.startsWith('/auth/')) {
    await fetch('/api/proxy/logout', { method: 'POST' });
    // Recarga completa a propósito, y no router.push(): esto no es un
    // componente y no hay router a mano, pero sobre todo la sesión acaba de
    // morir y conviene tirar el estado del cliente entero en vez de navegar
    // dentro de la misma aplicación con datos ya inválidos en memoria.
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  if (res.status === 204) return null as T;

  const envelope = (await res
    .json()
    .catch(() => null)) as ApiResponse<T> | null;

  if (!res.ok) {
    throw new ApiError(
      res.status,
      envelope?.message ?? `Error ${res.status}`,
      envelope?.errors ?? [],
    );
  }

  return envelope?.data as T;
}

async function withTimeout(run: (signal: AbortSignal) => Promise<Response>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await run(controller.signal);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La petición tardó demasiado. Inténtalo de nuevo.', { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
