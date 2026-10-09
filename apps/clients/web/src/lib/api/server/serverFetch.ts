import 'server-only';

import { cookies } from 'next/headers';
import { BACKEND_URL, REQUEST_TIMEOUT_MS, SESSION_COOKIE } from '../../config';
import { ApiError } from '../apiError';
import { clientIpHeader } from './clientIp';
import type { ApiResponse, HttpMethod } from '../transport';

export { ApiError };

export interface ServerFetchParams {
  endpoint: string;
  method?: HttpMethod;
  body?: unknown;
  auth?: boolean;
}

export async function serverFetch<T>({
  endpoint,
  method = 'GET',
  body,
  auth = false,
}: ServerFetchParams): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await clientIpHeader()),
  };

  if (auth) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}${endpoint}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(504, `El backend no respondió a tiempo (${endpoint})`);
    }
    throw new ApiError(
      503,
      `No se pudo contactar con el backend (${endpoint})`,
    );
  } finally {
    clearTimeout(timer);
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
