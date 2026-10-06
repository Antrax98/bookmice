import type { Provider } from '@nestjs/common';

/**
 * El composition root de `shelf`: aquí se decide qué adapter implementa cada
 * puerto.
 *
 * Empieza vacío a propósito. Añade los bindings puerto→adapter del módulo a
 * `shelfBindings` y consúmelos desde `shelf.module.ts`. Ver la guía de diseño
 * para el patrón completo.
 *
 * `shelfBindings` va separada de `shelfProviders` a propósito: un test puede
 * montar el grafo con solo los bindings y sustituir el adaptador que necesite,
 * sin arrastrar guards ni services que no le interesan.
 */

export const shelfBindings: Provider[] = [];

export const shelfProviders: Provider[] = [...shelfBindings];
