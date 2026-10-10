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

## Un workspace de pnpm, un solo lockfile

La raíz tiene `package.json`, `pnpm-workspace.yaml` y `pnpm-lock.yaml`.
**`pnpm install` se ejecuta desde la raíz**, y las apps no tienen lockfile propio.

El glob es `apps/*/*`, porque los proyectos están dos niveles abajo. Ver *El
glob del workspace es `apps/*/*`* más abajo, que explica por qué `apps/*` parece
funcionar y no instala nada.

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

La versión está fijada en el `.nvmrc` **de la raíz**, y en `engines` del
`package.json` raíz. Antes vivía solo en `apps/services/monolith/.nvmrc`,
porque solo el backend declaraba `engines`; con el workspace, un solo sitio
basta.

```bash
nvm use          # desde la raíz
```

Subirlo a la raíz significa que **todas** las apps comparten la versión. Hoy
`web` no declara `engines`: Next 16 pide Node >=20.9 y corre de sobra en
24.21.0. Si alguna app necesitara una versión distinta, se documenta aquí y se
avisa, porque en un workspace hay un único `node_modules` y un único
`packageManager` para todas.

El `PATH` para trabajar sin `nvm use` en cada terminal:

```bash
export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH"
```

## Comandos

Hay un **workspace de pnpm** en la raíz: un solo `pnpm-lock.yaml`, y `pnpm install`
se ejecuta desde la raíz, nunca desde una app.

```bash
pnpm install      # desde la raíz, siempre
pnpm build        # las dos apps
pnpm lint
pnpm test
```

Y para una sola app, con `--filter`:

```bash
pnpm build:api    # = pnpm --filter monolith build
pnpm build:web
pnpm lint:api
pnpm test:api
```

**Los dos modos existen a propósito.** `pnpm dev` levanta las dos apps a la vez,
que es lo normal cuando se trabaja en el front contra el backend. Pero para
generar un contrato OpenAPI hace falta **solo** la API levantada, y `pnpm dev`
levanta también el front. Para eso están los scripts con sufijo:

```bash
pnpm dev:api      # solo el monolith, en primer plano
pnpm gen:live     # desde la raíz, lee localhost:8080/api-json
```

Si un día hay varias APIs y cada una publica su contrato, esto es lo que hace
falta: una en primer plano, y el resto en segundo plano.

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

## El glob del workspace es `apps/*/*`, no `apps/*`

Los proyectos están **dos niveles** abajo: `apps/services/monolith` y
`apps/clients/web`. `apps/*` baja un solo nivel y encuentra `apps/services`,
`apps/clients` y `apps/bffs`, que son carpetas sin `package.json`.

Con el glob equivocado no hay error visible: pnpm dice `Already up to date`,
escribe un `pnpm-lock.yaml` con **un solo importer, `.`**, y se queda tan
contento. Los 934 paquetes no se instalan y el `node_modules` de la raíz queda
con dos ficheros sueltos.

Cuando se añada `apps/bffs/api`, `apps/*/*` la recoge sin tocar el glob.

## `allowBuilds` es global, y por eso se unificó

En un workspace, `allowBuilds` es **un único mapa en la raíz**. No se puede
repartir por app como estaba antes de la migración, y por eso los dos
`pnpm-workspace.yaml` de las apps desaparecieron.

La unificación salió gratis porque los ajustes no se contradician de verdad:

| paquete | monolith | web | decisión |
|---|---|---|---|
| `@parcel/watcher` | sí | no | `true` |
| `@scarf/scarf` | sí | no | `true` |
| `unrs-resolver` | sí | no | `true` |
| `sharp` | no | sí | `false` |

Parecía un conflicto `unrs-resolver` en `true` contra `false`, pero **web no
tiene el paquete en su árbol**: su `false` era un resto. Con `true` en la raíz no
le afecta. Que un paquete no exista en una app da igual, porque pnpm solo mira
los que están.

`sharp: false` es una decisión de `web`, no un olvido: es lo que evita su
postinstall.

## `minimumReleaseAgeExclude` no era inerte (corrección)

Se creyó durante la migración que la lista estaba inerte, porque no había un
`minimumReleaseAge` delante. **Era falso**, y cuesta saberlo porque no hay
ningún sitio donde salga:

- `pnpm config get minimumReleaseAge` devuelve `undefined`, porque `config get`
  no muestra los valores por defecto.
- El valor sí aparece en `node_modules/.pnpm-workspace-state-v1.json`, que
  guarda los ajustes **resueltos**.

pnpm 11 pone `minimumReleaseAge: 1440` (**24 horas**) por defecto. Así que los
`@eslint-react/*` de la lista estaban evitándose el filtro de antigüedad a
propósito, desde el commit inicial.

La lista subió a la raíz porque en un workspace también es global. Si se
hubiera quedado en el `pnpm-workspace.yaml` de `web`, habría dejado de excluir.

**Para ver los ajustes reales**, no uses `pnpm config get`:

```bash
cat node_modules/.pnpm-workspace-state-v1.json | grep -A3 minimumReleaseAge
```

## Contrato de API

`web` habla con el backend mediante el contrato OpenAPI, no importando código
de él. El contrato se genera **en vivo**, contra el `/api-json` del backend
levantado:

```
backend andando  ->  GET /api-json  ->  web/src/lib/api/generated.ts
```

**No hay `openapi.json` commiteado.** Hubo, y se quitó porque generaba un
contrato **falso**: los DTO salían con `properties: {}`, sin un solo tipo.

El motivo es concreto. `nest-cli.json` activa `@nestjs/swagger/plugin`, que es un
**transformador de compilador**, y los transformadores solo los aplica
`nest build` y `nest start`. Un script con `ts-node` compila **sin** él, así que
las clases no llevan `_OPENAPI_METADATA_FACTORY` y Swagger no tiene nada que
leer. Comprobado con `curl`, no supuesto:

| | `properties` de `RegisterDto` |
|---|---|
| `/api-json` en vivo | `email/format:email`, `password/minLength:12/maxLength:72`, `username`, `fullName` |
| generado con `ts-node` | `{}` |

El precio de ir en vivo es que **`web` necesita el backend andando** para
regenerar sus tipos (`pnpm gen:live`). Se paga willingly: un contrato commiteado
que miente es peor que no tener contrato, porque parece la fuente de verdad y
nadie se avisa de que está viejo.

Cuando el backend se parta en microservicios reales, cada uno publicará su
propio contrato y `packages/` contendrá los clientes generados, para que los
`web` y `desktop` importen solo lo que necesitan. Esa estructura está prevista
en el repo pero no hace falta crearla hasta que exista el primer servicio
separado.

## Dónde está el resto de la documentación

- `apps/services/monolith/AGENTS.md`: la arquitectura del backend, con detalle.
  Léelo antes de tocar código del monolith.
- `apps/clients/web/AGENTS.md`: avisos de ese proyecto.
- `apps/clients/web/CONTRATO.md`: por qué `maxLength` del openapi son bytes.

El del `web` tiene dos partes, y no hay que confundirlas. El bloque entre
`<!-- BEGIN:nextjs-agent-rules -->` y `<!-- END:... -->` **lo genera Next.js** y
`next dev` lo re-inserta si falta: no se toca. Todo lo que hay **por debajo** es
nuestro y se edita a mano.

Los ficheros de `bffs/` y `packages/` están vacíos a propósito, así que no tienen
documentación. Cuando uno reciba algo, se le escribe la suya aquí.
