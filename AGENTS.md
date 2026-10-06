# Bookmice

Clon de Goodreads. Monorepo con pnpm.

## Dónde vive cada cosa

```
apps/
  services/
    monolith/     Backend NestJS. La API. Un solo despliegue.
  clients/
    web/          Frontend Next.js.
  bffs/           (vacío, previsto)
packages/         (vacío, previsto para código compartido)
```

Hoy solo `monolith` y `web` tienen contenido. `bffs` y `packages` están vacíos a
propósito: no crees un directorio hasta que tenga algo dentro.

## Un solo repositorio git

El repo es este, el de la raíz. **No debe existir un `.git` dentro de `apps/`.**

`nest new` y `create-next-app` crean su propio `.git` en el proyecto que
generan. Eso hace que un `git commit` desde dentro de `apps/services/monolith`
 vaya al repo equivocado, en vez de a este. Si lo encuentras, bórralo:

```bash
rm -rf apps/services/monolith/.git
```

Perder un repo recién creado sin commits no cuesta nada.

## Node

La versión está fijada en `apps/services/monolith/.nvmrc`, **no en la raíz**,
porque ahora solo el backend declara `engines`. Si añades otra app con requisitos
distintos, copia el patrón: cada app lleva su `.nvmrc`, o se sube a la raíz
cuando sean todos iguales.

```bash
nvm use          # desde apps/services/monolith
```

## Comandos

Cada proyecto se instala y se ejecuta por separado: **no hay workspace de pnpm
en la raíz**, y no lo hay a propósito (ver más abajo).

```bash
cd apps/services/monolith
pnpm install
pnpm build
pnpm lint        # ESLint + eslint-plugin-boundaries
pnpm test
```

En `web` es lo mismo, con sus scripts. Cada app tiene su `pnpm-lock.yaml`.

## Migraciones

Solo el backend tiene base de datos. Los comandos son de TypeORM:

```bash
pnpm migration:generate src/migrations/Algo.ts   # crea una migración desde los cambios en entidades
pnpm migration:run        # aplica las pendientes
pnpm migration:revert
```

La carpeta `src/migrations/` **aún no existe**: la crea el primer
`migration:generate`, y por eso `migration:generate` necesita un argumento con
la ruta del fichero.

## Por qué no hay workspace de pnpm

La raíz no tiene `package.json` ni `pnpm-workspace.yaml`, y esa es una decisión,
no un olvido. Con dos apps que no se hablan, un workspace obligaría a instalar
desde la raíz y a pasar los comandos por `--filter`, a cambio de una
coordinación que todavía no hace falta.

Cuando aparezca el tercer proyecto y haya código de verdad compartido, se
monta: `pnpm-workspace.yaml` en la raíz con `packages: [apps/*, packages/*]`,
un único `pnpm-lock.yaml`, y los `allowBuilds` de cada app unificados. El
monolith y `web` tienen ajustes distintos ahora mismo (`@parcel/watcher` y
`@scarf/scarf` en true en el primero; `sharp` y `unrs-resolver` en false en el
segundo), así que la migración hay que hacerla a conciencia.

## Contrato de API

`web` habla con el backend mediante el contrato OpenAPI, no importando código
de él. Cuando exista, el plan es:

- El monolith genera `openapi.json` y se commitea en el repo
- `web` genera su cliente embebido a partir de ese fichero

El fichero commiteado es lo que hace que `web` no necesite el backend andando
para regenerar sus tipos. Ver `apps/services/monolith/AGENTS.md` para el
detalle de cómo se genera.

Cuando el backend se parta en microservicios reales, cada uno publicará su
propio contrato y `packages/` contendrá los clientes generados, para que los
`web` y `desktop` importen solo lo que necesitan. Esa estructura está prevista
en el repo pero no hace falta crearla hasta que exista el primer servicio
separado.

## Dónde está el resto de la documentación

- `apps/services/monolith/AGENTS.md`: la arquitectura del backend, con detalle.
  Léelo antes de tocar código del monolith.
- `apps/clients/web/AGENTS.md`: avisos de ese proyecto. **Lo genera Next.js**,
  no es nuestro, y `next dev` lo reescribe. No lo edites a mano.
