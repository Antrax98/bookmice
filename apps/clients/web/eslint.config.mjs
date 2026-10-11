import eslintJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintReact from '@eslint-react/eslint-plugin';
import nextPlugin from '@next/eslint-plugin-next';
import { defineConfig, globalIgnores } from 'eslint/config';

/**
 * `eslint-config-next` NO se usa, y no es una preferencia: depende de
 * `eslint-plugin-react@^7.37.0`, que no soporta ESLint 10 y revienta al
 * cargar cualquier regla suya con
 *
 *   TypeError: contextOrFilename.getFilename is not a function
 *
 * Ese plugin no tiene versión que lo arregle, así que la config se monta a mano
 * con `@next/eslint-plugin-next` (el plugin sin la capa de config) y las reglas
 * de React vienen de `@eslint-react`, que sí soporta ESLint 10 y además cubre
 * React Server Components.
 *
 * El precio: las reglas de accesibilidad y de Next que `eslint-config-next`
 * añadía aparte del plugin hay que listarlas aquí una a una. De momento solo
 * hacen falta estas dos. Si `pnpm lint` falla tras un `pnpm install` sin que
 * nadie toque código, mira primero si `@eslint-react` movió algo: publica
 * seguido.
 */
export default defineConfig(
  // Default ignores de eslint-config-next, que aquí ya no se usa.
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),

  eslintJs.configs.recommended,
  tseslint.configs.recommended,

  // Las reglas propias de Next, del plugin directamente.
  {
    plugins: { '@next/next': nextPlugin },
    rules: {
      '@next/next/no-html-link-for-pages': 'error',
      '@next/next/no-img-element': 'warn',
    },
  },

  // Las de React. Este preset cubre JSX y RSC.
  eslintReact.configs['recommended-typescript'],
);
