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

## Las imágenes de Docker se construyen desde la RAÍZ

El contexto de build de las dos imágenes es **el repo entero**, no la carpeta de
la app. Es la consecuencia directa de ser un workspace: para instalar hace falta
la raíz, con su `package.json`, su `pnpm-lock.yaml` y su `pnpm-workspace.yaml`.

Cada `Dockerfile` copia **los dos** `package.json` de las apps aunque solo compile
una. No es redundancia: el lockfile tiene un bloque `importers` por proyecto, y
`--frozen-lockfile` compara contra todos. Si faltara el de `web`, la comparación
falla aunque no se vaya a instalar. Comprobado.

Y `pnpm install --filter monolith` instala **solo esa app**: tras el install,
`web` tiene 0 paquetes y el store no contiene ni un MUI ni un Next. Comprobado
también.

### `injectWorkspacePackages: true` es lo que hace funcionar `pnpm deploy`

Va en `pnpm-workspace.yaml`, y **en camelCase**. En kebab-case pnpm lo ignora con
un aviso y el deploy falla igual:

```
[WARN] The following settings in pnpm-workspace.yaml were ignored because
they are not written in camelCase: "inject-workspace-packages"
[ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE]
```

Lo que cambia es cómo se resuelven las dependencias **entre paquetes del
workspace**: con `false` pnpm pone un symlink, con `true` copia el código. Importa
porque `pnpm deploy` construye un directorio para una imagen de Docker, y un
symlink que sale de ese directorio no sobrevive a un `COPY`.

Sin esto, las dos alternativas son malas:

- `--legacy`: la vía antigua, funciona, pero solo con symlinks. Se dejó de lado
  porque el plan es llenar `packages/` con permisos tipados compartidos, y ese es
  justo el caso en el que la inyección importa.
- install normal y copiar el `node_modules` de la app: `pnpm` deja symlinks
  **relativos** a `../../../node_modules/.pnpm/`. Copiar solo ese `node_modules`
  deja los enlaces colgando y el módulo aparece como inexistente, con un
  `Cannot find module` que no señala al symlink.

**Cambiar el ajuste obliga a regenerar el lockfile**, porque pnpm lo guarda ahí:

```
pnpm install --no-frozen-lockfile
```

Sin eso, todo `pnpm install --frozen-lockfile` falla con
`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`, que no dice nada de estos symlinks.

Hoy no cambia nada, porque **ninguna de las dos apps depende de la otra**. Se
comprobó: si algún día hubiera sido otro, el install lo habría notado.

## Hay dos workflows, y no es duplicado

| Fichero | Dispara con | Qué hace |
|---|---|---|
| `verificar.yml` | push a `master`, PR, a mano | lint, tests, typecheck, build. **No publica.** |
| `docker.yml` | **tags `v*.*.*`**, a mano | verifica y publica las dos imágenes en GHCR |

Publicar solo por tags es lo correcto: publicar en cada commit llena el registro
de imágenes que nadie despliega y gasta minutos de runner. Pero si el único
workflow escuchara a tags, **entre `v0.1.0` y `v0.2.0` nada comprobaría nada**, y
te enterarías de que `master` está roto el día que creas el tag: el fallo aparece
donde ya no se puede arreglar, con el código malo commiteado. Por eso están los
dos.

`docker.yml` **vuelve a verificar** en vez de confiar en el job del otro. No es
redundancia gratuita: un `workflow_run` ataría la publicación a que ese job
pasara **en esa ejecución concreta**, que es una acoplamiento frágil. Verificar
cuesta menos de un minuto; un `docker build`, del orden de minutos. Se paga.

### Las dos etiquetas de cada imagen

```
ghcr.io/<usuario>/bookmice-api:<sha>     <- la que fija ArgoCD
ghcr.io/<usuario>/bookmice-api:v0.1.0    <- la que se lee
```

El **SHA** es lo que ArgoCD despliega: dice exactamente qué commit va, sin
ambigüedad, y un rollback es cambiar una línea. La **versión** es para leer: en el
registro, `v0.1.0` dice algo y `a1b2c3d` no. Sin ella, saber qué hay desplegado
es comprobar commit por commit.

No hay etiqueta `latest` a propósito: con ella no hay forma de saber si el
cluster está al día.

Con `workflow_dispatch` no hay tag, así que `VERSION` queda vacía y solo se
publica la del SHA. Con eso un build manual **nunca pisa una versión**.

### El glob de tags es más laxo de lo que parece

Comprobado con `fnmatch` contra `v*.*.*`:

```
DISPARA  v0.1.0   v1.2.3   v10.20.30   v0.2.0-rc1   v0.1.0-beta
DISPARA  v1.2.3.4   va.b.c
NO       v1.2   v1   1.2.3
```

`v1.2` **no dispara nada**, y un tag mal escrito se descubre tarde, cuando ya te
preguntas por qué no se publicó. Los tags en este repo son **siempre de tres
partes**.

### El usuario de GHCR no se escribe

```yaml
username: ${{ github.actor }}   # quien lanza el workflow
# nombre: ${{ github.repository }}
```

Viene de variables de contexto. Escribirlo a mano es la forma de equivocarse, y
el error que sale habla de credenciales, no del nombre.

Lo que **sí** hace falta es normalizar a minúsculas, porque GitHub preserva
mayúsculas en usuarios y repos y **Docker las rechaza**:

```
invalid reference format: repository name must be lowercase
```

Ese error no parece hablar de login, que es lo que lo hace despistar.

### El nombre de usuario y el de GHCR van en minúsculas por culpa de Docker

El `tr` de `OWNER` no es decoración. Sin él, y con el usuario en mayúscula, el
build falla **después** de todos los pasos de verificación, que es el sitio más
caro para descubrirlo.

### `pnpm test` en CI es un check que no existe

Los workflows usan **`test:cov`**, y no por gusto. Un `pnpm test` a secas no
recoge cobertura, así que los `coverageThreshold` del `jest.config.ts` **no se
leen**. No es que la cobertura falle: es que nadie la mira.

Comprobado subiendo el umbral a un valor imposible:

```
pnpm test      -> exit=0     con statements: 1000
pnpm test:cov  -> exit=1     "does not meet global threshold (1000%)"
```

### `next build` ya no lintea, y `web` no tiene tests

Las dos razones por las que el paso de lint del workflow **no** es redundante
con el `docker build`:

- **Next 16 quitó `next lint` del build.** No hay ni el binario. O sea que el
  `Dockerfile` de `web` construye una imagen **sin lintear**, y el único sitio
  donde se lintea es ese paso.
- **`web` no tiene script `test`**, y el `--if-present` de la raíz lo hace pasar
  en silencio. Los dos workflows dan verde **sin comprobar el front**. Es a
  conciencia hasta que se escriban esos tests.

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
