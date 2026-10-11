# Bookmice

Clon de Goodreads. Monorepo con dos apps: un backend NestJS y un front Next.js
que habla con él a través de un BFF.

## Qué necesitas

- **Node 24.21.0**, con `nvm` instalado
- **pnpm**, que se activa solo con el `packageManager` del `package.json` raíz
- **Docker**, solo para la base de datos

No hace falta instalar pnpm a mano: el repositorio lleva `corepack` activado en
la imagen de Docker, y en local `corepack enable` una vez lo deja listo.

## Arrancar por primera vez

Son cuatro pasos, en este orden.

### 1. Node

```bash
nvm use
```

La versión sale del `.nvmrc` de la raíz, que es la misma que usan las imágenes de
Docker. Si da error, es que no tienes `nvm`: `nvm install` primero.

### 2. Dependencias

```bash
pnpm install
```

**Siempre desde la raíz**, nunca desde dentro de una app. Es un workspace de pnpm
con un único `pnpm-lock.yaml`, y las dos apps comparten ese mismo lockfile.

### 3. La base de datos

```bash
cd apps/services/monolith
docker compose up -d
```

**Desde esa carpeta, no desde la raíz.** El `compose.yml` lee su `.env` de al
lado, y desde la raíz el servicio de Adminer se queda sin puertos sin dar ningún
error: `docker compose config` sale bien y el contenedor no publica nada.

Con esto levantas Postgres en el `DB_PORT` del `.env` y Adminer en el
`ADMINER_PORT`, para mirar las tablas en el navegador si te apetece.

### 4. Variables de entorno

Las dos apps necesitan un `.env` propio. Si no existen, copia los ejemplos:

```bash
cp apps/services/monolith/.env.example apps/services/monolith/.env
cp apps/clients/web/.env.example apps/clients/web/.env
```

En el del monolith hay que rellenar la contraseña de la base y el `JWT_SECRET`,
que son secretos de verdad: no hay valor por defecto que valga.

```bash
# genera uno de 32 bytes
openssl rand -base64 32
```

**Sin comillas en los valores.** No es estética: `dotenv` las quita, pero el
`--env-file` de `docker run` no siempre, y Kubernetes menos. Con
`DB_SCHEMA="monolithschema"` el arranque falla con:

```
DB_SCHEMA=""monolithschema"" no es un identificador válido
```

Es decir: funciona en local y revienta en el contenedor. Solo hacen falta
comillas si el valor trae espacios dentro.

## Arrancar

Con la base de datos ya levantada, desde la raíz:

```bash
pnpm dev
```

Levanta las dos apps a la vez. La API en el `PORT` del monolith y el front en el
`3000`.

Para levantar solo una:

```bash
pnpm dev:api    # solo el backend
pnpm dev:web    # solo el front
```

El front necesita el backend en marcha para todo lo que vaya más allá de la
portada: el navbar pregunta `/me`, y el login va contra `/api/proxy`.

## Comandos

Todos desde la raíz del repo.

| Qué | Comando |
|---|---|
| Levantar las dos apps | `pnpm dev` |
| Solo la API | `pnpm dev:api` |
| Solo el front | `pnpm dev:web` |
| Compilar | `pnpm build` |
| Lint | `pnpm lint` |
| Tests | `pnpm test` |
| Tests con cobertura | `pnpm test:cov` |
| Formatear | `pnpm format` |

Hay versiones con sufijo para una sola app: `build:api`, `build:web`, `lint:api`,
`lint:web`, `test:api`.

**Para los tests, `pnpm test:cov` y no `pnpm test`.** El de siempre no recoge
cobertura, así que los mínimos de cobertura **no se comprueban**: no es que
 fallen, es que nadie los mira, y el comando pasa en verde.

## Docker

Las dos imágenes se construyen **desde la raíz del repo**, no desde la carpeta de
cada app:

```bash
docker build -f apps/services/monolith/Dockerfile -t bookmice-api .
docker build -f apps/clients/web/Dockerfile       -t bookmice-web .
```

El contexto es el repo entero porque es un workspace de pnpm: sin el
`pnpm-lock.yaml` y el `pnpm-workspace.yaml` de la raíz, la instalación no tiene
contra qué trabajar.

En GitHub Actions esto ya está hecho. Las imágenes se publican en GHCR **solo al
crear un tag**:

```bash
git tag -a v0.1.0 -m "primera versión"
git push origin v0.1.0
```

Cada imagen sale con dos etiquetas: la del commit, que es la que se despliega, y
la de la versión, que es la que se lee. Los tags van **siempre de tres partes**:
`v1.2` no dispara nada.

## Migraciones

Solo hay base de datos en el backend. Las migraciones se aplican solas al
arrancar: `ensureSchema` crea el schema si no existe y TypeORM aplica lo que
falte.

Para crear una migración nueva, desde `apps/services/monolith`:

```bash
pnpm migration:generate src/migrations/Algo.ts
```

La ruta es **relativa a esa carpeta**, no a la raíz del repo.

## Cuando algo va mal

**El frontend da error al pedir datos.** Es casi siempre que la API no está
levantada, o que `BACKEND_URL` no apunta bien. El front solo habla con el
backend por `/api/proxy`.

**El backend se queda reintentando la conexión.** Postgres no está levantado.
Vuelve al paso 3.

**`pnpm install` dentro de una app parece no hacer nada.** Se ejecuta en la raíz.

**Falta `pnpm-lock.yaml` o sale `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`.** Se cambió
un ajuste del workspace y hay que regenerar el lockfile:

```bash
pnpm install --no-frozen-lockfile
```

**Docker dice `unable to find user nodejs`.** Esa imagen usa el usuario `node`.
Aparece si alguien copió el `Dockerfile` de la variante Debian, donde el grupo es
`nogroup` y el usuario `nodejs`.

## Más dentro

El detalle de cada parte está en los `AGENTS.md`:

- `apps/services/monolith/AGENTS.md`: la arquitectura del backend, por módulos y
  capas, y las decisiones que parecen errores y no lo son.
- `apps/clients/web/AGENTS.md`: el front, el BFF y la generación del contrato.
- `apps/clients/web/CONTRATO.md`: por qué los tamaños del openapi son bytes.
- `AGENTS.md` de la raíz: el workspace, el Docker y los workflows.

Léelos antes de tocar código: casi todo lo que parece raro aquí está
explicado en uno de ellos.