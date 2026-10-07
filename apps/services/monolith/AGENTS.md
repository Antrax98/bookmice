# Monolith

Backend del clon de Goodreads. NestJS + TypeORM + Postgres, en hexagonal.

## Las cuatro capas

Todo dentro de `src/modules/<nombre>/` está en una de estas cuatro carpetas. No
hay una quinta, y el linter lo comprueba.

| Capa | Qué es | Puede depender de |
|---|---|---|
| `domain` | Reglas, entidades, puertos de **escritura** | Nada. Ni el framework, ni otra capa, ni otro módulo |
| `application` | Casos de uso, puertos de **lectura** | `domain`, `application` |
| `infrastructure` | TypeORM, HTTP, adapters | Las tres |
| `composition` | El wiring puerto→adapter | Las tres, y solo el wiring |

Las flechas **están verificadas por `eslint-plugin-boundaries`**, que resuelve el
grafo de imports real. No es una convención que se respeta por buena voluntad:
si la violas, el error salta en el lint, y el mensaje explica qué hacer.

Que el grafo se resuelva de verdad importa por dos casos que la comprobación
por texto no pilla: `await import(...)` a otra capa, y un fichero mal nombrado
que esquiva un patrón de ficheros.

### Qué NO se testea

`infrastructure`. Un test atado a TypeORM o a HTTP se rompe cuando cambia el
adapter, que es justo lo que el puerto existe para evitar. Hay una regla que lo
prohíbe.

Los tests van en `domain` (modelos, value objects) y en `application` (flujos a
través del caso de uso). `domain` se testea directamente: son funciones puras,
y probarlas de forma directa es más barato y más claro que llegar a ellas a
través de un caso de uso.

## Tres decisiones que parecen errores y no lo son

### 1. `domain` no importa de otro `domain`

Está prohibido, incluso entre módulos del mismo proyecto. Cuando `review` necesite
el nombre de un usuario, **hace dos peticiones**: una a `review` y otra a
`user`, desde `application`. No importa el tipo.

**El coste es real** y se paga solo en los puntos donde dos módulos se
encuentran de verdad. A cambio, cualquier `domain` se puede leer y probar sin
conocer el de al lado.

Cuando el error de ESLint aparezca, la respuesta **no es** un `eslint-disable`.
Es replantear la dependencia.

### 2. `rating` y `review` son tablas separadas

Aunque se pregunte si no bastaría con una. El test que lo decide: **¿puede un
usuario calificar sin escribir reseña?** Sí, y es el caso mayoritario. Si la
calificación viviera dentro de la reseña, cada una de esas calificaciones sería
una reseña con el cuerpo vacío.

Además, tiene tres consecuencias que la tabla única no resuelve bien:

- **Ciclos de vida distintos.** Vuelves a calificar un libro tres años después.
  Tu reseña de hace tres años no cambia, y su fecha no debería moverse.
- **Reglas de validación distintas.** Las estrellas: entero de 1 a 5, siempre
  presente. El cuerpo: longitud máxima, puede no existir.
- **El agregado se calcula solo con calificaciones.** `average_rating` sale de
  `ratings` y de nada más. Mezcladas, cada consulta del promedio tendría que
  filtrar las filas sin cuerpo, y el índice se va al garete.

```
ratings   (user_id, work_id, stars, rated_at)      UNIQUE(user_id, work_id)
reviews   (user_id, work_id, body, reviewed_at)    UNIQUE(user_id, work_id)
```

Si alguien califica y escribe reseña, son dos filas. Correcto: son dos hechos.
Son dos agregados en el **mismo** módulo `review`, no dos módulos.

### 3. `work` y `edition` no son lo mismo

La distinción central del dominio bibliográfico, y no es opcional.

- **`work`** (la obra): "Fantastic Mr. Fox". Título, descripción, autores,
  materias. Sin ISBN, sin páginas.
- **`edition`**: ISBN, editorial, idioma, número de páginas, portada.

La misma obra tiene muchas ediciones con datos distintos. Comprobado en la API
de OpenLibrary: *Fantastic Mr. Fox* tiene **161 ediciones**; la hebrea de 2005
tiene 103 páginas y la inglesa de 2024 tiene 96.

Van en el mismo módulo `catalog` porque una edición siempre apunta a una obra, y
no hay caso de uso donde sean independientes. El autor, en cambio, tiene módulo
propio: fecha de nacimiento y muerte, ficha propia.

## Los módulos

| Módulo | Qué hace | Tablas |
|---|---|---|
| `auth` | Login, contraseñas, tokens, guards | `credentials` |
| `user` | Identidad y cara pública: login y perfil | `users`, `profiles` |
| `catalog` | Obras y ediciones, promedio asíncrono | `works`, `editions` |
| `author` | Ficha de autor y su relación con las obras | `authors`, `author_works` |
| `shelf` | Estados de lectura y listas | `shelves`, `shelf_entries` |
| `review` | Calificaciones, reseñas, comentarios, likes | `ratings`, `reviews`, `review_comments`, `review_likes` |
| `notifications` | Consumidores pasivos de eventos | `notifications` |

### `user` y `profile` están en el mismo módulo, pero en tablas distintas

Un módulo, dos entidades: `users` (identidad de acceso) y `profiles` (cara
pública). La separación que importa es de **datos**, no de módulos.

Estaban en módulos separados con el argumento del "ritmo de cambio", y era
falso: al ser tablas distintas, editar la bio nunca tocó la fila que lee el
login. Lo que de verdad se protege es que un endpoint de perfil no devuelva
`users.email`, y eso lo da **la tabla que se consulta**, no el módulo que la
contiene.

Por eso los puertos de lectura son **dos** (`UserQueryPort` y
`ProfileQueryPort`) aunque vivan juntos: quien pide perfil llama a
`ProfileQueryPort` y no tiene forma de alcanzar `users`. Un puerto único
invitaría a devolver el email en el mismo objeto que el nombre.

Y como un usuario sin perfil no es un estado válido, estar en el mismo módulo
es lo que hace cumplir esa invariante en vez de dejarla en una convención:
`createUserWithProfile` los escribe **en una transacción**, así que un
`fullName` inválido no deja un usuario huérfano. Sin la transacción, la base lo
aceptaba sin quejarse.

### Los UUID los genera la aplicación, no la base

`User.createNew` y `Profile.createNew` llaman a `randomUUID()` de `node:crypto`.
Las columnas `id` son `@PrimaryColumn('uuid')` y **no** llevan
`DEFAULT gen_random_uuid()`. Insertar sin id falla con `null value in column
"id"`, que es justo lo que se quiere: si el id existe en algún sitio, que sea
el nuestro y no el de un default que nadie recuerda.

Node usa el CSPRNG del sistema, así que es un v4 criptográfico, lo mismo que
`gen_random_uuid()`. No es una decisión estética.

**Lo que se gana** es que el id existe **antes** del INSERT. Por eso
`createUserWithProfile` puede construir el perfil entero con su `userId` real y
validarlo antes de abrir la transacción. Con el default, el `userId` solo se
conocía después del primer INSERT, y había que validar el perfil con un
`userId: ''` para corregirlo después.

La asimetría que sale de eso, y que conviene no romper:

- `UserNewProps` **no** tiene `id`: quien crea el usuario no lo elige.
- `toPersistence()` **sí** lo lleva, porque va en el INSERT. Por eso los puertos
  de escritura reciben `UserWithId`, no `UserNewProps`.
- Las fechas **no** van en `toPersistence()`: las pone la columna con
  `DEFAULT now()`. Lo que decide la aplicación se escribe; lo que decide la
  base se deja.

**No hay que tocar `pgcrypto` ni `uuid-ossp`.** No se usa ninguna de las dos.
TypeORM tiene una opción `uuidExtension` que solo aplica cuando las entidades
usan `@PrimaryGeneratedColumn('uuid')`, así que aquí no está. Ojo con su `down`
por defecto: pone `uuid_generate_v4()`, que es de la extensión antigua.

El *libro favorito* **no va en `profile`**. Es una relación con un libro, no un
atributo del usuario: es lo mismo que una shelf. Si estuviera ahí, `profile`
dependería de `catalog` para poder pintarse.

**No hay foreign key** entre `profiles.user_id` y `users.id`, aunque estén en el
mismo módulo. El coste está medido: al borrar un usuario sin pasar por el caso de
uso, su perfil queda huérfano y nada avisa. A favor, declarar la relación ata la
integridad a que la entidad la declare, y un esquema que no para de drift es
peor que uno sin integridad. Lo que sí está es `UNIQUE (user_id)`, que es la
regla que importaba.

### Comentarios y likes cuelgan de la reseña

Ni de la calificación ni de la obra. En Goodreads también es así: quien likes
algo puede hacerlo sin haber escrito.

```
review_comments -> reviews
review_likes    -> reviews
```

El módulo se llama `review` y no `social` porque guarda lo que es hoy, y deja
sitio para `follow` y `quote` cuando lleguen.

### Fuera de scope

No crees `follow`, `quote`, `activity`, `contracts/` ni `domain/events/`. Un
módulo vacío es deuda, y `review` ya es el que más crece.

## `composition/container.ts`

Cada módulo tiene su composition root: el único sitio que ve las tres capas a la
vez, porque su trabajo es atar un puerto de `domain` al adapter que lo implementa
en `infrastructure`.

Dos exports, y la separación es deliberada:

```ts
export const authBindings = [
  { provide: PasswordHasherPort, useClass: BcryptPasswordHasherAdapter },
  { provide: AuthTokenPort, useClass: JwtTokenAdapter },
];

export const authProviders = [
  AuthService,
  ...authBindings,
  { provide: APP_GUARD, useClass: AuthGuard },
];
```

`bindings` solo lleva puerto→adapter. `providers` añade services y guards.
Separarlas permite montar el grafo en un test sin arrastrar el `APP_GUARD`
global:

```ts
const moduleRef = await Test.createTestingModule({
  providers: [...authBindings, AuthService],
})
  .overrideProvider(PasswordHasherPort)
  .useValue<FakeHasher>(fakeHasher)
  .compile();
```

Eso es lo que un contenedor tipo Koin daría y Nest no de otra forma: cambiar una
implementación sin tocar la clase que la consume.

`controllers`, `imports` y `exports` se quedan en `<módulo>.module.ts`. Son
superficie pública, no wiring.

**`container.ts` es una convención, no una regla del framework.** El módulo
funciona igual con los bindings dentro de `providers: [...]`. Si el fichero
empieza a acumular helpers o tipos que no son wiring, hay que vaciarlo: un
composition root que mezcla cosas deja de serlo.

## Eventos: primitivas, nunca entidades

Un evento que cruza módulos lleva identificadores, no clases del emisor.

```ts
// MAL: el contrato depende del modelo de catalog
export class BookRated {
  constructor(readonly work: WorkProps, readonly stars: number) {}
}

// BIEN: el contrato es estable
export class BookRated {
  constructor(
    readonly workId: string,
    readonly userId: string,
    readonly stars: number,
    readonly ratedAt: Date,
  ) {}
}
```

Si el evento lleva `WorkProps`, cambiar el modelo de la obra obliga a tocar el
evento y a todos los que lo escuchan. Con `workId`, quien escucha recibe un
identificador y decide qué hacer.

Es lo que permite que `catalog` recalcule su promedio sin que `review` sepa que
existe un promedio.

## `catalog` es un caché de OpenLibrary

Los datos de lectura no se inventan: se leen de la API pública de OpenLibrary.
Es el único módulo con un puerto contra un cliente externo.

- Envía cabecera `User-Agent` con nombre de app y email de contacto: da 3 req/s
  en lugar de 1.
- Cachea. No es solo rendimiento, es lo que pide la API.
- OpenLibrary dice explícitamente que sus APIs **no** son un backend para
  terceros. No hay usuarios, ni reseñas, ni listas: eso lo escribimos nosotros.
- Para carga inicial, los dumps mensuales. Nunca la API.

## Consistencia asíncrona

`average_rating` se recalcula escuchando `BookRated`, no bloqueando la escritura
de una reseña con un `AVG()` sobre toda la tabla.

El precio es una ventana de inconsistencia: el usuario califica y ve el promedio
viejo unos segundos. No es un bug. En la interfaz se comunica como "se está
actualizando".

Con `rating` separada de `review`, el promedio sale solo de `ratings`, así que
mantener la distribución por estrellas no cuesta nada.

## Convenciones

**Nombres de fichero**: *kebab-case* con sufijo de rol.
`project-query.port.ts`, `credential.repository.ts`, `book-rated.event.ts`. No
PascalCase.

**Módulos**: singular. `shelf`, no `shelves`.

**Puertos**: los que la *entidad* necesita para persistirse van en
`domain/ports/`. Los que solo los *casos de uso* necesitan para consultar van en
`application/ports/`.

**Errores**: los de dominio (`BusinessException`, `ResourceNotFoundException`)
vienen de `src/common/exceptions` y son framework-free. `AppException` extiende
`Error`, no `HttpException`, precisamente para que el dominio no sepa que
existe HTTP.

## Trampas

**Los `composition/container.ts` están vacíos**, y los `<módulo>.module.ts` no
tienen controladores ni `imports`. Es el estado esperado: `pnpm start` levanta
sin ninguna ruta hasta que escribas los bindings y las clases. No es un fallo.

**`src/migrations/` no existe.** La crea el primer `pnpm migration:generate`.
`data-source.ts` ya apunta a esa ruta.

**`ADMINER_PORT` es del `compose`, no de la API.** Solo la lee
`compose.yml`, para el puerto que publica Adminer. La API usa `PORT`.

**`migration:generate` necesita su `path`.** El comando de `package.json` es
`migration:generate -d src/database/data-source.ts`, pero el CLI exige además un
argumento posicional con dónde escribir el fichero:

```bash
pnpm migration:generate src/migrations/Algo.ts
```

No es `pnpm migration:generate` a secas: falla con `Not enough non-option
arguments`. Si añades un `&&` delante de un comando de TypeORM, **pnpm deja de
reenviar los argumentos**, y el fallo vuelve a ser ese. Por eso la creación del
schema está dentro de `data-source.ts` y no encadenada en el script.

## El schema de Postgres

`DB_SCHEMA` (`monolithschema`) es el schema donde caen las tablas. Lo leen los
dos puntos de conexión, y ambos leen la misma variable para que no puedan
separarse:

- `src/database/database.module.ts`, para la aplicación.
- `src/database/data-source.ts`, para el CLI de migraciones.

**Pasar `schema` a TypeORM no crea el schema.** Solo le dice dónde leer y
escribir. Y el CLI tampoco puede crearlo, porque su tabla `migrations` vive en
el schema que todavía no existe: `relation "migrations" does not exist`, un
error que no menciona el schema por ninguna parte.

Por eso existe `src/database/ensure-schema.ts`, y por eso los dos puntos de
conexión hacen `await ensureSchema()` **antes** de abrir su conexión. Se conecta
con `pg` y no con TypeORM porque un `DataSource` con el schema configurado es
justo lo que aún no se puede abrir.

Dos detalles que no son evidentes:

- **`data-source.ts` exporta una promesa, no un `DataSource`.** TypeORM 1.x hace
  `await` sobre lo exportado, así que el orden se respeta. Si algún día se
  cambia a `new DataSource(...)` directo, el schema deja de crearse.
- **Sin `DB_SCHEMA` se usa el `public`**, que es el comportamiento anterior y no
  un fallo. Vacío se traduce a `undefined` a propósito: `''` sería un schema
  que se llama vacío.

El nombre se valida con un patrón en vez de escaparse, porque va interpolado en
el SQL (Postgres no permite parametrizar identificadores). Un `DB_SCHEMA` con un
punto y coma falla al arrancar, con un mensaje que lo dice, en vez de crear algo
raro en la base de datos.

**Lo que NO se hace**: poner `search_path` en la conexión. TypeORM califica cada
tabla con `"monolithschema"."nombre"` porque `escapePath` compara contra
`searchSchema`, que sigue siendo `public`. Eso funciona para lo que genera
TypeORM. Un `queryRunner.query()` escrito a mano **no** lleva calificador, así
que ahí hay que escribir el schema explícito.

## Consultar la base con tabularis

Hay un cliente MCP (`tabularis`) registrado en opencode, con la conexión
`monolithdb` ya guardada. Sirve para **inspeccionar**: qué tablas hay, qué
índices, qué se ve después de una migración. **No** para cambiar el esquema: eso
es cosa de `migration:generate`, y por algo está en modo de solo lectura.

**Hay que pasar `schema` en cada llamada.** `list_tables` y `describe_table` lo
admiten como parámetro, y **por defecto miran en `public`**, no en
`monolithschema`:

```
list_tables(connection_id="monolithdb")                    -> public
list_tables(connection_id="monolithdb", schema="monolithschema")  -> lo real
```

El MCP **no** puede fijar el schema una vez: está cableado por llamada. Y si se
olvida, no hay error, se ve una lista vacía. Es el fallo más fácil de
interpretar al revés: parece que la base está vacía cuando lo que se ha mirado
es el schema equivocado.

Por lo mismo, cualquier `run_query` debe cualificar a mano:

```sql
SELECT * FROM monolithschema.works;   -- sí
SELECT * FROM works;                  -- busca en public: no existe
```

`SELECT current_schema()` devuelve `public`, que es la prueba de que la
conexión no lleva `search_path`. Es coherente con lo de arriba: lo califica
TypeORM, no la sesión.

### Lo que expone

| Herramienta | Para qué |
|---|---|
| `list_connections` | conexiones guardadas |
| `list_databases` | bases de una conexión |
| `list_tables` | tablas, con `schema` opcional |
| `describe_table` | columnas, índices y FKs |
| `run_query` | SQL arbitrario, **bloqueado si escribe** |

En modo solo lectura, un `CREATE TABLE` se rechaza con `Query blocked by
Tabularis read-only mode`. La lectura sigue funcionando con normalidad. Para
desactivarlo: tabularis → Settings → MCP → Read-only mode.

**`psql` sigue estando disponible** para lo que sea que el MCP no pueda hacer,
como la conexión por socket o los `EXPLAIN`. Son la misma base: el MCP es una
comodidad, no un sustituto.

**El lint tarda unos 8 segundos.** Es a propósito: boundaries resuelve el grafo
de imports en cada pasada. No lo declares roto ni lo saltees.

**`pnpm start` sin Postgres** se queda reintentando la conexión. Es normal si el
`compose up -d` no está levantado.

## Verificar

```bash
pnpm build
pnpm lint
pnpm test
pnpm test:cov       # con cobertura y umbrales: esto es lo que falla si baja
pnpm gen:openapi    # regenera el openapi.json commiteado
```

## Cobertura de tests

`pnpm test:cov` es el que **hace cumplir** los umbrales de `jest.config.ts`. Un
`pnpm test` a secas no recoge cobertura y por tanto no falla nunca, aunque el
`test` pase: si algún día hay CI, tiene que correr `test:cov`, no `test`.

El número que sale es **100 stmts / 89.66 branches / 100 funcs / 100 lines**.

### Qué entra en el número

Solo el núcleo: `domain`, `application` y `common/domain`. Fuera:

- **`infrastructure`**, porque hay una regla de ESLint que prohíbe
  `infrastructure/**/*.spec.ts`. No es una preferencia: un test atado a TypeORM
  se rompe cuando cambia el adapter. Los repositorios se prueban en e2e contra
  Postgres, cuando haya e2e.
- **`src/common/` menos `domain`**: filtros, interceptores y decoradores se
  prueban atravesando HTTP.
- **`main.ts`, `*.module.ts`, `migrations/`**: bootstrap y declarativo.
- **Los ficheros de tipo puro** (`domain/interfaces/`, `application/ports/`): un
  `interface` no genera código, e istanbul los puntúa a 0% sin que haya nada que
  probar.

Antes el denominador era `src/**`, y el global daba **23%**. No era que faltaran
tests: 64 ficheros, 12 de ellos esqueletos vacíos de módulos que aún no existen.

**Los `!` de `collectCoverageFrom` van después de los positivos.** Si una
negación precede al patrón que reincluye esos ficheros, se pierde en silencio.

### Cómo calcula jest los umbrales

Un fichero que casa con **cualquier** clave de umbral (path o glob) queda
**fuera** del grupo `global`. O sea que `global` no es "todo lo recogido", es
"todo lo recogido que ningún glob reclama".

- `global` → el núcleo **sin los modelos**: 100 / 83.33 / 100 / 100.
- el glob de `domain/models` → **cada modelo por separado**, no la carpeta.
  Ahora `user.model.ts` 100 / 88.88 y `profile.model.ts` 100 / 95.45.

Por modelo y no por carpeta porque un modelo nuevo con cero tests no baja el
`global` si otros modelos suben la media. Con el glob, sí se detecta.

### Por qué `branches` no llega al 90%

No es que falten tests. De 58 ramas hay 52 cubiertas y las 6 restantes **no se
pueden cubrir**:

- **3 son código muerto**: `user.model.ts` 142 y 146, y `profile.model.ts` 153,
  con un `typeof x === 'string' ? x.trim() : ''` sobre un parámetro ya declarado
  `string`. El sistema de tipos garantiza que la condición es siempre verdadera.
- **3 son un artefacto de istanbul**: los *parameter properties* del constructor
  de `UserService` (44-46). TypeScript los compila a un `cond-expr`.

El techo es **52/58 = 89.66%**. Para pasar el 90% hay que quitar las tres ramas
muertas, no escribir más tests: sin ellas quedan 52 de 52 y las cuatro métricas
al 100%.

## Contrato OpenAPI

Hay un `openapi.json` **en la raíz del proyecto**, commiteado, que `web` usa
para generar su cliente. Se regenera con:

```bash
pnpm gen:openapi
```

**Regenera y commitea el fichero cuando cambies una API.** Un contrato
desactualizado en el repo genera clientes que ya no compilan contra el backend, y
el error aparece muy lejos de su causa.

### Por qué hay tres ficheros

- **`scripts/generate-openapi.ts`** escribe el JSON. No llama a `listen()`, así
  que no abre puerto.
- **`src/openapi-spec.module.ts`** es `AppModule` **sin `DatabaseModule`**. Existe
  por una razón concreta: `NestFactory.create` **conecta con Postgres aunque no
  se llame a `listen()`**. Sin este módulo, generar el contrato exigiría una base
  de datos levantada.
- **`src/common/swagger/openapi-config.ts`** tiene el `DocumentBuilder`, y lo
  comparten `main.ts` y el script. Si cada uno tuviera el suyo acabarían
  desincronizados, y el `openapi.json` commiteado dejaría de describir lo que el
  backend sirve.

### Si añades un módulo, añádelo a los dos

`OpenApiSpecModule` importa los módulos de negocio a mano, y eso es una
duplicación con consecuencias: si creas un módulo y lo añades solo a
`AppModule`, el `openapi.json` se queda viejo **sin que nada avise**. Si un
endpoint no aparece en el fichero, mira primero si su módulo está en los dos.

### Estado actual

El contrato tiene **0 rutas y 1 esquema**. No hay controladores todavía, y el
script avisa por consola cuando pasa. Es lo correcto, no un fallo: sirve para
comprobar que la cadena funciona, y se llenará solo cuando existan endpoints.

Lo mismo sirve en `/api` y `/api-json` mientras la app está en marcha, que es lo
que hacía el proyecto `portfolio`. Ese proyecto genera los tipos contra el
backend **andando**, lo que obliga a levantarlo; aquí no hace falta.
