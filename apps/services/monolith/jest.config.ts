import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import ts from 'typescript';

// Path aliases (e.g. the ones added by `nest g library`) live in tsconfig.json,
// so they are read from there instead of being duplicated here.
const { config: tsconfig } = ts.readConfigFile(
  './tsconfig.json',
  ts.sys.readFile,
);
const paths = tsconfig?.compilerOptions?.paths ?? {};

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  moduleNameMapper: pathsToModuleNameMapper(paths, { prefix: '<rootDir>/' }),

  // Qué entra en el número de cobertura.
  //
  // El denominador es el núcleo hexagonal, y solo el núcleo: `domain`,
  // `application` y `common/domain`. Tres exclusiones, cada una con un motivo:
  //
  // 1. **`infrastructure` no entra.** No es una preferencia de cobertura: hay
  //    una regla de ESLint (`eslint.config.mjs`) que prohíbe
  //    `infrastructure/**/*.spec.ts`, porque un test atado a TypeORM se rompe
  //    cuando cambia el adapter, que es justo lo que el puerto existe para
  //    evitar. Incluirlo en el denominador dejaría el global clavado en un
  //    número bajo para siempre, por código que por diseño no se puede probar.
  //    Los repositorios se prueban en e2e contra Postgres, cuando haya e2e.
  //
  // 2. **`src/common/` (salvo `domain`) no entra.** Filtros, interceptores,
  //    decoradores y DTOs son pegamento de framework: se prueban atravesando
  //    HTTP, no con unit tests. `url.ts` y `error-collector.ts` sí entran, porque
  //    son funciones puras sin Nest, igual que los modelos.
  //
  // 3. **`main.ts`, `app.module.ts`, `*.module.ts` y `migrations/` no entran.**
  //    Son bootstrap y declarativo. `main.ts` es escribir en la consola;
  //    probarlo no comprueba nada.
  //
  // Y hay una cuarta exclusión, que no es de capa sino de **naturaleza**: los
  // ficheros que solo declaran contratos, sin una línea de lógica. Son dos
  // familias:
  //
  // 1. Los que solo exportan **tipos** (`interfaces/`, `application/ports/` con
  //    `interface`). Un `interface` no genera código, así que istanbul los
  //    puntúa a 0% sin que haya nada que probar.
  // 2. Los **puertos** (`*.port.ts`). Una `abstract class` con un método abstracto
  //    sí genera una sentencia — la declaración de la clase — y esa sentencia
  //    sale cubierta o a 0% **dependiendo de si algo la importó**, que es un
  //    artefacto de carga, no cobertura.
  //
  // El caso 2 duele con `UserCreationPort`: lo implementa un adapter que vive
  // en `infrastructure`, y `infrastructure` no se testea por arquitectura (hay
  // una regla de ESLint que lo prohíbe). Así que nada lo carga nunca y el puerto
  // sale al 0% sin que nadie haya escrito mal una línea.
  //
  // Excluirlos no esconde lógica: no hay lógica que cubrir. Lo que sí se vigila es
  // que un puerto se **implemente**, y eso lo comprueba el arranque de Nest, que
  // falla si falta un binding.
  //
  // Antes esto era `src/**/*.{ts,js}`, y el global daba 23%. No era que faltaran
  // tests: era que 64 ficheros entran en el número, 12 de ellos esqueletos
  // vacíos de módulos que aún no existen, y el resto bootstrap. Un 23% así no
  // dice nada.
  //
  // El orden importa: los `!` van **después** de los positivos. Si una negación
  // precede al patrón que vuelve a incluir esos ficheros, se pierde y los
  // `ports/` vuelven a aparecer al 0% en el informe.
  collectCoverageFrom: [
    'src/modules/*/domain/**/*.ts',
    'src/modules/*/application/**/*.ts',
    'src/common/domain/**/*.ts',
    '!src/modules/*/domain/interfaces/**/*.ts',
    '!src/modules/*/application/ports/**/*.ts',
    '!src/modules/*/domain/ports/**/*.port.ts',
  ],

  // Un umbral que hoy no se cumple es peor que no tener umbral: se acostumbra
  // uno a verlo rojo y a pasarlo por alto, y para entonces ya no vigila nada.
  //
  // Estos valores son un **suelo**, no un objetivo: están por debajo de la
  // cobertura real (100 stmts / 88.68 branches / 100 funcs / 100 lines) y su
  // trabajo es que la cobertura **no baje**.
  //
  // ## Cómo calcula jest los umbrales, que no es lo que parece
  //
  // En `@jest/reporters`, un fichero que casa con **cualquier** clave de umbral
  // (path o glob) queda **fuera** del grupo `global`. O sea: `global` no es
  // "todo lo recogido", es "todo lo recogido que ningún otro glob reclama".
  //
  // Está bien, pero conviene saberlo, porque si no el número parece arbitrario.
  // Aquí reparte en dos grupos:
  //
  // - `global` -> lo que no reclama ningún glob, o sea `common/domain`. Ahora:
  //   100 / 100 / 100 / 100.
  // - el glob de `models` -> cada modelo **por separado**, no el agregado de la
  //   carpeta. Ahora los dos al 100%.
  // - el glob de `use-cases` -> cada caso de uso por separado. Ahora:
  //   `create-user-with-profile.use-case.ts` 100 / 78.57 / 100 / 100,
  //   `register.use-case.ts` 100 / 77.27 / 100 / 100,
  //   `login.use-case.ts` 100 / 83.33 / 100 / 100.
  //
  //   Los tres tienen statements, functions y lines al 100%. El `branches` está
  //   entre 77 y 83 por los helpers de TypeScript, una rama por parámetro del
  //   constructor. Ver el umbral de `use-cases` más abajo.
  //
  // Que el `global` esté al 100% y solo tenga 6 ramas **no** significa que
  // vigile poco: quiere decir que ya no es el que hace el trabajo. El Aggregate
  // es lo que más se relaja cuando todo lo demás sube, así que dejar el peso en
  // los tres grupos es justo lo contrario de apoyarse en él. Cuando landing un
  // módulo nuevo, su `domain/models` y sus `use-cases` entrarán por sus globs y
  // el `global` irá creciendo con lo que sobre.
  //
  // Por modelo y no por carpeta porque es lo que hace falta: un fichero nuevo
  // con cero tests no baja el `global` si otros suben la media, así que el
  // `global` solo no lo detectaría. Con el glob, sí.
  coverageThreshold: {
    global: {
      statements: 95,
      branches: 80,
      functions: 100,
      lines: 95,
    },
    // Los modelos llevan su propio suelo porque es donde vive el negocio y lo
    // único que se prueba sin base de datos ni dobles. Si el `global` se
    // cumple con tests triviales mientras el dominio se queda sin cubrir, el
    // número miente.
    './src/modules/*/domain/models/**/*.ts': {
      statements: 90,
      branches: 80,
      functions: 100,
      lines: 90,
    },
    // Los casos de uso también llevan suelo propio, por el mismo motivo que los
    // modelos: un caso de uso nuevo sin un solo test no baja el `global` si los
    // demás están al 100%.
    //
    // `branches` está a 70 y no a 95 a propósito, y hay que entender por qué.
    //
    // **Una rama por parámetro del constructor, que no es código nuestro.** En
    // cualquier clase con `@Injectable()`, TypeScript emite al final del
    // fichero los helpers `__decorate` y `__metadata`, y ahí están sus ramas.
    // El `__metadata("design:paramtypes", ...)` es lo que permite a Nest saber
    // qué inyectar en cada parámetro: sin él no hay inyección de dependencias.
    //
    // El source map atribuye esas ramas a las líneas del constructor, así que el
    // informe señala `private readonly hasher: PasswordHasherPort` como si fuera
    // tuyo. No lo es.
    //
    // Comprobado, aislando las dos partes con el instrumentador:
    // - `class X { constructor(users, creds) { ... } }` a secas → **0 ramas**.
    // - `var __decorate = (this && this.__decorate) || function ...` → **sí**.
    //
    // Y por eso el total coincide con los parámetros de cada clase:
    // `register` 5, `login` 4, `create-user-with-profile` 3. **12 en total.**
    //
    // Qué se probó y **no** funcionó:
    // - Quitar los *parameter properties* → no quita las ramas.
    // - `useDefineForClassFields: false` → no quita las ramas.
    // - `importHelpers: true` + `tslib` → las saca del `dist`, pero ts-jest no
    //   lo respeta y la métrica no se mueve.
    // - Bajar a **jest 29** → tampoco: `@jest/reporters@29.7.0` y `@30.5.2`
    //   piden las dos `istanbul-lib-instrument@^6.0.0`, y la v5 se comporta
    //   igual que la v6 con estos helpers. Verificado instrumentando con ambas.
    //
    // Es decir: no se puede arreglar sin perder la inyección de dependencias, o
    // aceptando 88.68% de `branches` global. Se acepta.
    './src/modules/*/application/use-cases/**/*.ts': {
      statements: 95,
      branches: 70,
      functions: 100,
      lines: 95,
    },
  },

  // ## El 78% de un caso de uso, y por qué no es un agujero
  //
  // De 106 ramas hay 94 cubiertas. Las **12** que faltan son, todas, los helpers
  // `__decorate` y `__metadata` que TypeScript emite por fichero en las clases
  // con `@Injectable()`. Una por parámetro del constructor: 5 en `register`, 4
  // en `login`, 3 en `create-user-with-profile`.
  //
  // Ningún test puede cubrirlas, porque esos helpers tienen un brazo con
  // `Reflect` y otro legacy, y en runtime solo se ejecuta uno. Está detallado en
  // el umbral de `use-cases` de arriba, con lo que se probó y lo que no
  // funcionó, incluida la bajada a jest 29.
  //
  // ## Los dos tests que faltaban de verdad
  //
  // Antes de quitar nada se añadieron, y no eran un detalle de Coverage, eran
  // pruebas que no existían:
  //
  // - `user.model.ts`: el `if` de longitud **nunca** se ejecutaba. Todos los
  //   correos probados pasaban o fallaban por `EMAIL_SHAPE`, así que el límite
  //   de 255 no tenía ni un test que lo tocara.
  // - `profile.model.ts`: el brazo de `nullable()` que devuelve el texto tenía
  //   **cero** ejecuciones. Todos los tests de campos opcionales pasaban cadenas
  //   vacías, así que un campo opcional con contenido —una bio, que es el caso
  //   normal— no estaba probado.

  // Los umbrales **solo se comprueban si se recoge cobertura**. Un `pnpm test`
  // a secas no recoge cobertura y por tanto no falla nunca, aunque el `test`
  // pase. Lo que hace cumplir el suelo es `pnpm test:cov`, y es el que tiene
  // que correr en CI: si CI corre `pnpm test`, estos números no existen.
  collectCoverage: false,
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'lcov'],
  testEnvironment: 'node',
};

export default config;
