import type { Provider } from '@nestjs/common';

/**
 * El composition root de `auth`: aquí se decide qué adapter implementa cada
 * puerto.
 *
 * Empieza vacío a propósito. Añade los bindings puerto→adapter del módulo a
 * `authBindings` y consúmelos desde `auth.module.ts`. Ver la guía de diseño
 * para el patrón completo.
 *
 * `authBindings` va separada de `authProviders` a propósito: un test puede
 * montar el grafo con solo los bindings y sustituir el adaptador que necesite,
 * sin arrastrar guards ni services que no le interesan.
 */

export const authBindings: Provider[] = [];

export const authProviders: Provider[] = [...authBindings];
