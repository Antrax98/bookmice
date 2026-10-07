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
  // cobertura real (98.44 stmts / 86.21 branches / 100 funcs / 98.37 lines) y
  // su trabajo es que la cobertura **no baje**.
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
  //   carpeta. Ahora: `user.model.ts` 95.65 / 83.33 / 100 / 95.65 y
  //   `profile.model.ts` 100 / 90.9 / 100 / 100.
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

  // ## Cuánto falta para el 90% que se suele oír
  //
  // Falta **un test**, y solo uno: `branches` está en 86.21 y el 90% está a
  // un par de ramas.
  //
  // - `user.model.ts`, ramas en 125-129: email **demasiado largo**. No hay
  //   ningún test que lo mande, y sí es alcanzable.
  // - `profile.model.ts`, línea 172: campo opcional que llega como cadena
  //   vacía y tiene que acabar en `null`. También alcanzable.
  //
  // La tercera rama sin cubrir (`profile.model.ts` 153) **no se puede cubrir**:
  // es un `typeof value === 'string'` dentro de un parámetro ya tipado como
  // `string`. El sistema de tipos garantiza que siempre es verdad, así que la
  // rama muerta se queda sin cubrir para siempre. No es un agujero, es ruido
  // de istanbul, y sube el número de la una forma y de la otra.
  //
  // La cuarta, `user.service.ts` 44-45, tampoco: son los parámetros del
  // constructor, que istanbul cuenta como rama y que no dependen de nada que
  // el test pueda cambiar.

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
