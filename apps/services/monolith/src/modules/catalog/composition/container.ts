import type { Provider } from '@nestjs/common';

/**
 * El composition root de `catalog`: aquí se decide qué adapter implementa cada
 * puerto.
 *
 * Empieza vacío a propósito. Añade los bindings puerto→adapter del módulo a
 * `catalogBindings` y consúmelos desde `catalog.module.ts`. Ver la guía de diseño
 * para el patrón completo.
 *
 * `catalogBindings` va separada de `catalogProviders` a propósito: un test puede
 * montar el grafo con solo los bindings y sustituir el adaptador que necesite,
 * sin arrastrar guards ni services que no le interesan.
 */

export const catalogBindings: Provider[] = [];

export const catalogProviders: Provider[] = [...catalogBindings];
