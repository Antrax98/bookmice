import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * `outputFileTracingRoot` tiene que ser **la raíz del repo**, no `__dirname`.
 *
 * Bookmice es un workspace de pnpm con el único lockfile en la raíz, así que
 * los ficheros de `next` no están en `apps/clients/web/node_modules` sino dos
 * niveles más arriba, en `/app/node_modules/.pnpm/…`.
 *
 * Next calcula dónde cae cada fichero del standalone con
 * `path.relative(tracingRoot, tracedFilePath)`, y luego lo escribe en
 * `path.join('.next/standalone', eseRelative)`. Con `__dirname` el relative de
 * `next` sale `../../../node_modules/.pnpm/…`, y el `join` lo escribe FUERA de
 * `.next/standalone/`, en el árbol de fuentes. El standalone se queda sin
 * `node_modules` y el arranque muere con `Cannot find module 'next'`.
 *
 * El error no dice nada de monorepos, que es lo que lo hace difícil de
 * diagnose. Next solo valida que la ruta sea absoluta; que apunte al sitio
 * correcto no lo comprueba.
 *
 * Next **deduciría** la raíz sola (`find-root.js` busca `pnpm-workspace.yaml`
 * antes que lockfiles, y lo encuentra), pero se pone explícita a propósito: si
 * el repo se mueve de sitio o el marcador del workspace cambia de nombre, el
 * fallo tiene que ser un `next.config.ts` que se ve, no un `COPY` del
 * `Dockerfile` que no encuentra nada.
 *
 * Esto **corrige** lo que decía antes el `AGENTS.md` de esta app, que
 * recomendaba `__dirname`. Venía del proyecto `portfolio`, que no era un
 * workspace de pnpm y ahí sí funcionaba.
 */
const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../..'),
};

export default nextConfig;