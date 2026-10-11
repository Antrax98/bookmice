import { proxyClient } from './proxyClient';

import type {
  LoginRequest,
  LoginResult,
  RegisterRequest,
  RegisterResult,
} from '../schemas';

export const authApi = {
  login: (body: LoginRequest) =>
    proxyClient<LoginResult>({
      endpoint: '/auth/login',
      method: 'POST',
      body,
    }),

  // No devuelve token: registrarse no inicia sesion. El backend devuelve el
  // id y el nombre del usuario, y a partir de ahi hay que hacer login.
  register: (body: RegisterRequest) =>
    proxyClient<RegisterResult>({
      endpoint: '/auth/register',
      method: 'POST',
      body,
    }),

  // Va contra la ruta del BFF, no contra el backend: lo que se destruye es la
  // cookie, y eso solo existe aqui.
  logout: () =>
    fetch('/api/proxy/logout', { method: 'POST' }).then(() => undefined),
};
