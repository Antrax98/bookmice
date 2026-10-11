# syntax=docker/dockerfile:1

# ┌────────────────────────────────────────────────────────────┐
# │ Imagen del front (Next.js 16, App Router, SSR).            │
# │                                                             │
# │ EL CONTEXTO DE BUILD ES LA RAÍZ DEL REPO, no esta carpeta. │
# └────────────────────────────────────────────────────────────┘
#
# Es lo mismo que en el monolith, y por el mismo motivo: bookmice es un
# **workspace de pnpm con un único lockfile en la raíz**. Para instalar hace
# falta la raíz dentro del contexto.
#
# La diferencia con el monolith es que aquí el standalone de Next **no necesita
# `pnpm deploy`**: Next ya traza y copia los ficheros que el servidor usa, y lo
# deja en `.next/standalone/`. Es el mecanismo contrario al de Nest, así que aquí
# `injectWorkspacePackages` no aparece en el camino crítico.

# ── Base ──────────────────────────────────────────────────────────
# Node 24.21.0, la versión exacta que fija el `.nvmrc` de la raíz. Alpine es musl
# como libc estándar: no es "compatible con glibc", es otra libc. Por eso los
# binarios precompilados por plataforma son el punto delicado de esta imagen.
FROM node:24.21.0-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

# Un solo pnpm, fijado al `packageManager` de la raíz, igual que en el monolith.
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

# ── Dependencias ──────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

# Solo los MANIFIESTOS, para que esta capa se invalide únicamente cuando cambian
# las dependencias. Se copian los `package.json` de **las dos** apps aunque solo
# compilemos una: el lockfile tiene un bloque `importers` por proyecto y
# `--frozen-lockfile` compara contra todos.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/services/monolith/package.json apps/services/monolith/
COPY apps/clients/web/package.json apps/clients/web/

RUN pnpm install --frozen-lockfile --filter web

# ── Compilación ───────────────────────────────────────────────────
FROM deps AS build
WORKDIR /app

# Ahora sí, el código, en una capa aparte para no invalidar las dependencias.
COPY apps/clients/web apps/clients/web

# Compila Next. `BACKEND_URL` **no** se pasa aquí a propósito: no lleva
# `NEXT_PUBLIC_`, así que Next no lo inlinea en el bundle y el servidor lo lee de
# `process.env` al arrancar. Es lo que permite cambiar el backend sin recompilar.
#
# El `.next/standalone` sale en `apps/clients/web/.next/standalone`, **anidado**,
# y no en la raíz de `.next/standalone`: es la consecuencia de
# `outputFileTracingRoot` apuntando a la raíz del repo. Ver `next.config.ts`.
RUN pnpm --filter web build

# ── Imagen final ──────────────────────────────────────────────────
# Esta NO hereda de `base`: el runner no necesita pnpm ni el `PNPM_HOME`. Solo
# node y el standalone.
FROM node:24.21.0-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# `HOSTNAME=0.0.0.0` **no es opcional**. El `server.js` que genera Next lleva:
#
#   const hostname = process.env.HOSTNAME || '0.0.0.0'
#
# y Docker **pone `HOSTNAME` con el ID del contenedor**, así que sin esta línea
# el servidor intenta escuchar en un hostname que no existe. En local no se
# nota nunca; en Docker es un pod que no levanta, sin error claro.
ENV HOSTNAME=0.0.0.0

ENV NEXT_TELEMETRY_DISABLED=1

# Next standalone traza y copia los ficheros que el servidor necesita, pero
# **no** incluye `public/` ni `.next/static`: eso se copia a mano. Y va a
# `apps/clients/web/...` porque el `server.js` también vive ahí anidado.
COPY --from=build --chown=node:node /app/apps/clients/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/clients/web/.next/static ./apps/clients/web/.next/static
COPY --from=build --chown=node:node /app/apps/clients/web/public ./apps/clients/web/public

# El usuario `node` (uid 1000) viene en la imagen oficial. Ojo al nombre: aquí es
# `node`, no `nodejs` (ese par, usuario en grupo `nogroup`, es el de la variante
# Debian y en alpine no existe). Es el mismo detalle que ya cayó en el monolith.
USER node

EXPOSE 3000

# El healthcheck va contra `/`, que es dinámica porque `AppNavbar` llama a
# `cookies()`. Y **sin cookie no toca el backend**: el healthcheck no depende de
# que la API esté viva, solo de que el servidor de Next responda.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/" > /dev/null 2>&1 || exit 1

# `exec` para que el shell no quede como PID 1 y no reciba el SIGTERM del
# apagado. Mismo motivo que en el monolith: sin él el pod tarda en morir.
CMD ["node", "apps/clients/web/server.js"]