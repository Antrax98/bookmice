# syntax=docker/dockerfile:1

# ┌────────────────────────────────────────────────────────────┐
# │ Imagen de la API (NestJS + TypeORM + Postgres).            │
# │                                                             │
# │ EL CONTEXTO DE BUILD ES LA RAÍZ DEL REPO, no esta carpeta. │
# └────────────────────────────────────────────────────────────┘
#
# Es lo que cambia respecto a un proyecto suelto, y no es un detalle. Bookmice
# es un **workspace de pnpm con un único lockfile en la raíz**, así que para
# instalar hay que estar en la raíz y con la raíz dentro del contexto. Por eso
# los primeros `COPY` son del workspace entero, no de `apps/...`.
#
# En una imagen por app, `COPY apps/services/monolith .` y listo. Aquí no: sin
# `package.json`, `pnpm-lock.yaml` y `pnpm-workspace.yaml` en el contexto,
# `pnpm install --frozen-lockfile` no tiene contra qué trabajar, y el build falla
# sin un mensaje que señale el motivo.

# ── Base ──────────────────────────────────────────────────────────
# Node 24.21.0, la versión exacta que fija el `.nvmrc` de la raíz y el `engines`
# del `package.json` raíz. Pinar a la exacta y no a `24` a propósito: `engines`
# dice `>=24.21.0` y una imagen con 24.9 compila pero no es la que probaste.
FROM node:24.21.0-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

# Un solo pnpm, fijado a la versión del `packageManager` de la raíz. `corepack
# prepare` la instala y la activa; no hace falta el instalador de get.pnpm.io,
# que además lo deja en un sitio distinto del que espera corepack.
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

# ── Dependencias ──────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

# libc6-compat: algunos binarios del toolchain de Nest esperan glibc en lugar de
# musl, y sin esto fallan con errores que no mencionan la libc.
RUN apk add --no-cache libc6-compat

# Solo los MANIFIESTOS. Esta capa se invalida únicamente cuando cambian las
# dependencias, no cada vez que tocas un `.ts`: por eso los fuentes van en la
# etapa de build, y no aquí.
#
# Se copian los `package.json` de **las dos** apps aunque solo compilemos una.
# No es redundancia: el lockfile tiene un bloque `importers` por proyecto del
# workspace, y `--frozen-lockfile` compara contra todos. Si faltara el de `web`,
# la comparación falla aunque no se vaya a instalar. Se comprobó.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/services/monolith/package.json apps/services/monolith/
COPY apps/clients/web/package.json apps/clients/web/

# `--filter monolith` instala solo esta app. Verificado: tras el install, web
# tiene 0 paquetes y el store no contiene ni un MUI ni un Next.
RUN pnpm install --frozen-lockfile --filter monolith

# ── Compilación ───────────────────────────────────────────────────
FROM deps AS build
WORKDIR /app

# Ahora sí, el código. En una capa aparte para no invalidar las dependencias.
COPY apps/services/monolith apps/services/monolith

RUN pnpm --filter monolith build

# ── Dependencias de producción ────────────────────────────────────
FROM base AS prod-deps
WORKDIR /app

# Otra vez solo manifiestos: el deploy necesita el lockfile para resolver las
# versiones exactas, no los fuentes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/services/monolith/package.json apps/services/monolith/
COPY apps/clients/web/package.json apps/clients/web/

# `pnpm deploy` deja un directorio **autocontenido**: las dependencias de
# producción de esta app y nada más. Sin `--legacy`, que es la vía antigua y solo
# funciona con symlinks.
#
# Esto es lo que hace que el workspace no rompa la imagen. Un install normal
# deja `apps/services/monolith/node_modules` con symlinks **relativos** a
# `../../../node_modules/.pnpm/`. Si copiaras solo el node_modules de la app,
# esos enlaces quedarían colgando y el módulo aparecería como inexistente, con un
# `Cannot find module` que no señala al symlink.
#
# Sale así porque `pnpm-workspace.yaml` tiene `injectWorkspacePackages: true`.
# Sin eso, pnpm 10+ se niega: `ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE`. Va en
# camelCase a propósito; en kebab-case lo ignora con un aviso y falla igual.
RUN pnpm --filter monolith deploy --prod /prod/monolith

# ── Imagen final ──────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# NO se fija `PASSWORD_LOG_N` aquí, y no es un olvido.
#
# `configuration.ts` ya hace esto:
#
#   password_log_n: parseInt(
#     process.env.PASSWORD_LOG_N ??
#       (process.env.NODE_ENV === 'production' ? '17' : '10'), 10)
#
# Con `NODE_ENV=production` de arriba, el default ya es 17 (128 MiB por hash).
# Fijarlo aquí hacía exactamente lo mismo que la app, y además BuildKit lo
# marcaba como secreto en cada build:
#
#   SecretsUsedInArgOrEnv: Do not use ARG or ENV instructions for sensitive
#   data (ENV "PASSWORD_LOG_N")
#
# Que es un falso positivo —no es un secreto, es el exponente de scrypt—, pero
# el aviso era ruido. La variable se sigue pudiendo fijar desde fuera, que es
# donde tiene sentido: en el manifiesto de k8s.
#
# El usuario `node` (uid 1000) **viene en la imagen oficial**, así que no hay
# que crear ninguno:
#
#   RUN addgroup -g 1000 node && adduser -u 1000 -G node -s /bin/sh -D node
#
# Ojo al nombre, que aquí se cayó: es `node`, **no `nodejs`**. Ese par es el de
# la variante Debian, con el usuario `node` en el grupo `nogroup`. En alpine no
# existe, y el `docker run` muere con:
#
#   unable to find user nodejs: no matching entries in passwd file
#
# El UID no importa mientras no se escriba en volúmenes montados, y esta app no
# escribe en disco: todo su estado vive en Postgres.
USER node

# El node_modules de producción sale del deploy, no de `deps`: así `typescript`,
# `@nestjs/cli` y `jest` no llegan a la imagen final.
COPY --from=prod-deps --chown=node:node /prod/monolith/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /prod/monolith/package.json ./
# El `dist` sale del **build**, no del deploy: el deploy copia los fuentes, y el
# código que se ejecuta es el compilado.
COPY --from=build --chown=node:node /app/apps/services/monolith/dist ./dist

EXPOSE 3000

# `/api` es la UI de Swagger. Sirve de healthcheck porque el guard global **no**
# la tapa: `SwaggerModule.setup` la monta con `httpAdapter.get(...)`, fuera del
# router de Nest. Y corre dentro del pod, así que no necesita Ingress.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api" > /dev/null 2>&1 || exit 1

# Las migraciones corren antes de arrancar la app, y son idempotentes: aplican
# solo las que falten, así que repetir en cada despliegue es lo correcto.
#
# El binario es `node_modules/.bin/typeorm` y el data-source es el **compilado**,
# `-d dist/database/data-source.js`. Las dos cosas importan:
#
# - El `migration:run` de `package.json` usa `typeorm-ts-node-commonjs`, que
#   necesita `ts-node` y los fuentes `.ts`, y ninguno de los dos existe aquí.
# - Y el data-source en `.ts` **no funciona** ni aunque los hubiera: importa
#   `./ensure-schema` sin extensión y el ts-node de TypeORM no lo resuelve en
#   ESM. Comprobado:
#     Error: Cannot find module '.../ensure-schema'
#       imported from .../data-source.ts
#
# El `migration:run:prod` de `package.json` ya apunta al `dist`, así que también
# valdría invocarlo. Se usa el binario a mano para que el orden con el arranque
# sea explícito.
CMD ["sh", "-c", "node_modules/.bin/typeorm migration:run -d dist/database/data-source.js && exec node dist/main.js"]