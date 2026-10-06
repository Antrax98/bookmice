import type { Provider } from '@nestjs/common';

/**
 * El composition root de `author`: aquí se decide qué adapter implementa cada
 * puerto.
 *
 * Empieza vacío a propósito. Añade los bindings puerto→adapter del módulo a
 * `authorBindings` y consúmelos desde `author.module.ts`. Ver la guía de diseño
 * para el patrón completo.
 *
 * `authorBindings` va separada de `authorProviders` a propósito: un test puede
 * montar el grafo con solo los bindings y sustituir el adaptador que necesite,
 * sin arrastrar guards ni services que no le interesan.
 */

export const authorBindings: Provider[] = [];

export const authorProviders: Provider[] = [...authorBindings];
