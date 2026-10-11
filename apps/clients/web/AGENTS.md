<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Web

Frontend del clon de Goodreads. Next.js 16 con App Router.

> Lo de arriba lo genera `next dev`. **No lo edites ni lo borres.** Escribe
> aquí debajo.

## Dónde está el resto de la documentación

- `apps/services/monolith/AGENTS.md`: la arquitectura del backend. Léelo antes
  de tocar una llamada a la API, porque de ahí sale el contrato.
- `CONTRATO.md`, aquí al lado: por qué el `maxLength` de la contraseña son
  bytes en el servidor y caracteres en el contrato.

## Estado actual

```
src/app/            la App Router: layout, theme, portada, login y register
src/app/api/proxy/  el BFF: proxy y logout
src/lib/api/        los dos transportes, el sobre y los tipos del contrato
src/proxy.ts        quién ve el login y quién no
```

Funciona de punta a punta: registro, login, cookie de sesión y logout. La
portada es un texto de bienvenida; no hay catálogo todavía.

## Habla con el backend por el contrato, no importando código

Este proyecto **no importa nada** del monolith. Se comunica con la API por su
contrato OpenAPI.

El contrato se genera **en vivo**, contra el backend levantado:

```
backend andando  ->  GET localhost:8080/api-json  ->  src/lib/api/generated.ts
```

```bash
pnpm gen:live
```

**Hay que levantar el backend primero.** No hay `openapi.json` commiteado, y es
deliberado: el que se generaba con `ts-node` salía con los DTO vacíos, porque
`@nestjs/swagger/plugin` es un transformador de compilador y `ts-node` no lo
aplica. Un contrato commiteado que miente es peor que ninguno. La comparación
está en el `AGENTS.md` de la raíz.

`src/lib/api/schemas.ts` es la única puerta a esos tipos: nada importa
`generated.ts` directamente.

## BFF y cliente

El BFF vive **dentro de este proyecto** (`app/api/`), y el cliente también
(`lib/api/`). Es la disposición actual y es la correcta mientras haya un solo
frontend.

### Los dos transportes, y por qué están duplicados

Van a haber dos formas de llamar al backend, y **la duplicación entre ellas es
intencionada**. No la refactorices.

- `lib/api/server/` — se ejecuta en el servidor. Empieza cada fichero con
  `import 'server-only'`, lee la cookie de sesión y llama al backend por
  `BACKEND_URL`.
- `lib/api/client/` — se ejecuta en el navegador. Pasa por la ruta del proxy en
  este proyecto.

Los dos manejan el envelope de la API igual (desenvuelven `data`, convierten
errores en `ApiError`). Parece que debería haber un helper compartido, pero
**no puede haberlo**: el de `server/` está marcado `server-only` a propósito, y
importarlo desde el navegador rompe el build.

Si encuentras una tercera copia de la lógica del envelope, ese es el momento de
plantear un tipo compartido que no importe nada de servidor ni de cliente, no de
importar uno de los dos.

### La cookie de sesión es `httpOnly` y el token no llega al cliente

Regla dura: **el token nunca se toca desde el JavaScript del navegador.** Ni en
`localStorage`, ni en estado de React, ni en una query string.

El flujo es: el login va al backend, el proxy recibe el token en la respuesta y
lo guarda en una cookie `httpOnly`; a partir de ahí el navegador solo tiene la
cookie y nunca ve el token.

Cuando el proxy recibe un 401 desde una ruta que no es de autenticación,
significa que la sesión murió: borra la cookie y manda a `/login`. Eso está en
`proxyClient` de `lib/api/client/`, y el motivo de recargar la página entera en
vez de navegar es que la sesión acaba de morir y hay que tirar el estado del
cliente, no solo cambiar de ruta.

### El navbar vive en `(public)/layout.tsx`, no en el layout raíz

El navbar se decide por **dónde cuelga una página**, no por una condición dentro
del componente. `(public)/layout.tsx` lo monta y `(auth)` no, y con eso `/login`
y `/register` se quedan sin barra sin escribir ni un `if`.

**No lo muevas al layout raíz** para que aparezca en todas partes: entonces
habría que condicionarlo, y volvería a ser una decisión en runtime en vez de una
de estructura.

`AppNavbar` es un **Server Component** y tiene que serlo: decide si hay sesión
leyendo la cookie, y la cookie es `httpOnly`, así que el navegador no la ve. Si
fuera un componente cliente, habría que exponerle el estado de sesión, que es
justo lo que la cookie `httpOnly` evita.

Lo que sí necesita JavaScript (el botón de salir) está en `LogoutButton`, dentro
de `src/components/`.

Con sesión llama a `GET /me`. **Un 401 ahí no es un error**, es una cookie
caducada: se pinta el navbar de invitado. Si propagara el error, la portada
entera dejaría de pintar para cualquiera que tuviera una sesión vieja, que es
normal que pase.

`avatarUrl` **siempre** es `null` por ahora, porque el alta no pide avatar. De ahí
las iniciales: es el caso normal, no la excepción.

### El proxy es un reenviador

`app/api/proxy/route.ts` acepta un `?endpoint=` y lo reenvía al backend. Hay
una guarda que rechaza rutas con `..` o `//`.

El patrón tiene un coste: **cualquier ruta nueva del backend queda accesible
desde el navegador sin declarar nada**. No es un problema de seguridad (el
backend es quien autoriza, con el guard de sesión), pero sí de visibilidad:
nadie sabe de un vistazo qué está expuesto.

Si eso molesta, la solución es una lista de rutas permitidas en el proxy. No
cambies el patrón por otra cosa sin motivo.

## Cuando haya más frontends

Hoy todo cabe aquí: BFF y cliente viven en este proyecto. Cuando aparezca un
segundo frontend (un desktop, por ejemplo), esa disposición deja de funcionar y
se reparte:

- el **cliente generado** va a `packages/`, para que cada frontend importe solo
  lo que necesita en vez de duplicarlo
- el **BFF** va a `apps/bffs/`, porque es lógica de servidor y no depende del
  framework del frontend

Esa mudanza no hace falta hoy. Y cuando se haga, el contrato en vivo **no** es un
obstáculo: cada servicio publicará el suyo en su `/api-json`, y este proyecto
apuntará al que le toque. Lo que se muda es **dónde vive** el cliente generado,
no cómo se obtiene.

Un apunte de por qué el contrato va en vivo, que no tiene nada que ver con esto:
`@nestjs/swagger/plugin` es un transformador de compilador, y `ts-node` no lo
aplica, así que el `openapi.json` que se commiteaba salía con los DTO vacíos.
Ver _Habla con el backend por el contrato_ más arriba.

## Comandos

```bash
pnpm dev:web       # desde la raíz del repo
pnpm build:web
pnpm lint:web
pnpm gen:live      # tipos del contrato; requiere el backend andando
```

Están todos en la raíz, porque hay un **workspace de pnpm** con un único
`pnpm-lock.yaml`. `pnpm dev` a secas levanta las dos apps a la vez; para trabajar
solo con el front, `pnpm dev:web`.

`pnpm gen:live` también está en la raíz, y es el que se usa para los contratos.

**No hay tests.** Ni runner ni `*.spec.*`. Lo único que falla el build es el
typecheck y el lint, y eso no comprueba comportamiento. Para el flujo de auth se
verifica a mano contra el backend real.

### El linter no usa `eslint-config-next`

Esto es lo primero que te va a sorprender si vienes de un proyecto Next de los
de antes, y **no lo cambies por "`así se hace`"**: `eslint-config-next` no
funciona aquí.

Depende de `eslint-plugin-react@^7.37.0`, que no soporta ESLint 10 y revienta al
cargar cualquier regla suya:

```
TypeError: Error while loading rule 'react/require-render-return':
  contextOrFilename.getFilename is not a function
```

Ese plugin no tiene versión que lo arregle: `7.37.5` es la última, lleva un año
sin publicarse, y su dist-tag `next` apunta a una release candidate más antigua.

Lo que hay en su lugar, en `eslint.config.mjs`:

- `@eslint-react/eslint-plugin` para las reglas de React. Soporta ESLint 10 y
  cubre **React Server Components**, que `eslint-plugin-react` no conocía.
- `@next/eslint-plugin-next` para las reglas propias de Next, que es el plugin
  sin la capa de config.
- Las de accesibilidad y de Next que `eslint-config-next` añadía aparte del
  plugin **no están**: hay que listarlas a mano. De momento solo hacen falta
  `no-html-link-for-pages` y `no-img-element`. Si necesitas otra, mira cuáles
  usa `eslint-config-next` y cópiala al bloque de reglas de `@next/next`.

Son ~158 reglas activas. Si `pnpm lint:web` falla tras un `pnpm install` sin que
nadie toque código, lo primero que hay que mirar es si `@eslint-react` movió
algo: publica seguido.

## Trampas

**El proxy de sesión (`src/proxy.ts`) no valida el token.** Solo mira que la
cookie exista. Validarlo obligaría a llamar al backend en cada carga de página,
y lo único que decide es a dónde va el visitante. Si el token está muerto, la
petición que haga devuelve 401 y `proxyClient` lo manda a `/login`.

Su `matcher` es solo `/login` y `/register`: quien ya tiene cookie no los ve.
La portada `/` **no** está en el matcher a propósito, porque es pública y
muestra el botón de entrar cuando no hay sesión. Ponerla dentro obligaría a
convertir la portada en una página que solo existe para gente con cuenta.

**Si algún día `next.config.ts` lleva `output: 'standalone'`, necesita
`outputFileTracingRoot`.** No lo tiene hoy, y por eso no está. El motivo es el
workspace: Next ve el `pnpm-lock.yaml` de la raíz, deduce que la raíz del
proyecto está dos niveles más arriba, y emite el standalone dentro de
`.next/standalone/apps/clients/web/`. En Docker, donde el contexto de build es
solo `apps/clients/web`, ese `COPY` apuntaría a la nada y el build falla con un
error que no menciona el monorepo.

Cuando se añada, va **junto** a `output` y no separado:

```ts
output: 'standalone',
outputFileTracingRoot: __dirname,
```

Es el mismo apunte que tiene el `AGENTS.md` del proyecto `portfolio`, que lo
descubrió por el camino difícil.

**El `Dockerfile` de `web` todavía no existe**, y cuando exista tiene que usar
el contexto de la **raíz del repo**, como el del monolith. Ver *El Dockerfile* en
el `AGENTS.md` del monolith, que explica el mecanismo del workspace entero.

Va antes que nada lo de `standalone`, porque sin esto el `COPY` falla con un error
que no menciona el monorepo:

```ts
output: 'standalone',
outputFileTracingRoot: __dirname,
```

**No hay CSS propio.** `globals.css` y `page.module.css` del `create-next-app`
se borraron: con `CssBaseline` de MUI, que está montado en `ThemeRegistry`, los
dos estorbaban. Si añades estilos, van en el `sx` de MUI o en un módulo nuevo,
no en un reset global.

**`src/proxy.ts` es el `middleware.ts` renombrado**, no otra cosa. En Next 16
`middleware` pasó a llamarse `proxy`. Solo va en el `matcher` de `/login` y
`/register`, para que quien ya tiene cookie no los vea. La portada `/` es
pública a propósito: muestra el botón de entrar cuando no hay sesión.
