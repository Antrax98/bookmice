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

## Estado actual

Esto es un `create-next-app` recién generado. Lo que existe:

```
src/app/         la App Router: layout, page, estilos
```

Lo que **no** existe todavía, y hay que crear: `lib/api/`, los tipos
generados del contrato, el proxy del BFF y el middleware de sesión. Ver
<<bff-y-cliente>> para cómo se montan.

## Habla con el backend por el contrato, no importando código

Este proyecto **no importa nada** del monolith. Se comunica con la API por su
contrato OpenAPI.

El flujo previsto:

```
monolith genera openapi.json → se commitea en el repo
                           → este proyecto genera sus tipos desde el fichero
```

Que el fichero esté commiteado es lo que hace que aquí **no necesites el backend
andando** para regenerar los tipos. Es mejor que ir contra el backend en vivo,
que es como funciona el proyecto `portfolio` y obliga a levantarlo primero.

El script para generarlos todavía **no existe** en este proyecto. Cuando se
escriba, el orden es: `openapi-typescript openapi.json -o lib/api/generated.ts`,
y después `lib/api/schemas.ts` es la única puerta a esos tipos.

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

Esa mudanza no hace falta hoy. Pero es la razón por la que el contrato se
genera desde un fichero y no contra el backend en vivo.

## Comandos

```bash
pnpm dev
pnpm build
pnpm lint
```

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

Son ~158 reglas activas. Si `pnpm lint` falla tras un `pnpm install` sin que
nadie toque código, lo primero que hay que mirar es si `@eslint-react` movió
algo: publica seguido.

## Trampas

**El proxy de sesión (`proxy.ts`) no valida el token.** Solo mira que la cookie
exista. Validarlo obligaría a llamar al backend en cada carga de una página
pública, y lo único que decide es qué botones pintar. Si el token está muerto,
el enlace al panel lleva al login, que es lo mismo que pasa aquí.

**`src/app/page.module.css`** viene del `create-next-app`. No lo borres sin
mirar si `page.tsx` lo importa.
