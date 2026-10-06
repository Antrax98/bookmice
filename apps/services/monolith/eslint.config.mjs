// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },

  // ---------------------------------------------------------------------------
  // Architecture rules.
  //
  // These are the conventions from CLAUDE.md, turned into rules the linter can
  // enforce. The point is not bureaucracy: a rule you can read in an error
  // message, at the moment you break it, teaches better than a paragraph in a
  // document nobody re-reads. Every message explains the WHY, not just the WHAT.
  //
  // Two different mechanisms live here, and the split is deliberate:
  //
  //   - The LAYER direction (who may depend on whom) is enforced at the bottom
  //     of this file by `eslint-plugin-boundaries`, which resolves the real
  //     import graph. It supersedes the `no-restricted-imports` rules that used
  //     to live here, and those were removed: they matched on the text of the
  //     path, so they missed `await import(...)` and had to be duplicated per
  //     layer.
  //
  //   - What boundaries CANNOT see stays here: file naming conventions, and
  //     which third-party packages a layer may touch. Both are properties of a
  //     FILE, not of a dependency between two elements.
  // ---------------------------------------------------------------------------

  // `domain` stays framework-free. This is why AppException extends Error and
  // not HttpException: the domain should not know that an HTTP API exists.
  //
  // Boundaries has no say here: `typeorm` and `@nestjs/*` are external
  // packages, not elements, so this is the one direction the graph cannot
  // express on its own.
  {
    files: ['src/**/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@nestjs/*',
                '@nestjs/**',
                'typeorm',
                'typeorm/**',
                'class-validator',
                'class-validator/**',
              ],
              message:
                '`domain` stays framework-free — no Nest, no TypeORM, no validation decorators. That independence is what lets the domain be tested and reasoned about on its own. Validate at the edge, in `infrastructure`, and pass plain values inwards.',
            },
          ],
        },
      ],
    },
  },

  // A controller is the door to exactly ONE application service or use case.
  // Enforced by counting constructor parameters — two injected dependencies
  // means the controller is coordinating, and coordination is not its job.
  //
  // Matched by name, so it only guards the names the project actually uses.
  // Both the singular and the plural spelling are listed because Nest
  // scaffolds `.controller.ts` while hand-written route files tend to be
  // `*.routes.ts`; a controller that matches neither escapes this rule, which
  // is why the list is explicit rather than a broad `src/**/*.ts`.
  {
    files: [
      'src/**/*.controller.ts',
      'src/**/*.route.ts',
      'src/**/*.routes.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'MethodDefinition[kind="constructor"][value.params.length>1]',
          message:
            'A controller is the door to exactly ONE application service or use case. If an endpoint needs to coordinate several, that coordination has business meaning: it is a use case, and it belongs in `application`.',
        },
      ],
    },
  },

  // What does not belong to any layer must not sit inside one. This is the
  // cheap guard against the failure mode nobody notices until it is confusing:
  // a `utils/` or `helpers/` folder that quietly becomes a second `common`.
  //
  // `<module>.module.ts` is excluded because it belongs to no layer by
  // definition: it is the module's Nest surface, and its whole job is to point
  // at the layers. What is being asserted is narrower than "everything is in a
  // layer" — it is that a loose file in the middle of a module's tree
  // (`src/modules/user/utils/str.ts`) has no home, because that is how a
  // second `common` starts.
  //
  // `composition/` is the one exception inside the module: it is the wiring,
  // and wiring is by definition the only place allowed to touch all three
  // layers at once.
  {
    files: ['src/modules/**/*.ts'],
    ignores: [
      'src/modules/**/domain/**',
      'src/modules/**/application/**',
      'src/modules/**/infrastructure/**',
      'src/modules/**/composition/**',
      'src/modules/*/*.module.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Program',
          message:
            'Everything inside `src/modules/<module>/` belongs to one of the four folders: `domain`, `application`, `infrastructure` or `composition`. A shared helper loose in the module is a `common` in disguise, and the fix is either to say which layer it serves or to move it to `src/common`.',
        },
      ],
    },
  },

  // `infrastructure` is never tested: a test tied to TypeORM or to HTTP breaks
  // when the adapter changes, which is exactly what the port exists to prevent.
  //
  // Everything else is fair game. `domain` holds pure functions with no
  // dependencies —value objects, models— and testing them directly is cheaper
  // and clearer than reaching them through a use case.
  {
    files: ['src/**/infrastructure/**/*.spec.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Program',
          message:
            '`infrastructure` is never tested: the test would be tied to the adapter (TypeORM, HTTP), which is what the port exists to avoid. Test the rule in `domain`, or the flow in `application` through the use case.',
        },
      ],
    },
  },

  // Test files pass mocked methods around as arguments — that is exactly
  // `expect(repo.update).toHaveBeenCalledWith(...)`, the idiomatic way to
  // assert on a fake. `unbound-method` exists to catch real `this` leaks in
  // production code; jest mocks are stateless functions with no `this`, so the
  // rule only adds noise in `.spec.ts`.
  {
    files: ['src/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
    },
  },

  // ---------------------------------------------------------------------------
  // Architecture as a resolved import graph.
  //
  // The `no-restricted-imports` rules above match on the TEXT of the import
  // path, which is why they miss `await import(...)` and why they only see a
  // controller when the file happens to be named `*.controller.ts`. Those are
  // holes in the exact places where the architecture is easiest to break by
  // accident.
  //
  // This block resolves the real graph instead: it classifies each folder as an
  // element, follows the import to its destination element, and compares the
  // two. A dynamic import is a dependency like any other, and a `user.route.ts`
  // is a controller whatever it is called.
  //
  // `default: 'disallow'` with an allow-list per layer, rather than a
  // deny-list. The difference matters as the project grows: a new layer, or a
  // new file type nobody thought of, is a violation by default instead of
  // something that silently passes until a human remembers to add a rule.
  // ---------------------------------------------------------------------------
  {
    plugins: { boundaries },
    // The setting keys are plugin-namespaced and flat (`boundaries/elements`),
    // not nested under a `boundaries` object.
    settings: {
      'boundaries/root-path': import.meta.dirname,
      // The plugin caches the resolved graph on disk between runs, which is
      // most of why it stays fast even though it resolves every import.
      'boundaries/cache': true,

      // Out of the box the plugin resolves imports with the Node resolver,
      // which does not know that `../../x/y.repository` means
      // `../../x/y.repository.ts`. Without this every dependency comes back
      // unresolved: silently ignored, and no violation reported. The
      // TypeScript resolver is what makes the graph real.
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },

      // Elements are matched by `type` across every module, so
      // `src/modules/*/domain` in module `user` and the same in module
      // `project` are the same element type. Policies then read as the rule of
      // the architecture rather than a list of folders.
      //
      // Everything outside these patterns (`src/common`, `src/config`,
      // `src/database`, `main.ts`, `app.module.ts`) is an unknown element, and
      // `checkUnknownLocals: false` leaves those dependencies alone. Shared
      // kernel code is deliberately not a layer here: it has no forbidden
      // direction to enforce.
      'boundaries/elements': [
        {
          name: 'domain',
          type: 'domain',
          pattern: 'modules/*/domain',
        },
        {
          name: 'application',
          type: 'application',
          pattern: 'modules/*/application',
        },
        {
          name: 'infrastructure',
          type: 'infrastructure',
          pattern: 'modules/*/infrastructure',
        },
        {
          // The module's wiring. It is the fourth folder, and the only one
          // allowed to reach all three layers at once: binding a port declared
          // in `domain` to an adapter that lives in `infrastructure` is exactly
          // what a composition root is for.
          name: 'composition',
          type: 'composition',
          pattern: 'modules/*/composition',
        },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          // Anything not matched by a policy below is a violation, so the
          // allow-lists read as the whole architecture instead of a partial
          // list someone has to remember to extend.
          default: 'disallow',
          policies: [
            {
              // The innermost layer: pure, framework-free, and
              // self-contained. It reaches no other layer, not even another
              // module's domain.
              //
              // The last line is a deliberate cost, not an oversight. Two
              // modules that need to talk do it with two calls: `review` asks
              // `user` for a name, it does not import a type out of
              // `user/domain`. Keeping `domain` sealed is what makes it
              // testable in isolation; the price is an extra request at the
              // edges, paid only where two modules genuinely meet.
              from: { element: { type: 'domain' } },
              allow: [],
              message:
                '`domain` is the innermost layer: it depends on nothing. No other layer, no framework, not even another module\'s domain. To use another module, go through its port from `application` — two calls beat a shared type, because a `domain` that imports another `domain` can no longer be read on its own.',
            },
            {
              // The dependency is inverted: the port is an abstract class in
              // `domain`, the adapter implements it in `infrastructure`, and
              // the module wires the two.
              from: { element: { type: 'application' } },
              allow: [
                { to: { element: { type: ['domain', 'application'] } } },
              ],
              message:
                '`application` must not depend on `infrastructure`. Declare a port (an abstract class) in `domain`, implement it in `infrastructure`, and let the module bind one to the other.',
            },
            {
              // `infrastructure` is the only layer that may know that Nest,
              // TypeORM or an HTTP request exist. It reaches inwards freely.
              from: { element: { type: 'infrastructure' } },
              allow: [
                {
                  to: {
                    element: {
                      type: ['domain', 'application', 'infrastructure'],
                    },
                  },
                },
              ],
            },
            {
              // The composition root binds ports to adapters, so it has to see
              // both. That is the whole reason it exists as a separate folder:
              // without it, this reach would have to be allowed everywhere, or
              // `infrastructure` would end up importing its siblings' adapters.
              from: { element: { type: 'composition' } },
              allow: [
                {
                  to: {
                    element: {
                      type: [
                        'domain',
                        'application',
                        'infrastructure',
                        'composition',
                      ],
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  },
);
