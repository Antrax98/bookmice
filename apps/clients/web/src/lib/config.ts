export const BACKEND_URL: string =
  process.env.BACKEND_URL ?? 'http://localhost:8080';

export const SESSION_COOKIE = 'session';
export const SESSION_MAX_AGE = 60 * 60;

export const REQUEST_TIMEOUT_MS = 10_000;
