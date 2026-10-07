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
  // ficheros que solo exportan tipos (`interfaces/`, `application/ports/`). Un
  // `interface` no genera código, así que istanbul los puntúa a 0% sin que haya
  // nada que probar. Dejarlos dentro pone filas al 0% en el informe que parecen
  // un agujero y no lo son.
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
  ],

  // Un umbral que hoy no se cumple es peor que no tener umbral: se acostumbra
  // uno a verlo rojo y a pasarlo por alto, y para entonces ya no vigila nada.
  //
  // Estos valores son un **suelo**, no un objetivo: están por debajo de la
  // cobertura real (100 stmts / 94.23 branches / 100 funcs / 100 lines) y su
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
  // - `global` -> el resto del núcleo, sin los modelos. Ahora: 100 / 83.33 /
  //   100 / 100.
  // - el glob de `models` -> cada modelo **por separado**, no el agregado de la
  //   carpeta. Ahora los dos al 100%: `user.model.ts` 100 / 100 / 100 / 100 y
  //   `profile.model.ts` igual.
  //
  // Por modelo y no por carpeta porque es lo que hace falta: un modelo nuevo
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
  },

  // ## Por qué `branches` se queda en 94.23% y no llega al 100%
  //
  // De 52 ramas hay 49 cubiertas, y **las 3 que faltan no son código nuestro**:
  // son `user.service.ts` 44-45, los *parameter properties* del constructor
  // (`private readonly users: UserRepositoryPort`). TypeScript los compila a un
  // `cond-expr` e istanbul cuenta un brazo que ningún test alcanza.
  //
  // Se podrían cubrir renunciando a los parameter properties y escribiendo
  // `private readonly users: UserRepositoryPort;` más `this.users = users` en el
  // cuerpo del constructor. **No se ha hecho a propósito**: es degradar el
  // código para mover una cifra, y lo que mide el número no mejora. Si algún día
  // se acepta ese coste, se hace a conciencia y aquí se anota por qué.
  //
  // Antes de esto eran 6 las ramas inalcanzables, y 3 de ellas sí eran código
  // muerto: `typeof x === 'string' ? x.trim() : ''` sobre un parámetro ya
  // declarado `string`, en `User.normalizeUsername`, `User.normalizeEmail` y
  // `Profile.normalizeText`. Eso se quitó.
  //
  // Y **no hay herramienta que lo impida**: se probó con
  // `allowUnreachableCode: false` (que solo marca sentencias tras un `return`) y
  // con `@typescript-eslint/no-unnecessary-condition` con tipos activados (que
  // tampoco salta). Ver el comentario del `tsconfig.json`. La única defensa es
  // la revisión, y por eso el código lleva escrito por qué no está el `typeof`.
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
